# Instruction Manager

Provider-neutral contracts for deterministic effective-instruction composition
and portable agent/skill profiles.

Agent profile schema v1 contains one project-scoped agent and exactly its
enabled skills. Validation bounds and canonicalizes models, tools, instruction
source IDs, context selectors and budgets, confirmations, inputs, output
formats, versions, author, and license. Internal model/tool/skill conflicts fail
closed. `encodeAgentProfileBundle` produces deterministic newline-terminated
JSON whose re-import is byte stable.

Profiles are `USER_CONFIGURED` descriptive values. This package provides no
file discovery, registry, persistence, installation, signature, availability
resolution, permission enforcement, model/tool adapter, delivery, or execution.
