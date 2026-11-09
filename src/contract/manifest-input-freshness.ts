import { lstatSync, opendirSync, realpathSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type { ContractManifest } from "./manifest.js";
import { createCachedRepositoryEntryInspection, withinRepository } from "./paths.js";
import { createFilesystemSourceSnapshotReader } from "./source-snapshot.js";

export interface ManifestInputFreshness {
  status: "current" | "stale" | "unknown";
  detail: string;
}

/** Compare authored bytes only; never compile, publish, or assess linked evidence. */
export function inspectManifestInputFreshness(input: {
  repositoryRoot: string;
  manifest: Pick<ContractManifest, "inputs">;
  specDirectory?: string;
}): ManifestInputFreshness {
  const stale = (): ManifestInputFreshness => ({
    status: "stale",
    detail: "Published intent differs from current authored YAML. Inspect current authored YAML before relying on this context; a negative lookup does not establish that no rule exists.",
  });
  const root = resolve(input.repositoryRoot);
  const directory = resolve(root, input.specDirectory ?? ".tiepoint/spec");
  let entries = 0;
  const countEntry = (): void => {
    if (++entries > 4096) throw new Error("Authored input inspection exceeds 4096 directory entries.");
  };
  const reader = createFilesystemSourceSnapshotReader({
    repositoryRoot: root,
    entryInspection: createCachedRepositoryEntryInspection({
      stat: (path) => statSync(path),
      readdir: (path) => {
        const dir = opendirSync(path);
        const names: string[] = [];
        try {
          for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
            countEntry();
            names.push(entry.name);
          }
        } finally {
          dir.closeSync();
        }
        return names;
      },
    }),
  });
  try {
    if (!withinRepository(root, directory) ||
        !withinRepository(realpathSync(root), realpathSync(directory))) {
      throw new Error("The authored spec directory is outside the repository.");
    }
    const expected = new Map(input.manifest.inputs.map((entry) => [entry.path, entry.sha256]));
    const observed = new Set<string>();
    const pending = [{ path: directory, depth: 0 }];
    let bytes = 0;
    let changed = false;
    while (pending.length > 0) {
      const next = pending.pop()!;
      if (next.depth > 32) throw new Error("Authored input inspection exceeds 32 directory levels.");
      const dir = opendirSync(next.path);
      try {
        for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
          countEntry();
          const path = resolve(next.path, entry.name);
          if (entry.isDirectory()) {
            if (!withinRepository(realpathSync(root), realpathSync(path))) {
              throw new Error("An authored directory is outside the repository.");
            }
            pending.push({ path, depth: next.depth + 1 });
          } else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
            const key = relative(root, path).split(sep).join("/");
            observed.add(key);
            bytes += lstatSync(path).size;
            if (observed.size > 1024 || bytes > 16 * 1024 * 1024) {
              throw new Error("Authored input inspection exceeds 1024 YAML files or 16 MiB.");
            }
            const source = reader.read(key);
            if (source.status !== "read") {
              throw new Error(`Cannot inspect authored input '${key}': ${source.status}: ${source.detail}`);
            }
            const hash = source.snapshot.sha256;
            reader.release?.(key);
            if (hash !== expected.get(key)) changed = true;
          }
        }
      } finally {
        dir.closeSync();
      }
    }
    return changed || observed.size !== expected.size ? stale() : {
      status: "current",
      detail: "Published authored-input paths and hashes match current YAML. This does not establish semantic support or test execution; linked evidence has separate assurance.",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return stale();
    return {
      status: "unknown",
      detail: `Authored-input freshness could not be established: ${error instanceof Error ? error.message : String(error)} Inspect current authored YAML before relying on published context.`,
    };
  } finally {
    reader.dispose?.();
  }
}
