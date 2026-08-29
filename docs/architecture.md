# Plugin Distribution Architecture

The FLOWSTACK plugin is a thin distribution boundary over exact public Agent
Tools skills.

```text
public FLOWSTACK packages
  -> @flowstack-ui/agent-tools exact release
  -> locked skills-only plugin snapshot
  -> local marketplace testing
  -> universal plugin directory release
```

Agent Tools owns skill content, LLM routes, and the MCP implementation. This
repository owns plugin packaging, marketplace metadata, directory-facing
policy links, interface assets, install qualification, and plugin release
history. Plugin releases are independently versioned so directory metadata or
packaging can be corrected without republishing unchanged Agent Tools content;
the source lock always identifies the exact Agent Tools release underneath.

`scripts/sync-agent-tools.mjs` accepts one exact Agent Tools semantic version
and an optional exact plugin version, downloads the npm archive without
executing package scripts, validates its identity and skills-only manifest,
adds repository-owned square interface assets, and replaces
`plugins/flowstack-ui` through a staged swap. `sources/agent-tools.json`
records both versions plus npm integrity and digests of the source manifest,
final manifest, interface assets, and complete skill tree.

The plugin does not bundle MCP. This keeps tool installation explicit and
allows skills to work across supported ChatGPT and Codex surfaces without
silently adding a network or local process. The HTTP and stdio MCP transports
remain independently versioned Agent Tools surfaces.

Paid Blocks source and authentication are outside this repository. Installed
Block code may be reviewed through public Brick owners, but the plugin cannot
discover, unlock, or distribute paid source.
