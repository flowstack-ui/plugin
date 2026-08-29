import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = await readJson(join(root, "config", "plugin.json"));
const packageJson = await readJson(join(root, "package.json"));
const packageLock = await readJson(join(root, "package-lock.json"));
const marketplace = await readJson(join(root, ".agents", "plugins", "marketplace.json"));
const pluginRoot = join(root, "plugins", config.pluginName);
const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const source = await readJson(join(root, "sources", "agent-tools.json"));

assert.equal(config.schema, "flowstack.plugin-config.v1");
assert.equal(marketplace.name, config.marketplaceName);
assert.equal(marketplace.interface.displayName, "FLOWSTACK UI");
assert.equal(marketplace.plugins.length, 1);
assert.deepEqual(marketplace.plugins[0], {
  name: config.pluginName,
  source: { source: "local", path: `./plugins/${config.pluginName}` },
  policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
  category: "Developer Tools",
});

assert.equal(manifest.name, config.pluginName);
assert.equal(manifest.version, packageJson.version);
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages[""].version, packageJson.version);
assert.equal(manifest.version, source.version);
assert.equal(manifest.repository, config.repository);
assert.equal(manifest.skills, "./skills/");
assert.equal(manifest.interface.displayName, "FLOWSTACK UI");
assert.equal(manifest.interface.category, "Developer Tools");
assert.equal(manifest.interface.privacyPolicyURL, config.privacyPolicyURL);
assert.equal(manifest.interface.termsOfServiceURL, config.termsOfServiceURL);
assert.deepEqual(manifest.interface.capabilities, ["Skills"]);
assert.equal("mcpServers" in manifest, false);
assert.equal("apps" in manifest, false);
assert.equal("hooks" in manifest, false);

assert.equal(source.schema, "flowstack.plugin-source-lock.v1");
assert.equal(source.package, "@flowstack-ui/agent-tools");
for (const field of ["sourcePluginManifestSha256", "pluginManifestSha256", "skillsSha256"]) {
  assert.match(source[field], /^[a-f0-9]{64}$/u);
}
assert.equal(sha256(manifestBytes), source.pluginManifestSha256);

const skillsRoot = join(pluginRoot, "skills");
const skills = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.deepEqual(skills, [...config.allowedSkills].sort());
for (const name of skills) {
  const files = await filesBelow(join(skillsRoot, name));
  assert.deepEqual(files.map((path) => relative(join(skillsRoot, name), path).split(sep).join("/")), [
    "SKILL.md",
    "agents/openai.yaml",
    "scripts/resolve-agent-knowledge.mjs",
  ]);
  const skill = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
  assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`, "u"));
}
assert.equal(await digestTree(skillsRoot), source.skillsSha256);

const allText = `${manifestBytes.toString("utf8")}\n${await Promise.all((await filesBelow(skillsRoot)).map((path) => readFile(path, "utf8"))).then((parts) => parts.join("\n"))}`;
assert.doesNotMatch(allText, /(?:BEGIN PRIVATE|\/Users\/|\/private\/tmp\/|customer-name-placeholder)/u);
assert.doesNotMatch(allText, /\[TODO(?::|\])/u);

console.log(`Verified ${manifest.name}@${manifest.version}: ${skills.length} skills, skills-only plugin, exact Agent Tools lock`);

async function digestTree(treeRoot) {
  const digest = createHash("sha256");
  for (const path of await filesBelow(treeRoot)) {
    const relativePath = relative(treeRoot, path).split(sep).join("/");
    digest.update(relativePath);
    digest.update("\0");
    digest.update(await readFile(path));
    digest.update("\0");
  }
  return digest.digest("hex");
}

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
    else assert.fail(`unsupported plugin entry: ${path}`);
  }
  return files.sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}
