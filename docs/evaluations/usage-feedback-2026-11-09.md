# Consumer usage feedback assessment

Reviewed against Tiepoint `d062de4` on November 9, 2026. The historical audit
examined Skillfish `3825312`; it is evidence about that consumer snapshot, not
proof of current consumer configuration. The full received handoff and embedded
audit are retained locally under ignored `.context/usage-feedback/`.

## Planning context

The [installed skill](../../skills/tiepoint/SKILL.md) already required exact
path/selector/AC reads before edits or semantic discovery. The bounded CLI and
MCP primitives exist in [intent-context.ts](../../src/contract/intent-context.ts)
and [their handlers](../../src/tools/intent-context.ts). This addresses retrieval
availability, not demonstrated adoption: the audit's three early and three late
consultations do not establish systematic planning benefit. A 37-criterion path
result still needs agent triage; no new ranking or traversal system is justified.

The verified gap was that published YAML inputs were not checked by those reads.
Linked-file freshness cannot reveal newly authored criteria omitted from the
manifest. This change adds `authored_inputs` diagnostics to both context modes
and status, preserving published content and digest. A bounded hash/path check
detects edits, additions and removals without parsing, compiling or publishing.
Inspection failures remain `unknown`; negative results carry the same diagnostic.
Status retains diagnostics when unpublished YAML is invalid, explicitly identifies
published fallback counts, and keeps publisher recovery ahead of onboarding when
all authored files have been removed from an already published workspace.
The skill now explicitly applies this early read during planning, directs stale
reads to current configured YAML, and asks which rule influenced a decision.
It does not require a new planning Story, database writes, or exhaustive discovery.

## Semantic review

Preserve targeted semantic review. The audit attributes merged repairs to graders
in Skillfish [#2328](https://github.com/mcpmarket-com/skillfish-app/pull/2328)
(upload retry, reachability, totals and storage explanations),
[#2327](https://github.com/mcpmarket-com/skillfish-app/pull/2327)
(draft state and accessibility), and
[#2373](https://github.com/mcpmarket-com/skillfish-app/pull/2373)
(duplicate discovery counts). These are historical finding-to-fix observations,
not newly rerun experiments in this repository.

The stencil finding in [#2322](https://github.com/mcpmarket-com/skillfish-app/pull/2322)
overlapped ordinary review. The reconnect repair in
[#2343](https://github.com/mcpmarket-com/skillfish-app/pull/2343) merged to a feature
branch; it must not be counted as main-shipped evidence. No grading checks,
permission/billing/lifecycle scope, or finding-resolution duties are weakened.

## Publication lifecycle

Upstream already supplies validated publication:
[refresh-manifest.ts](../../src/commands/refresh-manifest.ts), the
[workflow example](../examples/tiepoint-manifest-refresh.yml), and
[setup and recovery guidance](../operations.md#post-merge-manifest-maintenance-opt-in)
were added in `9bbb1f7` (#113). Check explicitly reports pending publication and
compiles authored YAML in memory in post-merge mode. Installing and monitoring a
publisher was already required in the shipped maintenance reference.

Skillfish's post-merge mode without a functioning publisher, stale generated files,
contradictory consumer docs, and MCP/CLI version split are consumer responsibilities.
This change makes stale context actionable upstream; it cannot establish remote
publisher health from local configuration. Status already exposes local MCP version
diagnostics through [mcp-config.ts](../../src/tiepoint/mcp-config.ts). The audit did
not establish a causal effect from the version split.

No consumer setting, publisher identity, branch policy, package release or protected
branch is changed. Choosing permanent committed versus post-merge publication and
installing a consumer publisher remain owner decisions. A consumer refresh PR is
separate work and does not repair an absent ongoing publisher.

## Repeated closeout and reporting

Already addressed upstream:

- [Criterion grading](../../skills/tiepoint/references/criterion-grading.md) uses
  `--scope claims` for routine closeout and `--scope impacted` for broader review,
  including uncertain behavior and permissions/security. Implementation-only and
  removed criteria remain explicit reconciliation work.
- Criterion verdict IDs bind claims and evidence, allowing unchanged-ID reuse within
  one closeout. [criterion-grade.ts](../../src/contract/criterion-grade.ts) verifies
  that identity; hashes alone are not semantic review.
- [Commit-bound closeout](../../skills/tiepoint/references/closeout.md), added in
  `e752f10` (#117), binds dispositions to final immutable base/head revisions.
- [SQL analysis](../../src/contract/code-analysis/sql.ts) supports conservative
  declaration citations. Current criterion guidance distinguishes unavailable
  citations (`inconclusive`) from product defects. This does not prove every
  historical SQL limitation is solved.

The remaining workflow contradiction was instructing agents to delete verdicts
immediately after reporting. Guidance now retains scope, verdicts and original
findings in ignored storage through active review, reuses only unchanged IDs, and
keeps final-head binding separate. Completion reporting distinguishes semantic
discrepancies, incidental bugs, link maintenance, citation limits and accepted
trade-offs, including disposition and ordinary-review overlap. Final green totals
must not erase findings repaired earlier; linked tests are not execution receipts.

No new effort-mode CLI, persistent findings store, automatic parser-limit
deduplication, or ten-PR measurement rollout is introduced. Those proposals need
additional evidence or a product decision. Consumer review cadence remains local.

## Review scope and verification

Protected surfaces changed are the additive exact-context MCP output schemas,
workspace-status output, the repository-authored criterion, and their regenerated
manifest/topology sources. Existing input fields, statuses and manifest identity
remain; strict downstream output consumers need the updated additive schema.
No credentials, authorization, migrations, write behavior, required checks,
dependencies or validation configuration change. Independent review is required
before merge; no waiver is introduced.

Regression coverage exercises unpublished edits, added and removed inputs, invalid
YAML without compilation, negative reads, inspection limits, escaped spec roots,
custom spec directories, MCP/CLI parity and preservation of published bytes/digest.
Observed command results and the independent review receipt belong in the PR.
Database integration is not required for this offline read-only behavior and must
not run without verified disposable credentials.
