# Plugin Distribution Architecture

The FLOWSTACK plugin is a thin distribution boundary over exact public Agent
Tools skills.

```text
public FLOWSTACK packages
  -> @flowstack-ui/agent-tools exact release
  -> locked skill snapshot + canonical hosted MCP declaration
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

The interface uses a responsive identity rather than one raster at every size:
the directory `logo` is the detailed flowing-ribbon FLOWSTACK mark, while
`composerIcon` is the compact four-band glyph designed to remain legible in
small composer surfaces. They share the layered-flow concept and palette but
are intentionally not identical.

The plugin does not bundle or implement MCP. It declares the canonical
read-only HTTPS endpoint owned by Agent Tools so ChatGPT clients without local
script execution can resolve the same exact released guidance. Codex and other
local clients still prefer the bundled resolver for installed-package or
staged-archive evidence. The plugin verifier pins the endpoint declaration and
its digest; Agent Tools independently versions, tests, deploys, and monitors
the HTTP and stdio transports.

Paid Blocks source and authentication are outside this repository. Installed
Block code may be reviewed through public Brick owners, but the plugin cannot
discover, unlock, or distribute paid source.
