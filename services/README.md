# Services

Supporting components that may run independently from the main application
would live here. **None exists today**: AI Workspace currently runs as a single
local modular monolith with zero external runtime dependencies, and no part of
it is deployed or executed as a separate service.

The long-term design anticipates optional privacy/anonymization and code-graph
services kept behind replaceable adapters. Introducing any of them is a material
architectural decision that requires an ADR, because it would add a deployable
unit, an operational boundary, and an external runtime dependency. The
corresponding directory will be created by the increment that implements it.
