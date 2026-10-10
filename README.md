# FLOWSTACK UI Plugin

Installable Codex and ChatGPT workflows for building, composing, reviewing,
and maintaining FLOWSTACK interfaces.

This repository is a distribution adapter. The exact public skills remain
owned and released by
[`@flowstack-ui/agent-tools`](https://github.com/flowstack-ui/agent-tools).
The plugin vendors one reviewed Agent Tools release, records its npm integrity,
and connects the public, locked-only FLOWSTACK MCP endpoint for clients that
cannot execute the bundled local resolver. It deliberately excludes MCP
implementation code, paid Blocks source, private Blueprints, and product
research.

## Install in Codex

Install the immutable public `v0.2.4` marketplace release from GitHub:

```bash
codex plugin marketplace add flowstack-ui/plugin --ref v0.2.4
codex plugin add flowstack-ui@flowstack-ui
```

Refresh Codex and start a new task so the installed skills and MCP connection
are available to the new session. To update later, refresh the marketplace and
reinstall the plugin from the `flowstack-ui` source.

## Universal plugin directory

The currently published universal-directory listing is the skills-only
`0.1.2` release:

https://chatgpt.com/plugins/plugins_6a934339ccc88191b35ff37bcaf23c00

The GitHub marketplace above provides the released `0.2.4` Codex package with
the hosted FLOWSTACK MCP declaration. The universal-directory listing will be
updated only after OpenAI approves and the publisher explicitly publishes the
reviewed MCP-backed release.

## Install for local development

Add this checkout as a local marketplace once, then install the plugin:

```bash
codex plugin marketplace add /absolute/path/to/plugin
codex plugin add flowstack-ui@flowstack-ui
```

Refresh Codex and start a new task. The public and local installations
contribute four explicit skills:

- `$flowstack-ui-builder`
- `$flowstack-ui-compose`
- `$flowstack-ui-review`
- `$flowstack-ui-maintainer`

The skills prefer Agent Knowledge from exact FLOWSTACK packages installed in
the target project. When local script execution is unavailable, they use the
plugin MCP at `https://agents.brick-ui.com/mcp` and accept only exact versions
present in its public locked release inventory. Hosted guidance never claims
to inspect a consumer's installed files.

## Update the plugin

Sync one exact published Agent Tools version:

```bash
npm run sync -- --version 0.1.8 --plugin-version 0.2.4
npm run check
```

The sync command downloads the npm archive without running lifecycle scripts,
validates the package and source-skill boundary, stages the skills plus the
reviewed HTTPS MCP declaration, and records npm integrity plus content digests
in `sources/agent-tools.json`.
A changed public skill set fails until `config/plugin.json` is reviewed.

Agent Tools and the distributable plugin are independently versioned. By
default the sync command gives the plugin the source version. For a
directory-packaging-only release, preserve the exact Agent Tools lock and pass
an explicit plugin version:

```bash
npm run sync -- --version 0.1.8 --plugin-version 0.2.5
```

Review the generated skill, manifest, and interface-asset diff, run the
repository check, commit, tag the plugin version, and reinstall from the local
marketplace before submitting that immutable release to the universal plugin
directory.

## Development

```bash
npm run check
python3 /path/to/plugin-creator/scripts/validate_plugin.py plugins/flowstack-ui
```

See [the architecture boundary](docs/architecture.md) and
[release process](docs/releasing.md).
