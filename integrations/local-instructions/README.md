# Local instruction and profile inputs

Controlled adapters for explicitly selected local instruction bundles and one
portable agent/skill profile bundle.

`LocalAgentProfileReader` reads one bounded JSON file, optionally pins its
SHA-256 digest, uses fatal UTF-8 decoding, validates the provider-neutral schema
and project scope, and proves canonical encode/re-import identity. It returns a
safe basename, digest, source/canonical byte counts, logical bundle, and
canonical encoding. It never returns the full path or discovers, installs,
persists, resolves, selects, delivers, or executes any declaration.
