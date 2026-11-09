import type { EmbeddingProvider } from "../config.js";
import { TIEPOINT_VERSION } from "../package-metadata.js";
import { hasAcceptedContractSources, loadAcceptedContract } from "../contract/load.js";
import { readContractManifest } from "../contract/manifest.js";
import { inspectManifestInputFreshness, type ManifestInputFreshness } from "../contract/manifest-input-freshness.js";
import {
  inspectMcpClientConfigs,
  type McpClientConfigDiagnostic,
} from "./mcp-config.js";
import type { TiepointWorkspace } from "./workspace.js";
import { readWorkspaceProfile } from "./profile.js";
import { findWorkspaceRejectingLegacy } from "./legacy-tieline.js";
import type { DatabaseMode } from "./setup.js";

export interface TiepointStatus {
  initialized: true;
  root: string;
  product: string;
  repo: string;
  runtime: {
    /** Present in current CLI output; optional for older serialized callers. */
    cli_version?: string;
    profile_present: boolean;
    database_mode: DatabaseMode;
    embedding_provider: EmbeddingProvider;
    setup_complete: boolean;
  };
  capabilities: {
    semantic_matching_configured: boolean;
    planning_writes_configured: boolean;
  };
  integration: {
    /** Repository-relative client config files that register the MCP server. */
    mcp_clients: string[];
    /** Local package/version diagnostics for each registered client file. */
    mcp_configs?: McpClientConfigDiagnostic[];
  };
  contract: {
    documents: number;
    stories: number;
    acceptance_criteria: number;
    manifest_exists: boolean;
    authored_inputs: ManifestInputFreshness;
    counts_source: "authored" | "published_manifest" | "unavailable";
  };
  next_action: string;
  onboarding: {
    required: true;
    skill: "tiepoint";
    instruction: typeof ONBOARDING_AGENT_INSTRUCTION;
    install_command: typeof ONBOARDING_SKILL_INSTALL_COMMAND;
  } | null;
}

export const ONBOARDING_AGENT_INSTRUCTION =
  "Ask your agent to use the installed tiepoint skill to onboard this repository. In Claude Code, run /tiepoint; in Codex, run $tiepoint.";
export const ONBOARDING_SKILL_INSTALL_COMMAND =
  "npx -y tiepoint@latest init .";

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function readableManifest(directory: string): ReturnType<typeof readContractManifest> | null {
  try {
    return readContractManifest(directory);
  } catch {
    return null;
  }
}

export function getTiepointStatus(
  workspace: TiepointWorkspace,
  env: NodeJS.ProcessEnv = process.env
): TiepointStatus {
  const stored = readWorkspaceProfile(workspace, env);
  const runtime =
    stored?.profile.runtime ??
    {
      database_mode: workspace.config.runtime.default_database_mode,
      embedding_provider:
        workspace.config.runtime.default_embedding_provider,
      setup_completed_at: null,
    };
  // Presence alone is not availability: an interrupted compile, malformed
  // shard, or legacy schema cannot answer manifest-backed reads. Status stays
  // recoverable and sends each of those states through the existing compile
  // action instead of throwing.
  const manifest = readableManifest(workspace.manifestPath);
  const manifestExists = manifest !== null;
  const inspectedInputs = inspectManifestInputFreshness({
    repositoryRoot: workspace.root,
    manifest: manifest ?? { inputs: [] },
    specDirectory: workspace.specDirectoryPath,
  });
  const authoredInputs: ManifestInputFreshness = manifest ? inspectedInputs : {
    status: "unknown",
    detail: "No readable published manifest is available to compare with current authored YAML." +
      (inspectedInputs.status === "unknown" ? ` ${inspectedInputs.detail}` : ""),
  };
  let loaded: ReturnType<typeof loadAcceptedContract> | null = null;
  // A failed bounded inspection must not lead to an unbounded validation read.
  if (inspectedInputs.status !== "unknown") {
    try {
      const hasContractFiles = hasAcceptedContractSources(workspace.root, workspace.specDirectoryPath);
      loaded = hasContractFiles
        ? loadAcceptedContract(workspace.root, workspace.specDirectoryPath)
        : { documents: [], warnings: [] };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      authoredInputs.detail += ` Authored YAML validation failed: ${detail.slice(0, 2000)}`;
    }
  }
  const countsSource = loaded ? "authored" : manifest ? "published_manifest" : "unavailable";
  const capabilities = loaded?.documents.map((document) => document.capability)
    ?? manifest?.capabilities ?? [];
  const storyCount = capabilities.reduce((count, capability) => count + capability.stories.length, 0);
  const criterionCount = capabilities.reduce((count, capability) => count +
    capability.stories.reduce((total, story) => total + story.acceptance_criteria.length, 0), 0);
  const onboarding =
    loaded !== null && storyCount === 0 && !manifest
      ? ({
          required: true,
          skill: "tiepoint",
          instruction: ONBOARDING_AGENT_INSTRUCTION,
          install_command: ONBOARDING_SKILL_INSTALL_COMMAND,
        } as const)
      : null;
  let nextAction: string;
  if (onboarding) {
    nextAction = onboarding.instruction;
  } else if (!manifestExists) {
    nextAction = workspace.config.manifest_mode === "post_merge"
      ? "Check the configured post-merge publisher and inspect current authored YAML; publication is pending."
      : "Run `tiepoint contract compile .` and review the semantic diff.";
  } else if (authoredInputs.status !== "current") {
    nextAction = workspace.config.manifest_mode === "post_merge"
      ? "Check the configured post-merge publisher and inspect current authored YAML; published context is stale or unverified."
      : "Inspect current authored YAML, then run `tiepoint contract compile .` and review the generated diff.";
  } else {
    nextAction = "Use $tiepoint to reconcile branch work; the pull request is the approval boundary.";
  }
  const mcpConfigs = inspectMcpClientConfigs(workspace.root);
  return {
    initialized: true,
    root: workspace.root,
    product: workspace.config.product.name,
    repo: workspace.config.product.repo_name,
    runtime: {
      cli_version: TIEPOINT_VERSION,
      profile_present: Boolean(stored),
      database_mode: runtime.database_mode,
      embedding_provider: runtime.embedding_provider,
      setup_complete: Boolean(runtime.setup_completed_at),
    },
    capabilities: {
      semantic_matching_configured: configured(
        env.DATABASE_URL ?? stored?.profile.env.DATABASE_URL
      ),
      planning_writes_configured: configured(
        env.DATABASE_URL_WRITE ?? stored?.profile.env.DATABASE_URL_WRITE
      ),
    },
    integration: {
      mcp_clients: mcpConfigs.map((config) => config.path),
      mcp_configs: mcpConfigs,
    },
    contract: {
      documents: capabilities.length,
      stories: storyCount,
      acceptance_criteria: criterionCount,
      manifest_exists: manifestExists,
      authored_inputs: authoredInputs,
      counts_source: countsSource,
    },
    next_action: nextAction,
    onboarding,
  };
}

export function statusFromPath(
  path: string,
  env: NodeJS.ProcessEnv = process.env
): TiepointStatus {
  const workspace = findWorkspaceRejectingLegacy(path);
  if (!workspace) {
    throw new Error(`No .tiepoint/config.json found from ${path}.`);
  }
  return getTiepointStatus(workspace, env);
}
