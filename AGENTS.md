# FLOWSTACK Plugin Repository Guidance

This repository distributes a versioned, skills-only FLOWSTACK plugin for
Codex and ChatGPT.

Read `README.md`, `docs/architecture.md`, and `docs/releasing.md` before
changing the plugin, marketplace, synchronization, or release flow.

Rules:

- Agent Tools remains authoritative for public skills and Agent Knowledge
  delivery. Never edit vendored skill content directly.
- Update vendored content only through `npm run sync -- --version <exact>`.
- Keep the plugin skills-only. Do not add MCP, apps, hooks, paid Blocks source,
  private Blueprints, research, credentials, customer data, or commercial
  policy.
- A changed skill set requires explicit review in `config/plugin.json`.
- Run `npm run check` and the OpenAI plugin validator before committing.
- Test installation from this repository's local marketplace in a new Codex
  task before tagging or requesting directory publication.
- Do not publish or submit a plugin version that is not committed, tagged, and
  traceable to the exact npm integrity recorded in `sources/agent-tools.json`.
