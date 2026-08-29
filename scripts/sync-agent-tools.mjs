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
const requestedVersion = readVersion(process.argv.slice(2));
const temporaryRoot = await mkdtemp(join(tmpdir(), "flowstack-plugin-sync-"));

try {
  const packOutput = execFileSync(
    "npm",
    [
      "pack",
      `@flowstack-ui/agent-tools@${requestedVersion}`,
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      temporaryRoot,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const [packed] = JSON.parse(packOutput);
  if (!packed || packed.name !== "@flowstack-ui/agent-tools" || packed.version !== requestedVersion) {
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

  if (sourcePackage.name !== "@flowstack-ui/agent-tools" || sourcePackage.version !== requestedVersion) {
    fail("packed package identity does not match the requested Agent Tools release");
  }
  if (sourceManifest.name !== config.pluginName || sourceManifest.version !== requestedVersion) {
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

  const pluginManifest = {
    ...sourceManifest,
    repository: config.repository,
    interface: {
      ...sourceManifest.interface,
      privacyPolicyURL: config.privacyPolicyURL,
      termsOfServiceURL: config.termsOfServiceURL,
    },
  };
  const pluginManifestText = `${JSON.stringify(pluginManifest, null, 2)}\n`;
  await writeFile(join(stagedPlugin, ".codex-plugin", "plugin.json"), pluginManifestText);

  const skillDigest = await digestTree(join(stagedPlugin, "skills"));
  const finalManifestDigest = sha256(Buffer.from(pluginManifestText));
  const sourceLock = {
    schema: "flowstack.plugin-source-lock.v1",
    package: packed.name,
    version: packed.version,
    integrity: packed.integrity,
    shasum: packed.shasum,
    sourcePluginManifestSha256: sha256(sourceManifestBytes),
    pluginManifestSha256: finalManifestDigest,
    skillsSha256: skillDigest,
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
  packageJson.version = requestedVersion;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  const packageLockPath = join(repositoryRoot, "package-lock.json");
  if (await exists(packageLockPath)) {
    const packageLock = await readJson(packageLockPath);
    packageLock.version = requestedVersion;
    if (packageLock.packages?.[""]) packageLock.packages[""].version = requestedVersion;
    await writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
  }
  await mkdir(join(repositoryRoot, "sources"), { recursive: true });
  await writeFile(join(repositoryRoot, "sources", "agent-tools.json"), `${JSON.stringify(sourceLock, null, 2)}\n`);

  console.log(`Synced ${packed.name}@${packed.version} into plugins/${config.pluginName}`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function readVersion(arguments_) {
  if (arguments_.length !== 2 || arguments_[0] !== "--version") {
    fail("usage: npm run sync -- --version <exact-version>");
  }
  const version = arguments_[1];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
    fail("--version must be one exact semantic version");
  }
  return version;
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
