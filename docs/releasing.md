# Releasing the FLOWSTACK Plugin

1. Confirm the intended `@flowstack-ui/agent-tools` version is published with
   provenance and its repository release is green.
2. Run `npm run sync -- --version <exact-agent-tools-version>`. By default the
   plugin takes the same version. For a packaging-only patch, add
   `--plugin-version <exact-plugin-version>` while preserving the source lock.
3. Review `sources/agent-tools.json`, the plugin manifest, and every vendored
   skill and interface-asset diff. Deliberately approve any changed skill
   inventory in `config/plugin.json`.
4. Run `npm run check` and the OpenAI plugin validator.
5. Install from the repository marketplace, refresh Codex, and test each skill
   in a new task against an exact-version FLOWSTACK consumer.
6. Commit the generated snapshot and tag `v<plugin-version>`.
7. Submit that immutable tagged version to the universal plugin directory.

During same-version local iteration, use the OpenAI Plugin Creator cachebuster
workflow and reinstall from the `flowstack-ui` marketplace. Do not commit a
local cachebuster as a release version.
