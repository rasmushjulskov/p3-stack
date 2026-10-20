#!/usr/bin/env node
// Builds skills/ from pstack at the commit pinned in pstack.lock.json, plus the T3 Code adapter.
//
//   node scripts/generate.mjs                 regenerate skills/
//   node scripts/generate.mjs --check         fail if skills/ is out of date
//   node scripts/generate.mjs --bump [ref]    pin pstack to ref (default main), then regenerate
//   node scripts/generate.mjs --source DIR    use a local pstack/ folder instead of the pin

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_PATH = join(ROOT, "pstack.lock.json");
const OUT = join(ROOT, "skills");
const CACHE = join(ROOT, ".cache", "cursor-plugins");
const ADAPTER_SOURCE = join(ROOT, "docs", "harness", "t3-code.md");
// The adapter sits at this path inside pstack's layout, so its links read the same here and upstream.
const ADAPTER = "docs/harness/t3-code.md";
// Files the adapter ships beside itself, such as T3 versions of pstack examples. They land in the harness folder.
const EXTRAS = "docs/harness/t3-code";
const EXTRAS_SOURCE = join(ROOT, EXTRAS);
const HARNESS = "pstack-t3";
const COMMAND = "node scripts/generate.mjs";
// Inline links, with or without a title, and reference definitions. The destination is group 2.
const LINK = /(\]\(<?)([^)\s>]+)(>?(?:\s+(?:"[^"]*"|'[^']*'))?\))|(^[ ]{0,3}\[[^\]]+\]:[ \t]*<?)([^\s>]+)/gm;
function rewriteLinks(text, rewrite) {
  return text.replace(LINK, (whole, open, inline, close, refOpen, ref) =>
    inline !== undefined ? `${open}${rewrite(inline)}${close}` : `${refOpen}${rewrite(ref)}`,
  );
}

// Each key must appear verbatim in the first cell of an adapter row, or in a heading. A skill whose text matches any pattern gets the adapter line.
const TERMS = [
  { key: "`Task`", re: /`Task`|\bTask (tool|subagent|call|spawn)/ },
  { key: "subagent_type", re: /subagent_type/ },
  { key: "`AskQuestion`", re: /AskQuestion/ },
  { key: "todolist", re: /\btodo ?list\b/i },
  { key: "generalPurpose", re: /generalPurpose/ },
  { key: "poteto-agent", re: /poteto-agent/ },
  { key: "comment-sicko", re: /comment-sicko/ },
  { key: "`readonly: true`", re: /readonly: (true|false)|readonly\/Ask|\breadonly\b/ },
  { key: "`environment: \"cloud\"`", re: /environment: "(cloud|local)"/ },
  { key: "cloud_base_branch", re: /cloud_base_branch/ },
  { key: "`run_in_background: true`", re: /run_in_background|is_background/ },
  { key: "`resume`", re: /`resume`|\bresume (an|the) agent\b/i },
  { key: "`file_attachments`", re: /file_attachments/ },
  { key: "claude-", re: /\bclaude-[a-z]+-\d/ },
  { key: "grok-", re: /\b(cursor-)?grok-\d|\bcomposer-/ },
  { key: "gpt-", re: /\bgpt-\d/ },
  { key: "inherit-parent", re: /inherit-parent|`auto`/ },
  { key: "pstack-models.mdc", re: /pstack-models\.mdc/ },
  { key: ".cursor/skills/", re: /\.cursor\/skills/ },
  { key: "~/.cursor/plugins/", re: /\.cursor\/plugins|\.cursor-plugin/ },
  { key: ".cursor/rules/", re: /\.cursor\/rules|always-applied rule/ },
  { key: ".cursor/worktrees/", re: /\.cursor\/worktrees/ },
  { key: "The current agent's store", re: /agent's store|agent store/ },
  { key: "agent-transcripts", re: /agent-transcripts|\.cursor\/projects/ },
  { key: "`pstack/skills/<path>`", re: /\bpstack\/skills\// },
  { key: "/loop", re: /\/loop\b/ },
  { key: "make-bot-ui", re: /Grok Bot|X-Automation-Key|Routines list/ },
  { key: "Bugbot", re: /Bugbot/ },
  { key: "Cursor Automations", re: /Cursor [Aa]utomation|cursor\.(sh|com)\/automations|update_state|SendToUser|scheduled automation|automation pack/ },
  { key: "cloud agent", re: /[Cc]loud[- ][Aa]gent|cloud VM|Cursor dashboard/ },
  { key: "built-in PR tool", re: /built-in PR tool/ },
  { key: "control-ui", re: /control-(ui|cli)/ },
  { key: "cursor-team-kit", re: /cursor-team-kit|`deslop`|\/deslop/ },
  { key: "create-skill", re: /\bcreate-skill\b/ },
  { key: "Custom Modes", re: /[Cc]ustom [Mm]odes?|[Oo]ption\+[Ee]nter|Agents Window|Plan Mode/ },
  { key: "Any other Cursor name", re: /\bCursor\b/ },
];

const SCRIPT_TERM = { key: "A bundled script that reads `~/.cursor/`", re: /\.cursor\// };

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

function git(cwd, ...argv) {
  return execFileSync("git", argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

function readLock() {
  return JSON.parse(readFileSync(LOCK_PATH, "utf8"));
}

// A sparse, shallow checkout of the pinned commit. Reused while it already sits at that commit.
function checkout(lock) {
  if (!existsSync(join(CACHE, ".git"))) {
    mkdirSync(CACHE, { recursive: true });
    git(CACHE, "init", "-q");
    git(CACHE, "remote", "add", "origin", lock.repository);
    git(CACHE, "sparse-checkout", "set", lock.path);
  }
  const head = existsSync(join(CACHE, ".git", "HEAD")) ? tryGit(CACHE, "rev-parse", "HEAD") : undefined;
  if (head !== lock.commit) {
    git(CACHE, "fetch", "-q", "--depth=1", "--filter=blob:none", "origin", lock.commit);
    git(CACHE, "checkout", "-q", "--detach", lock.commit);
  }
  return join(CACHE, lock.path);
}

function tryGit(cwd, ...argv) {
  try {
    return execFileSync("git", argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

function pstackVersion(source) {
  for (const manifest of ["plugin.json", ".cursor-plugin/plugin.json"]) {
    const path = join(source, manifest);
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")).version;
  }
  return "unknown";
}

function bump(ref) {
  const lock = readLock();
  const line = git(ROOT, "ls-remote", lock.repository, ref.startsWith("refs/") ? ref : `refs/heads/${ref}`);
  const commit = line.split(/\s+/)[0] || (/^[0-9a-f]{40}$/.test(ref) ? ref : undefined);
  if (!commit) throw new Error(`No commit found for ${ref} in ${lock.repository}`);
  const next = { ...lock, commit };
  next.version = pstackVersion(checkout(next));
  writeFileSync(LOCK_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`pinned pstack ${next.version} at ${commit}`);
  return next;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function file(path) {
  return { bytes: readFileSync(path), executable: (statSync(path).mode & 0o111) !== 0 };
}

// Where a pstack-relative path lands in the tree, relative to skills/. Undefined means the tree leaves it out.
function place(path) {
  if (path.startsWith("skills/")) return path.slice("skills/".length);
  if (path.startsWith("agents/")) return `${HARNESS}/${path}`;
  if (path.startsWith("docs/guide/") || path === "docs/guide") return `${HARNESS}/guide${path.slice("docs/guide".length)}`;
  if (path === ADAPTER) return `${HARNESS}/SKILL.md`;
  if (path.startsWith(`${EXTRAS}/`)) return `${HARNESS}/${path.slice(EXTRAS.length + 1)}`;
  if (path === "README.md" || path === "LICENSE") return `${HARNESS}/${path}`;
  return undefined;
}

if (flag("--check") && (flag("--bump") || flag("--source"))) {
  console.log("FAIL --check verifies the committed pin. Run it without --bump or --source.");
  process.exit(1);
}

const lock = flag("--bump") ? bump(option("--bump") && !option("--bump").startsWith("--") ? option("--bump") : "main") : readLock();
const SOURCE = option("--source") ?? checkout(lock);
const GITHUB = `${lock.repository.replace(/\.git$/, "")}`;
const version = option("--source") ? pstackVersion(SOURCE) : lock.version;
const skills = readdirSync(join(SOURCE, "skills")).filter((name) => existsSync(join(SOURCE, "skills", name, "SKILL.md")));
const adapter = readFileSync(ADAPTER_SOURCE, "utf8");
const problems = [];

if (skills.includes(HARNESS)) problems.push(`pstack now ships a skill named ${HARNESS}. Rename the harness folder.`);

// A skill that names another skill without linking it needs the adapter's row for running one.
const ROUTE_KEY = "Run another pstack skill";
function namesBareSkill(skill, text) {
  const others = skills.filter((name) => name !== skill).join("|");
  const route = new RegExp(`the \\*\\*(?<bold>${others})\\*\\* skill|\`/(?<command>${others})\``, "g");
  return text.split("\n").some((line) =>
    [...line.matchAll(route)].some(({ groups }) => !line.includes(`(../${groups.bold ?? groups.command}/`)),
  );
}

// Which Cursor names each skill uses. Playbooks and references count toward their skill.
const usage = new Map();
for (const skill of skills) {
  const used = new Set();
  for (const path of walk(join(SOURCE, "skills", skill)).filter((path) => path.endsWith(".md"))) {
    const text = readFileSync(path, "utf8");
    for (const term of TERMS) if (term.re.test(text)) used.add(term.key);
    if (namesBareSkill(skill, text)) used.add(ROUTE_KEY);
  }
  // Bundled scripts cannot read the adapter, so a Cursor path in one needs its own row.
  for (const path of walk(join(SOURCE, "skills", skill)).filter((path) => !path.endsWith(".md"))) {
    if (SCRIPT_TERM.re.test(readFileSync(path, "utf8"))) used.add(SCRIPT_TERM.key);
  }
  usage.set(`skills/${skill}/SKILL.md`, used);
}
for (const path of walk(join(SOURCE, "agents")).filter((path) => path.endsWith(".md"))) {
  const text = readFileSync(path, "utf8");
  usage.set(relative(SOURCE, path), new Set(TERMS.filter((term) => term.re.test(text)).map((term) => term.key)));
}

// A row is a table line's first cell or a heading. A key that only appears in passing prose does not count.
const rows = [...adapter.matchAll(/^\|([^|]*)\||^#+ (.*)$/gm)].map(([, cell, heading]) => (cell ?? heading).trim());
const users = new Map();
for (const [path, used] of usage) for (const key of used) users.set(key, [...(users.get(key) ?? []), path]);
for (const [key, using] of users) {
  if (!rows.some((row) => row.includes(key))) problems.push(`the T3 adapter has no row for ${key}, used by ${using.join(", ")}`);
}
for (const skill of skills) {
  const frontmatter = readFileSync(join(SOURCE, "skills", skill, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const name = frontmatter.match(/^name:(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  if (name !== skill) problems.push(`skills/${skill}/SKILL.md has name ${JSON.stringify(name ?? "")}, not ${skill}`);
}

// The pstack-relative path a relative link in `from` points at, if that path exists in pstack or is the adapter.
function resolve(from, href) {
  const target = href.replace(/[#?].*/, "");
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) return undefined;
  const path = posix.join(posix.dirname(from), target).replace(/\/$/, "");
  if (path === ADAPTER) return path;
  if (path === EXTRAS || path.startsWith(`${EXTRAS}/`)) return existsSync(join(ROOT, path)) ? path : undefined;
  return existsSync(join(SOURCE, path)) ? path : undefined;
}

function adapterLine(from) {
  const href = posix.relative(posix.dirname(from), ADAPTER);
  return (
    `In T3 Code, read [the T3 Code adapter](${href}) once per session before you follow this skill. ` +
    "It maps the Cursor names in pstack to T3 Code."
  );
}

const mapped = [];
const broken = [];
// A bare word such as `url` is a template placeholder, not a file.
const placeholder = (target) => !/[./]/.test(target);

function render() {
  // Keyed by pstack-relative path. Rewritten to tree paths at the end.
  const sources = new Map();
  for (const path of [...walk(join(SOURCE, "skills")), ...walk(join(SOURCE, "agents")), ...walk(join(SOURCE, "docs", "guide"))]) {
    sources.set(relative(SOURCE, path), file(path));
  }
  for (const name of ["README.md", "LICENSE"]) sources.set(name, file(join(SOURCE, name)));
  if (existsSync(EXTRAS_SOURCE)) for (const path of walk(EXTRAS_SOURCE)) sources.set(relative(ROOT, path), file(path));

  const description = "Maps the Cursor names in pstack skills to T3 Code tools. Read it once per session before you follow a pstack skill.";
  const pin = `<!-- Generated by ${COMMAND} from pstack ${version} (${option("--source") ? "local source" : lock.commit}). -->`;
  sources.set(ADAPTER, {
    bytes: Buffer.from(`---\nname: ${HARNESS}\ndescription: ${description}\ndisable-model-invocation: true\n---\n\n${pin}\n\n${adapter}`),
    executable: false,
  });

  let wrapped = 0;
  for (const [path, used] of usage) {
    // Agent briefs are pasted into a child's task, where a relative link means nothing. The adapter's row covers them.
    if (used.size === 0 || path.startsWith("agents/")) continue;
    const entry = sources.get(path);
    const text = entry.bytes.toString("utf8");
    if (!/^# /m.test(text)) {
      problems.push(`${path} uses Cursor names but has no H1 to put the adapter line under`);
      continue;
    }
    entry.bytes = Buffer.from(text.replace(/^(# .*)\n+/m, `$1\n\n${adapterLine(path)}\n\n`));
    wrapped += 1;
  }

  const tree = new Map();
  for (const [path, entry] of sources) {
    const at = place(path);
    if (!at) continue;
    if (path.endsWith(".md")) {
      const text = rewriteLinks(entry.bytes.toString("utf8"), (href) => {
        const target = resolve(path, href);
        if (!target) {
          const bare = href.replace(/[#?].*/, "");
          if (bare && !/^[a-z][a-z0-9+.-]*:/i.test(bare) && !bare.startsWith("/") && !placeholder(bare)) {
            broken.push(`${path} links to ${href}, which does not exist in pstack`);
          }
          return href;
        }
        const suffix = href.slice(href.search(/[#?]|$/));
        const landed = place(target);
        if (landed) {
          mapped.push({ from: at, landed, href });
          return `${posix.relative(posix.dirname(at), landed) || "."}${suffix}`;
        }
        const kind = statSync(join(SOURCE, target)).isDirectory() ? "tree" : "blob";
        return `${GITHUB}/${kind}/${option("--source") ? "main" : lock.commit}/${lock.path}/${target}${suffix}`;
      });
      entry.bytes = Buffer.from(text);
    }
    tree.set(at, entry);
  }
  tree.set(
    `${HARNESS}/pstack.json`,
    { bytes: Buffer.from(`${JSON.stringify({ version, commit: option("--source") ? null : lock.commit, repository: lock.repository }, null, 2)}\n`), executable: false },
  );
  return { tree, wrapped };
}

const { tree, wrapped } = render();

for (const link of broken) problems.push(link);

// Every link that resolved in pstack must still resolve in the tree.
for (const { from, landed, href } of mapped) {
  if (!tree.has(landed) && ![...tree.keys()].some((key) => key.startsWith(`${landed}/`))) {
    problems.push(`skills/${from} links to ${href}, which is not in the tree`);
  }
}

for (const problem of problems) console.log(`FAIL ${problem}`);
if (problems.length > 0) process.exit(1);

if (flag("--check")) {
  const onDisk = new Map(existsSync(OUT) ? walk(OUT).map((path) => [relative(OUT, path), file(path)]) : []);
  const drifted = [...new Set([...tree.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [tree.get(path), onDisk.get(path)];
    return !want || !have || !want.bytes.equals(have.bytes) || want.executable !== have.executable;
  });
  for (const path of drifted.slice(0, 20)) console.log(`skills/${path}`);
  if (drifted.length > 0) {
    console.log(`skills/ is out of date. Run \`${COMMAND}\` and commit the result.`);
    process.exit(1);
  }
  console.log(`skills/ is up to date with pstack ${version}.`);
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [path, { bytes, executable }] of tree) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), bytes);
    chmodSync(join(OUT, path), executable ? 0o755 : 0o644);
  }
  console.log(`pstack ${version}: ${skills.length} skills, ${wrapped} files with the adapter line, written to skills/`);
}
