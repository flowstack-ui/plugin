# FLOWSTACK UI Plugin

Installable Codex and ChatGPT workflows for building, composing, reviewing,
and maintaining FLOWSTACK interfaces.

This repository is a distribution adapter. The exact public skills remain
owned and released by
[`@flowstack-ui/agent-tools`](https://github.com/flowstack-ui/agent-tools).
The plugin vendors one reviewed Agent Tools release, records its npm integrity,
and deliberately excludes MCP configuration, paid Blocks source, private
Blueprints, and product research.

## Install for local development

Add this checkout as a local marketplace once, then install the plugin:

```bash
codex plugin marketplace add /absolute/path/to/plugin
codex plugin add flowstack-ui@flowstack-ui
```

Refresh Codex and start a new task. The plugin contributes four explicit
skills:

- `$flowstack-ui-builder`
- `$flowstack-ui-compose`
- `$flowstack-ui-review`
- `$flowstack-ui-maintainer`

The skills resolve Agent Knowledge from the exact FLOWSTACK packages installed
in the target project. The standalone LLM and MCP surfaces remain available at
[`agents.brick-ui.com`](https://agents.brick-ui.com).

## Update the plugin

Sync one exact published Agent Tools version:

```bash
npm run sync -- --version 0.1.0
npm run check
```

The sync command downloads the npm archive without running lifecycle scripts,
validates the package and skills-only plugin boundary, stages the replacement,
and records npm integrity plus content digests in `sources/agent-tools.json`.
A changed public skill set fails until `config/plugin.json` is reviewed.

Plugin releases use the same version as their locked Agent Tools source. Review
the generated skill and manifest diff, run the repository check, commit, tag,
and reinstall from the local marketplace before submitting that version to the
universal plugin directory.

## Development

```bash
npm run check
python3 /path/to/plugin-creator/scripts/validate_plugin.py plugins/flowstack-ui
```

See [the architecture boundary](docs/architecture.md) and
[release process](docs/releasing.md).
