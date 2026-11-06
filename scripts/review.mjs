#!/usr/bin/env node
// The automatic review of one persona or setup idea folder, wherever it
// lives (a pull request here, or a folder fetched from a submission). Every
// check is listed in docs/review.md; a person audits only what passes.
//
//   node scripts/review.mjs <folder> [--json]
//
// It reads text only and runs nothing from the folder: the same rules as
// scripts/check.mjs, grouped into named checks, against this repository's
// shared lists and catalog.
import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ideaProblems, listFiles, loadShared, personaProblems, readIdea, readPersona, ROOT } from "./check.mjs";

const MAX_FILES = 60;
const MAX_BYTES = 300_000;

/**
 * Which named check a problem from scripts/check.mjs belongs to, first match wins.
 * @type {[string, RegExp][]}
 */
const GROUPS = [
  ["content", /: (getting around an approval card|ignoring nanou's rules|hiding something from the family|asking for credentials|moving money|claiming a licence or a title|naming an AI company or model|a link|code or HTML|text styled as a system message|writing for children|code in backticks)|asks nanou to act/],
  ["languages", /i18n\//],
  ["files", /isn't allowed in an? (persona|idea) folder| is missing$|symlink|hidden file/],
  ["look", /look\.|accessory/],
  ["size", /renders to about|prompt\.md has \d+ words/],
  ["tests", /tests\.json/],
  ["refs", /handoffs:|isn't a persona|isn't in personas\/|isn't a connector|isn't a capability|safety "/],
];
const CHECKS = ["files", "schema", "refs", "content", "size", "look", "languages", "tests", "id"];

/**
 * Reviews one folder. A persona has persona.json, an idea has idea.json.
 * @param {string} folder @param {{ root?: string }} [opts]
 * @returns {{ id: string | undefined, kind: "persona" | "idea" | undefined, ok: boolean, checks: { name: string, ok: boolean, problems: string[] }[] }}
 */
export function review(folder, opts = {}) {
  const root = opts.root ?? ROOT;
  const dir = resolve(folder);
  const shared = loadShared(root);
  /** @type {Record<string, string[]>} */
  const found = Object.fromEntries(CHECKS.map((c) => [c, []]));
  const done = (/** @type {string | undefined} */ id, /** @type {"persona" | "idea" | undefined} */ kind) => {
    const checks = CHECKS.map((name) => ({ name, ok: !found[name].length, problems: found[name] }));
    return { id, kind, ok: checks.every((c) => c.ok), checks };
  };
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    found.files.push(`${folder} isn't a folder`);
    return done(undefined, undefined);
  }

  // Files first: what's there, how much, nothing hidden or linked.
  const files = listFiles(dir);
  let bytes = 0;
  for (const f of files) {
    if (f.endsWith("@")) found.files.push(`${f.slice(0, -1)} is a symlink`);
    else bytes += lstatSync(join(dir, f)).size;
    if (f.split("/").some((part) => part.startsWith("."))) found.files.push(`${f} is a hidden file`);
  }
  if (files.length > MAX_FILES) found.files.push(`${files.length} files, at most ${MAX_FILES}`);
  if (bytes > MAX_BYTES) found.files.push(`${bytes} bytes, at most ${MAX_BYTES}`);
  const kind = files.includes("persona.json") ? "persona" : files.includes("idea.json") ? "idea" : undefined;
  if (!kind) {
    found.files.push("neither persona.json nor idea.json: not a persona or an idea folder");
    return done(undefined, undefined);
  }

  // The catalog it joins: ids already taken, and labels for handoffs.
  const listed = (/** @type {string} */ sub) => (existsSync(join(root, sub)) ? readdirSync(join(root, sub)).filter((d) => statSync(join(root, sub, d)).isDirectory()) : []);
  const personaIds = new Set(listed("personas"));
  const ownId = basename(dir);
  const inRepo = (/** @type {string} */ sub) => dir === resolve(root, sub, ownId);
  /** @type {string[]} */
  let problems;
  let id;
  if (kind === "persona") {
    const f = readPersona(dir);
    id = f.persona?.id;
    if (!inRepo("personas") && personaIds.has(ownId)) found.id.push(`"${ownId}" is already a persona: pick another id, or change it here through a pull request`);
    personaIds.add(ownId);
    /** @type {Record<string, { label: string }>} */
    const labels = Object.fromEntries([...personaIds].map((p) => [p, { label: p === ownId ? (f.persona?.label ?? p) : (readPersona(join(root, "personas", p)).persona?.label ?? p) }]));
    for (const [look, owner] of [...personaIds].filter((p) => p !== ownId).map((p) => [readPersona(join(root, "personas", p)).persona?.look?.accessory, p]))
      if (look && look !== "own" && look === f.persona?.look?.accessory) found.look.push(`accessory ${look} is already worn by ${owner}: pick another or bring your own`);
    problems = personaProblems(f, ownId, shared, personaIds, labels);
  } else {
    const f = readIdea(dir);
    id = f.idea?.id;
    if (!inRepo("ideas") && listed("ideas").includes(ownId)) found.id.push(`"${ownId}" is already an idea: pick another id`);
    problems = ideaProblems(f, ownId, shared, personaIds);
  }
  for (const p of problems) {
    const msg = p.replace(/^(personas|ideas)\/[a-z-]+: /, "");
    const group = GROUPS.find(([, re]) => re.test(msg))?.[0] ?? "schema";
    found[group].push(msg);
  }
  return done(id, kind);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith("--"));
  if (!folder) {
    console.error("usage: node scripts/review.mjs <persona or idea folder> [--json]");
    process.exit(2);
  }
  const report = review(folder);
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    for (const c of report.checks) console.log(c.ok ? `ok ${c.name}` : `FAIL ${c.name}:\n  ${c.problems.join("\n  ")}`);
    console.log(report.ok ? `${report.id}: every check passed` : `${report.id ?? folder}: fix the above`);
  }
  process.exit(report.ok ? 0 : 1);
}
