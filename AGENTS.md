# FLOWSTACK Plugin Repository Guidance

This repository distributes versioned FLOWSTACK workflow skills plus the
canonical hosted MCP connection for Codex and ChatGPT.

Read `README.md`, `docs/architecture.md`, and `docs/releasing.md` before
changing the plugin, marketplace, synchronization, or release flow.

Rules:

- Agent Tools remains authoritative for public skills and Agent Knowledge
  delivery. Never edit vendored skill content directly.
- Update vendored content only through `npm run sync -- --version <exact>`.
- Keep MCP implementation and Agent Knowledge in Agent Tools. The plugin may
  declare only the reviewed public `https://agents.brick-ui.com/mcp` endpoint;
  do not add another MCP, apps, hooks, paid Blocks source, private Blueprints,
  research, credentials, customer data, or commercial policy.
- A changed skill set or MCP endpoint requires explicit review in
  `config/plugin.json`.
- Run `npm run check` and the OpenAI plugin validator before committing.
- Test installation from this repository's local marketplace in a new Codex
  task before tagging or requesting directory publication. Qualify both local
  resolver behavior and direct hosted MCP calls in a client without local
  script execution.
- Do not publish or submit a plugin version that is not committed, tagged, and
  traceable to the exact npm integrity recorded in `sources/agent-tools.json`.
