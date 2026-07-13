# Effective instruction preview

AI Workspace can compose explicitly selected, authored-synthetic instruction
bundles without executing or persisting their content. The preview explains
which configured rules are active, overridden, rejected, or excluded.

Register a project first, then select one or more schema-v1 JSON bundles:

```bash
npm run cli -- instructions preview --project <project-id> \
  --bundle integrations/local-instructions/test/fixtures/global.json \
  --bundle integrations/local-instructions/test/fixtures/project.json
```

Use `--model`, `--agent`, and `--task` to select matching targeted sources.
Use `--json` for stable machine output. To detect changes after reviewing a
file, repeat `--expect-digest <sha256>` once per bundle in the same order.

The controlled format contains exactly one source per file:

```json
{
  "schemaVersion": 1,
  "projectId": "synthetic-project",
  "source": {
    "id": "project-source",
    "projectId": "synthetic-project",
    "scope": "PROJECT",
    "target": null,
    "trust": "USER_CONFIGURED",
    "rules": [
      {
        "id": "coding.language",
        "kind": "PREFERENCE",
        "overridable": true,
        "content": "Prefer TypeScript.",
        "position": 0
      }
    ]
  }
}
```

Preference precedence is `GLOBAL < WORKSPACE < PROJECT < MODEL < AGENT <
TASK`. It applies only to preferences with the same rule ID. Constraints are
non-overridable: a later attempt remains visible as `REJECTED`. Equal highest
scope preferences and constraint/preference kind conflicts fail closed.
Targeted sources with no matching explicit selector remain visible as
`EXCLUDED`.

`USER_CONFIGURED` means explicitly selected configuration. It does not mean
verified, executable, or trusted as a security control. Prompt text and
precedence do not enforce filesystem, tool, network, privacy, deployment, or
destructive-action permissions. The preview invokes no agent, model, tool, or
instruction text and does not discover `AGENTS.md`, provider files, IDE rules,
MCP configuration, or home-directory instructions.

Only reviewed synthetic bundles are supported in this pre-release slice. Do
not provide private prompts, credentials, customer configurations, or live
agent files.

The separate [profile-governed context](profile-governed-context.md) preview
can require an exact profile-declared source set and derive the agent target
before calling this same composer. The standalone preview remains available
for direct inspection and does not infer or activate a profile.
