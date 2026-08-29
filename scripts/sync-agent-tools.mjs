import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = await readJson(join(repositoryRoot, "config", "plugin.json"));
const { sourceVersion, pluginVersion } = readVersions(process.argv.slice(2));
const temporaryRoot = await mkdtemp(join(tmpdir(), "flowstack-plugin-sync-"));

try {
  const packOutput = execFileSync(
    "npm",
    [
      "pack",
      `@flowstack-ui/agent-tools@${sourceVersion}`,
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      temporaryRoot,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const [packed] = JSON.parse(packOutput);
  if (!packed || packed.name !== "@flowstack-ui/agent-tools" || packed.version !== sourceVersion) {
    fail("npm returned an unexpected Agent Tools archive");
  }

  const archivePath = join(temporaryRoot, basename(packed.filename));
  const extractedRoot = join(temporaryRoot, "extracted");
  await mkdir(extractedRoot);
  execFileSync("tar", ["-xzf", archivePath, "-C", extractedRoot], { stdio: "inherit" });

  const sourceRoot = join(extractedRoot, "package");
  const sourcePackage = await readJson(join(sourceRoot, "package.json"));
  const sourceManifestPath = join(sourceRoot, ".codex-plugin", "plugin.json");
  const sourceManifestBytes = await readFile(sourceManifestPath);
  const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8"));
  const sourceSkills = join(sourceRoot, "skills");

  if (sourcePackage.name !== "@flowstack-ui/agent-tools" || sourcePackage.version !== sourceVersion) {
    fail("packed package identity does not match the requested Agent Tools release");
  }
  if (sourceManifest.name !== config.pluginName || sourceManifest.version !== sourceVersion) {
    fail("Agent Tools plugin manifest identity does not match the requested release");
  }
  if ("mcpServers" in sourceManifest || "apps" in sourceManifest || "hooks" in sourceManifest) {
    fail("the public FLOWSTACK plugin must remain skills-only");
  }

  const discoveredSkills = (await readdir(sourceSkills, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const allowedSkills = [...config.allowedSkills].sort();
  if (JSON.stringify(discoveredSkills) !== JSON.stringify(allowedSkills)) {
    fail(`review the changed public skill set before syncing: ${discoveredSkills.join(", ")}`);
  }

  const stagedPlugin = join(temporaryRoot, config.pluginName);
  await mkdir(join(stagedPlugin, ".codex-plugin"), { recursive: true });
  await cp(sourceSkills, join(stagedPlugin, "skills"), { recursive: true });

  assertMcpConfig(config.mcp);
  const mcpConfig = {
    mcpServers: {
      [config.mcp.serverName]: {
        type: config.mcp.type,
        url: config.mcp.url,
      },
    },
  };
  const mcpConfigText = `${JSON.stringify(mcpConfig, null, 2)}\n`;
  await writeFile(join(stagedPlugin, config.mcp.path), mcpConfigText);

  for (const assetPath of Object.values(config.interfaceAssets)) {
    assertAssetPath(assetPath);
    const sourceAsset = resolve(repositoryRoot, assetPath);
    const stagedAsset = resolve(stagedPlugin, assetPath);
    assertContained(repositoryRoot, sourceAsset);
    assertContained(stagedPlugin, stagedAsset);
    await assertSquarePng(sourceAsset);
    await mkdir(dirname(stagedAsset), { recursive: true });
    await cp(sourceAsset, stagedAsset);
  }

  const pluginManifest = {
    ...sourceManifest,
    version: pluginVersion,
    repository: config.repository,
    mcpServers: `./${config.mcp.path}`,
    interface: {
      ...sourceManifest.interface,
      developerName: config.developerName,
      shortDescription: config.shortDescription,
      privacyPolicyURL: config.privacyPolicyURL,
      termsOfServiceURL: config.termsOfServiceURL,
      composerIcon: `./${config.interfaceAssets.composerIcon}`,
      logo: `./${config.interfaceAssets.logo}`,
      capabilities: [...new Set([...(sourceManifest.interface.capabilities ?? []), "MCP"])],
    },
  };
  const pluginManifestText = `${JSON.stringify(pluginManifest, null, 2)}\n`;
  await writeFile(join(stagedPlugin, ".codex-plugin", "plugin.json"), pluginManifestText);

  const skillDigest = await digestTree(join(stagedPlugin, "skills"));
  const assetDigest = await digestTree(join(stagedPlugin, "assets"));
  const finalManifestDigest = sha256(Buffer.from(pluginManifestText));
  const sourceLock = {
    schema: "flowstack.plugin-source-lock.v3",
    package: packed.name,
    version: packed.version,
    pluginVersion,
    integrity: packed.integrity,
    shasum: packed.shasum,
    sourcePluginManifestSha256: sha256(sourceManifestBytes),
    pluginManifestSha256: finalManifestDigest,
    mcpConfigSha256: sha256(Buffer.from(mcpConfigText)),
    skillsSha256: skillDigest,
    assetsSha256: assetDigest,
  };

  const pluginRoot = resolve(repositoryRoot, "plugins", config.pluginName);
  assertContained(repositoryRoot, pluginRoot);
  const previousRoot = `${pluginRoot}.previous`;
  await rm(previousRoot, { recursive: true, force: true });
  if (await exists(pluginRoot)) await rename(pluginRoot, previousRoot);
  try {
    await rename(stagedPlugin, pluginRoot);
    await rm(previousRoot, { recursive: true, force: true });
  } catch (error) {
    if (await exists(previousRoot) && !(await exists(pluginRoot))) await rename(previousRoot, pluginRoot);
    throw error;
  }

  const packageJsonPath = join(repositoryRoot, "package.json");
  const packageJson = await readJson(packageJsonPath);
  packageJson.version = pluginVersion;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  const packageLockPath = join(repositoryRoot, "package-lock.json");
  if (await exists(packageLockPath)) {
    const packageLock = await readJson(packageLockPath);
    packageLock.version = pluginVersion;
    if (packageLock.packages?.[""]) packageLock.packages[""].version = pluginVersion;
    await writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
  }
  await mkdir(join(repositoryRoot, "sources"), { recursive: true });
  await writeFile(join(repositoryRoot, "sources", "agent-tools.json"), `${JSON.stringify(sourceLock, null, 2)}\n`);

  console.log(`Synced ${packed.name}@${packed.version} into ${config.pluginName}@${pluginVersion}`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function readVersions(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!new Set(["--version", "--plugin-version"]).has(flag) || !value || values.has(flag)) {
      fail("usage: npm run sync -- --version <exact-agent-tools-version> [--plugin-version <exact-plugin-version>]");
    }
    values.set(flag, value);
  }
  const sourceVersion = values.get("--version");
  const pluginVersion = values.get("--plugin-version") ?? sourceVersion;
  if (!sourceVersion || !isExactVersion(sourceVersion) || !isExactVersion(pluginVersion)) {
    fail("source and plugin versions must be exact semantic versions");
  }
  return { sourceVersion, pluginVersion };
}

function isExactVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version);
}

function assertAssetPath(path) {
  if (typeof path !== "string" || !/^assets\/[0-9A-Za-z._-]+\.png$/u.test(path)) {
    fail(`interface asset must be a PNG directly under assets/: ${path}`);
  }
}

function assertMcpConfig(value) {
  if (value?.path !== ".mcp.json" || value.serverName !== "flowstack-ui" || value.type !== "http") {
    fail("review the FLOWSTACK MCP plugin configuration before syncing");
  }
  const url = new URL(value.url);
  if (url.protocol !== "https:" || url.origin !== "https://agents.brick-ui.com" || url.pathname !== "/mcp" || url.search || url.hash) {
    fail("FLOWSTACK MCP must use the reviewed canonical HTTPS endpoint");
  }
}

async function assertSquarePng(path) {
  const content = await readFile(path);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (content.length < 24 || !content.subarray(0, 8).equals(signature)) {
    fail(`interface asset is not a valid PNG: ${path}`);
  }
  const width = content.readUInt32BE(16);
  const height = content.readUInt32BE(20);
  if (width === 0 || width !== height) fail(`interface asset must be square: ${path}`);
}

async function digestTree(root) {
  const files = await filesBelow(root);
  const digest = createHash("sha256");
  for (const path of files) {
    const relativePath = relative(root, path).split(sep).join("/");
    const content = await readFile(path);
    digest.update(relativePath);
    digest.update("\0");
    digest.update(content);
    digest.update("\0");
  }
  return digest.digest("hex");
}

async function filesBelow(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
    else fail(`unsupported plugin archive entry: ${path}`);
  }
  return files.sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  return stat(path).then(() => true).catch(() => false);
}

function assertContained(root, target) {
  const relation = relative(root, target);
  if (!relation || relation === ".." || relation.startsWith(`..${sep}`)) {
    fail(`refusing to replace path outside the plugin repository: ${target}`);
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function fail(message) {
  throw new Error(message);
}
