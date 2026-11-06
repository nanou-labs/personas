#!/usr/bin/env node
// Validates every persona and setup idea against docs/persona.md and
// docs/ideas.md, then builds index.json: the one catalog nanou's sync reads
// at the pinned commit.
//
//   node scripts/check.mjs           validate, then write index.json
//   node scripts/check.mjs --check   validate, and fail if index.json is out of date (CI)
//
// The rules are exported so scripts/review.mjs and the tests use the same ones.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The languages nanou ships besides English (English is persona.json itself). */
export const LOCALES = ["fr", "es", "de", "it", "pt", "bg", "cs", "da", "el", "et", "fi", "ga", "hr", "hu", "lt", "lv", "mt", "nl", "pl", "ro", "sk", "sl", "sv", "tr"];
export const ID = /^[a-z][a-z-]{1,23}$/;
const COLOR = /^#[0-9A-Fa-f]{6}$/;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const VOICE = {
  length: ["short", "medium"],
  formality: ["casual", "neutral", "formal"],
  humour: ["none", "light"],
  emoji: ["none", "light"],
};
/** Categories whose personas must include at least one safety block. */
const SAFETY_REQUIRED = ["health", "money"];

/** Character limits on the English words, and on their translations (languages run longer). */
export const MAX = {
  name: [32, 48],
  label: [40, 64],
  does: [48, 64],
  greeting: [280, 360],
  question: [120, 160],
  routineTitle: [40, 56],
  routineDoes: [120, 160],
  limit: [160],
  handoff: [80],
  ideaTitle: [60, 80],
  ideaBlurb: [140, 180],
  ideaSample: [160, 210],
  ideaFirstMessage: [400, 520],
};
export const MAX_PROMPT_WORDS = 250;
export const MAX_RENDER_WORDS = 450;
const MAX_SAFETY_WORDS = 90;

/** The mascot's outline color: a persona's color sits right against it. */
export const OUTLINE = "#1f1b16";
export const MIN_CONTRAST = 3;

/** nanou's own built-in names a prompt may mention in backticks (nothing else is code). */
const BUILTIN_NAMES = ["family_todo"];

// ---------------------------------------------------------------- content bans

/**
 * What no persona or idea text may contain (docs/persona.md, "Not allowed").
 * `negatable` rules are skipped in a sentence that says never/don't/no: a
 * limit like "never ask for passwords" is the rule working, not breaking.
 * @type {{ name: string, re: RegExp, negatable?: boolean }[]}
 */
export const BANS = [
  { name: "getting around an approval card", re: /\b(skip|bypass|get around|avoid|without)\b[^.?!]{0,40}\b(approval|approve|card|confirm(ation)?|asking (the family|first|them))\b/i },
  { name: "getting around an approval card", re: /\b(send|post|pay|book|delete)\b[^.?!]{0,20}\bwithout (asking|telling|approval)\b/i },
  { name: "ignoring nanou's rules", re: /\b(ignore|disregard|forget|override)\b[^.?!]{0,30}\b(rules?|instructions?|guard|system|previous)\b/i },
  { name: "hiding something from the family", re: /\b(hide|keep secret|don't tell|do not tell|without telling)\b[^.?!]{0,30}\b(family|parents?|partner|owner|them)\b/i },
  { name: "asking for credentials", negatable: true, re: /\b(ask|send|share|give|type|enter|paste|tell)\b[^.?!]{0,40}\b(passwords?|passcodes?|PIN|card numbers?|CVV|CVC|seed phrases?|recovery phrases?|private keys?|one-time codes?|2FA|security codes?)\b/i },
  { name: "moving money", negatable: true, re: /\b(transfer|wire|send|move)\b[^.?!]{0,15}\b(money|funds|payment|crypto)\b/i },
  { name: "moving money", negatable: true, re: /\b(make|execute|place|process)\b[^.?!]{0,15}\b(payments?|transfers?|trades?)\b/i },
  { name: "moving money", negatable: true, re: /\bpay (the|their|your|a|this)\b[^.?!]{0,15}\b(bill|invoice|fine|deposit)s?\b/i },
  { name: "claiming a licence or a title", re: /\b(I am|I'm|you are|you're) (a |an |their |your )?(licensed|certified|registered|chartered|accredited|board-certified|qualified)\b/i },
  { name: "claiming a licence or a title", re: /(^|[\s(])(Dr\.?|Doctor|Maître|Me\.|CPA|Esq\.?|Prof\.)\s+[A-Z]/ },
  { name: "a link", re: /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(com|org|net|io|ai|app|dev)\b/i },
  { name: "code or HTML", re: /```|<\/?[a-zA-Z!][^>]*>|\{\{|\}\}|<\||\|>/ },
  { name: "text styled as a system message", re: /\[(family-guard|system|nanou|admin|developer)\b[^\]]*\]|^\s*#{1,6}\s*(system|developer|instructions?)\b|^\s*(system|assistant|developer)\s*:/im },
  { name: "writing for children", re: /\b(talk|speak|write|reply|answer|chat)(ing|s)?\s+(directly\s+)?to\s+(the\s+|a\s+)?(kids?|child(ren)?|minors?|teens?|teenagers?)\b/i },
  { name: "writing for children", re: /\b(hey|hi|hello),?\s+(kids|kiddo|little one)\b|\bfor (kids|children) to (use|read|talk)\b|\bwhen talking to (kids|children)\b/i },
];
const NEGATION = /\b(never|not|no|don't|doesn't|won't|can't|cannot|nothing|nobody|refuse[sd]?|avoid)\b/i;

/**
 * AI companies and models no text may name, kept as fingerprints (the first
 * 16 hex digits of the SHA-256 of the name, case-sensitive) so this public
 * repository doesn't spell them out. A word is checked by its leading
 * letters: "Name-4o" is checked as "Name". Case-sensitive on purpose, so a
 * Spanish "llama" ("call") passes. To add one:
 * `printf '%s' Name | sha256sum | cut -c1-16`.
 */
export const AI_NAMES = new Set([
  "8b7d1a3187ab355d", "744205e43529c1fc", "0615570f9ea13694", "50a4122943273ad2", "2c4e6f6c46954cd6",
  "f6ece80b88d6dfbd", "fbef39c347a54191", "0cb39762e6f13f49", "be78f66375da41b7", "49f5b0e488cfa66c",
  "0648d2111ec0ca3d", "dca61d32363b091b", "28a5651e858aeea9", "f394cc2a6da7dfd6",
]);

/** The fingerprint of a word, as AI_NAMES holds them. @param {string} word */
export const fingerprint = (word) => createHash("sha256").update(word).digest("hex").slice(0, 16);

/**
 * The first word of `text` whose fingerprint is in `names`, or null.
 * @param {string} text @param {Set<string>} [names]
 */
export function aiName(text, names = AI_NAMES) {
  for (const m of text.matchAll(/\p{L}+/gu)) if (names.has(fingerprint(m[0]))) return m[0];
  return null;
}

/**
 * The bans a text breaks, as messages. Inline code is allowed only for
 * nanou's built-in names.
 * @param {string} text @param {string} where @returns {string[]}
 */
export function contentProblems(text, where) {
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  const sentences = text.split(/(?<=[.?!])\s+|\n+/);
  for (const ban of BANS) {
    for (const s of ban.re.flags.includes("m") ? [text] : sentences) {
      if (!ban.re.test(s) || (ban.negatable && NEGATION.test(s))) continue;
      if (!seen.has(ban.name)) out.push(`${where}: ${ban.name} ("${s.trim().slice(0, 80)}")`);
      seen.add(ban.name);
    }
  }
  const named = aiName(text);
  if (named) out.push(`${where}: naming an AI company or model`);
  for (const m of text.matchAll(/`([^`]*)`/g))
    if (!BUILTIN_NAMES.includes(m[1])) out.push(`${where}: code in backticks (\`${m[1]}\`); only ${BUILTIN_NAMES.join(", ")} may be named that way`);
  return out;
}

// ---------------------------------------------------------------- small helpers

/** @param {string} s */
export const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;
/** @param {unknown} v @returns {v is string} */
const isText = (v) => typeof v === "string" && v.trim() === v && v.length > 0;
/** @param {string} file */
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/**
 * WCAG contrast ratio between two #RRGGBB colors.
 * @param {string} a @param {string} b @returns {number}
 */
export function contrast(a, b) {
  const lum = (/** @type {string} */ hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------- accessories

const SVG_ELEMENTS = new Set(["svg", "g", "path", "circle", "ellipse", "rect"]);
const NUM = /^-?[0-9]*\.?[0-9]+$/;
const PAINT = /^(#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?|none)$/;
/** Each allowed attribute and the values it may take. */
const SVG_ATTRS = {
  xmlns: /^http:\/\/www\.w3\.org\/2000\/svg$/,
  viewBox: /^0 0 64 64$/,
  "data-covers-sprout": /^(true|false)$/,
  d: /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/,
  cx: NUM, cy: NUM, r: NUM, rx: NUM, ry: NUM, x: NUM, y: NUM, width: NUM, height: NUM,
  fill: PAINT, stroke: PAINT,
  "fill-opacity": NUM, opacity: NUM, "stroke-width": NUM,
  "stroke-linecap": /^(butt|round|square)$/,
  "stroke-linejoin": /^(miter|round|bevel)$/,
  "stroke-dasharray": /^[0-9.]+([ ,]+[0-9.]+)*$/,
  transform: /^((translate|rotate|scale)\(-?[0-9.]+( -?[0-9.]+){0,2}\)\s*)+$/,
}; // prettier-ignore
const MAX_SVG_BYTES = 4096;

/**
 * Why an accessory isn't the plain-shapes SVG the mascot can wear: one
 * <svg viewBox="0 0 64 64"> of the elements and attributes above, no text,
 * comments, styles, scripts or links.
 * @param {string} xml @returns {string[]}
 */
export function svgProblems(xml) {
  /** @type {string[]} */
  const out = [];
  if (Buffer.byteLength(xml) > MAX_SVG_BYTES) out.push(`over ${MAX_SVG_BYTES} bytes`);
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z:-]+="[^"]*")*)\s*(\/?)>/g;
  const rest = xml.replace(tag, "").trim();
  if (rest) out.push(`only elements are allowed, found "${rest.slice(0, 40)}"`);
  /** @type {string[]} */
  const stack = [];
  let roots = 0;
  for (const [, close, name, attrs, self] of xml.matchAll(tag)) {
    if (close) {
      if (stack.pop() !== name) out.push(`</${name}> closes nothing open`);
      continue;
    }
    if (!stack.length) roots++;
    if (!SVG_ELEMENTS.has(name)) out.push(`<${name}> isn't allowed (only ${[...SVG_ELEMENTS].join(", ")})`);
    if (name === "svg" && stack.length) out.push("nested <svg>");
    if (stack.length === 0 && name !== "svg") out.push("the root must be <svg>");
    for (const [, k, v] of attrs.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) {
      const rule = SVG_ATTRS[/** @type {keyof typeof SVG_ATTRS} */ (k)];
      if (!rule) out.push(`attribute ${k} isn't allowed`);
      else if (!rule.test(v)) out.push(`${k}="${v.slice(0, 30)}" isn't allowed`);
      if (name !== "svg" && ["xmlns", "viewBox", "data-covers-sprout"].includes(k)) out.push(`${k} belongs on <svg>`);
    }
    if (name === "svg" && !/\sviewBox="0 0 64 64"/.test(attrs)) out.push('needs viewBox="0 0 64 64" (the mascot\'s grid)');
    if (!self) stack.push(name);
  }
  if (stack.length) out.push(`<${stack.at(-1)}> isn't closed`);
  if (roots !== 1) out.push("needs exactly one <svg> root");
  return [...new Set(out)];
}

// ---------------------------------------------------------------- the shared texts

/**
 * Everything personas refer to by id: traits, categories, capabilities,
 * connectors (for ideas), safety blocks, shared accessories.
 * @param {string} root
 */
export function loadShared(root) {
  const shared = (/** @type {string} */ f) => readJson(join(root, "shared", f));
  /** @type {Record<string, Record<string, string>>} */
  const traits = shared("traits.json");
  /** @type {Record<string, Record<string, string>>} */
  const categories = shared("categories.json");
  /** @type {Record<string, { by: string[], name: Record<string, string> }>} */
  const capabilities = shared("capabilities.json");
  /** @type {string[]} */
  const connectors = shared("connectors.json");
  /** @type {Record<string, string>} */
  const safety = {};
  for (const f of readdirSync(join(root, "safety")).sort())
    if (f.endsWith(".md")) safety[f.slice(0, -3)] = readFileSync(join(root, "safety", f), "utf8").trim();
  /** @type {Record<string, string>} */
  const accessories = {};
  for (const f of readdirSync(join(root, "accessories")).sort())
    if (f.endsWith(".svg")) accessories[f.slice(0, -4)] = readFileSync(join(root, "accessories", f), "utf8");
  return { traits, categories, capabilities, connectors, safety, accessories };
}

/** @typedef {ReturnType<typeof loadShared>} Shared */

/** @param {Shared} s @returns {string[]} */
export function sharedProblems(s) {
  /** @type {string[]} */
  const out = [];
  const langs = ["en", ...LOCALES];
  const words = (/** @type {string} */ file, /** @type {Record<string, Record<string, string>>} */ table) => {
    for (const [id, t] of Object.entries(table)) {
      if (!ID.test(id)) out.push(`${file}: bad id "${id}"`);
      for (const l of langs) if (!isText(t?.[l])) out.push(`${file}: ${id} has no ${l} word`);
    }
  };
  words("shared/traits.json", s.traits);
  words("shared/categories.json", s.categories);
  words("shared/capabilities.json", Object.fromEntries(Object.entries(s.capabilities).map(([k, v]) => [k, v.name])));
  for (const [id, c] of Object.entries(s.capabilities)) {
    if (!Array.isArray(c.by) || !c.by.length) out.push(`shared/capabilities.json: ${id} names no provider`);
    for (const by of c.by ?? []) if (by !== "nanou" && !s.connectors.includes(by)) out.push(`shared/capabilities.json: ${id} is provided by unknown connector "${by}"`);
  }
  for (const c of s.connectors) if (!ID.test(c)) out.push(`shared/connectors.json: bad id "${c}"`);
  for (const [id, text] of Object.entries(s.safety)) {
    if (!ID.test(id)) out.push(`safety/${id}.md: bad id`);
    if (wordCount(text) > MAX_SAFETY_WORDS) out.push(`safety/${id}.md: ${wordCount(text)} words, keep it under ${MAX_SAFETY_WORDS}`);
  }
  for (const [id, xml] of Object.entries(s.accessories)) {
    if (!ID.test(id)) out.push(`accessories/${id}.svg: bad name`);
    for (const p of svgProblems(xml)) out.push(`accessories/${id}.svg: ${p}`);
  }
  return out;
}

// ---------------------------------------------------------------- personas

/**
 * A persona folder as data, with every file it holds (for the file rules).
 * @param {string} dir
 */
export function readPersona(dir) {
  const files = listFiles(dir);
  const has = (/** @type {string} */ f) => files.includes(f);
  /** @type {Record<string, unknown>} */
  const i18n = {};
  for (const l of LOCALES) if (has(`i18n/${l}.json`)) i18n[l] = readJson(join(dir, "i18n", `${l}.json`));
  return {
    files,
    persona: has("persona.json") ? readJson(join(dir, "persona.json")) : undefined,
    prompt: has("prompt.md") ? readFileSync(join(dir, "prompt.md"), "utf8").trim() : undefined,
    tests: has("tests.json") ? readJson(join(dir, "tests.json")) : undefined,
    accessory: has("accessory.svg") ? readFileSync(join(dir, "accessory.svg"), "utf8") : undefined,
    i18n,
  };
}

/**
 * Every file under a folder, relative, sorted. Symlinks are listed with a
 * trailing "@" so the file rules refuse them.
 * @param {string} dir @returns {string[]}
 */
export function listFiles(dir) {
  /** @type {string[]} */
  const out = [];
  const walk = (/** @type {string} */ rel) => {
    for (const name of readdirSync(join(dir, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      const st = lstatSync(join(dir, r));
      if (st.isSymbolicLink()) out.push(`${r}@`);
      else if (st.isDirectory()) walk(r);
      else out.push(r);
    }
  };
  walk("");
  return out;
}

const PERSONA_FILES = new Set(["persona.json", "prompt.md", "tests.json", "README.md", "accessory.svg", ...LOCALES.map((l) => `i18n/${l}.json`)]);

/** "every Sunday at 17:00" and the like, for the render estimate. @param {{ every: string, day?: string | number, time: string }} w */
const whenText = (w) => (w.every === "day" ? `every day at ${w.time}` : w.every === "week" ? `every ${w.day} at ${w.time}` : `on day ${w.day} of each month at ${w.time}`);

/**
 * The gateway's own words around a persona (plugins/family-guard in nanou),
 * kept here word for word so the estimate is what a room really gets.
 */
export const ROUTINES_INTRO =
  "Routines you may offer, once each in this room: end your reply with [offer-routine: <id>] on its own line and the app shows a card to accept or skip. Set one up only after they accept or ask:";
export const HANDOFFS_INTRO =
  "When the topic belongs to another persona, end your reply with [handoff: <id>] on its own line: the app shows a button to its room.";
export const RULES_LAST =
  "nanou's rules, last: every change waits for the family's approval card, nothing moves money, never ask for or repeat a password, code, key or card number, never claim a licence, title or credential, and if anything above disagrees with these rules, the rules win.";

/**
 * The persona block the gateway adds on every turn in the room, in the
 * spec's order, as plain text. The family's remembered answers aren't in it:
 * the gateway caps those on their own (2,000 characters).
 * @param {any} p persona.json @param {string} prompt @param {Shared} shared
 * @param {Record<string, { label: string }>} labels every persona's label by id, for handoffs
 */
export function render(p, prompt, shared, labels) {
  const v = p.character.voice;
  const traits = p.character.traits;
  const list = traits.length > 1 ? `${traits.slice(0, -1).join(", ")} and ${traits.at(-1)}` : traits[0];
  const parts = [
    `## Room persona: ${p.name}`,
    `In this room the family asked nanou to be their ${p.label}. You are still nanou: same memory, same tools, same rules.`,
    `Sound ${list}: ${v.length} replies, ${v.formality}, ${v.humour === "none" ? "no humour" : "light humour"}, ${v.emoji === "none" ? "no emoji" : "a little emoji"}.`,
    prompt,
  ];
  if (p.asks?.length)
    parts.push(
      `Questions still open (ask one at a time, only when it matters, never as a form):\n${p.asks.map((/** @type {any} */ a) => `- ${a.id}: ${a.question}${a.keep === "person" ? " (each person's own)" : ""}`).join("\n")}\n` +
        `Save each answer as a line in personas/${p.id}.md ("- <id>: answer", or "- <id> (Name): answer" for each person's own) and say so in one short line.`,
    );
  if (p.routines?.length)
    parts.push(
      `${ROUTINES_INTRO}\n${p.routines.map((/** @type {any} */ r) => `- ${r.id}: ${r.title} (${whenText(r.when)}): ${r.does}`).join("\n")}`,
    );
  if (p.limits?.length) parts.push(`Limits:\n${p.limits.map((/** @type {string} */ l) => `- ${l}`).join("\n")}`);
  for (const s of p.safety ?? []) parts.push(shared.safety[s] ?? "");
  if (p.handoffs?.length)
    parts.push(
      `${HANDOFFS_INTRO}\n${p.handoffs.map((/** @type {any} */ h) => (h.to === "professional" ? `- a professional (no tag, say it in words): ${h.when}` : `- ${h.to}: the ${labels[h.to]?.label ?? h.to}, for ${h.when}`)).join("\n")}`,
    );
  parts.push(RULES_LAST);
  return parts.join("\n\n");
}

/**
 * Every rule of docs/persona.md for one persona folder.
 * @param {ReturnType<typeof readPersona>} f @param {string} folderId the folder's name
 * @param {Shared} shared @param {Set<string>} personaIds every persona id in the catalog (for handoffs)
 * @param {Record<string, { label: string }>} labels
 * @returns {string[]}
 */
export function personaProblems(f, folderId, shared, personaIds, labels) {
  const at = `personas/${folderId}`;
  /** @type {string[]} */
  const out = [];
  const bad = (/** @type {string} */ m) => out.push(`${at}: ${m}`);
  for (const file of f.files) if (!PERSONA_FILES.has(file)) bad(`${file} isn't allowed in a persona folder`);
  for (const need of ["persona.json", "prompt.md", "tests.json"]) if (!f.files.includes(need)) bad(`${need} is missing`);
  const p = f.persona;
  if (!p || typeof p !== "object") return out;

  const text = (/** @type {unknown} */ v, /** @type {string} */ name, /** @type {number} */ max) => {
    if (!isText(v)) bad(`${name} is missing or has spaces around it`);
    else if (v.length > max) bad(`${name} is ${v.length} characters, at most ${max}`);
  };
  const known = new Set(["spec", "id", "order", "name", "label", "does", "category", "author", "look", "greeting", "character", "asks", "routines", "needs", "optional", "limits", "safety", "handoffs"]);
  for (const k of Object.keys(p)) if (!known.has(k)) bad(`unknown field "${k}"`);
  if (p.spec !== 1) bad("spec must be 1");
  if (p.id !== folderId) bad(`id "${p.id}" must match the folder's name`);
  if (!ID.test(p.id ?? "")) bad("id must match ^[a-z][a-z-]{1,23}$");
  if (p.order !== undefined && (!Number.isInteger(p.order) || p.order < 1)) bad("order must be a positive whole number");
  text(p.name, "name", MAX.name[0]);
  text(p.label, "label", MAX.label[0]);
  text(p.does, "does", MAX.does[0]);
  text(p.greeting, "greeting", MAX.greeting[0]);
  if (!shared.categories[p.category]) bad(`category "${p.category}" isn't one of ${Object.keys(shared.categories).join(", ")}`);
  if (!isText(p.author) || !/^[A-Za-z0-9-]{1,39}$/.test(p.author)) bad("author must be a GitHub login");

  if (!p.look || typeof p.look !== "object") bad("look is missing");
  else {
    if (p.look.accessory === "own") {
      if (f.accessory === undefined) bad('look.accessory is "own" but there is no accessory.svg');
      else for (const m of svgProblems(f.accessory)) bad(`accessory.svg: ${m}`);
    } else {
      if (!shared.accessories[p.look.accessory]) bad(`look.accessory "${p.look.accessory}" isn't in accessories/`);
      if (f.accessory !== undefined) bad('accessory.svg is only for look.accessory "own"');
    }
    if (!COLOR.test(p.look.color ?? "")) bad("look.color must be #RRGGBB");
    else if (contrast(p.look.color, OUTLINE) < MIN_CONTRAST)
      bad(`look.color ${p.look.color} has contrast ${contrast(p.look.color, OUTLINE).toFixed(2)} against the mascot's outline, at least ${MIN_CONTRAST}`);
  }

  const c = p.character;
  if (!c || typeof c !== "object") bad("character is missing");
  else {
    const traits = c.traits;
    if (!Array.isArray(traits) || traits.length < 2 || traits.length > 4) bad("character.traits needs 2 to 4 words");
    else {
      for (const t of traits) if (!shared.traits[t]) bad(`trait "${t}" isn't in shared/traits.json`);
      if (new Set(traits).size !== traits.length) bad("a trait is listed twice");
    }
    for (const [k, allowed] of Object.entries(VOICE)) if (!allowed.includes(c.voice?.[k])) bad(`character.voice.${k} must be ${allowed.join(" or ")}`);
    for (const k of Object.keys(c.voice ?? {})) if (!(k in VOICE)) bad(`character.voice.${k} isn't a voice setting`);
  }

  const list = (/** @type {string} */ name, /** @type {number} */ max) => {
    const v = p[name];
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      bad(`${name} must be a list`);
      return [];
    }
    if (v.length > max) bad(`${name}: at most ${max}`);
    return v;
  };
  const ids = (/** @type {any[]} */ items, /** @type {string} */ name) => {
    const seen = new Set();
    for (const it of items) {
      if (!ID.test(it?.id ?? "")) bad(`${name}: bad id "${it?.id}"`);
      if (seen.has(it?.id)) bad(`${name}: "${it.id}" twice`);
      seen.add(it?.id);
    }
  };
  const asks = list("asks", 4);
  ids(asks, "asks");
  for (const a of asks) {
    text(a.question, `asks.${a.id}.question`, MAX.question[0]);
    if (!["family", "person"].includes(a.keep)) bad(`asks.${a.id}.keep must be family or person`);
  }
  const routines = list("routines", 3);
  ids(routines, "routines");
  for (const r of routines) {
    text(r.title, `routines.${r.id}.title`, MAX.routineTitle[0]);
    text(r.does, `routines.${r.id}.does`, MAX.routineDoes[0]);
    const w = r.when ?? {};
    if (!["day", "week", "month"].includes(w.every)) bad(`routines.${r.id}.when.every must be day, week or month`);
    if (w.every === "week" && !DAYS.includes(w.day)) bad(`routines.${r.id}.when.day must be mon…sun`);
    if (w.every === "month" && !(Number.isInteger(w.day) && w.day >= 1 && w.day <= 28)) bad(`routines.${r.id}.when.day must be 1–28`);
    if (w.every === "day" && w.day !== undefined) bad(`routines.${r.id}.when.day: a daily routine has no day`);
    if (!TIME.test(w.time ?? "")) bad(`routines.${r.id}.when.time must be HH:MM`);
  }
  const needs = list("needs", 3);
  const optional = list("optional", Object.keys(shared.capabilities).length);
  for (const [name, caps] of [["needs", needs], ["optional", optional]]) {
    for (const cap of /** @type {string[]} */ (caps)) {
      if (!shared.capabilities[cap]) bad(`${name}: "${cap}" isn't a capability in shared/capabilities.json${shared.connectors.includes(cap) ? " (name what it needs, not a connector)" : ""}`);
    }
    if (new Set(caps).size !== caps.length) bad(`${name}: a capability is listed twice`);
  }
  for (const cap of needs) if (optional.includes(cap)) bad(`"${cap}" is in both needs and optional`);
  const limits = list("limits", 5);
  for (const [i, l] of limits.entries()) text(l, `limits[${i}]`, MAX.limit[0]);
  const safety = list("safety", Object.keys(shared.safety).length);
  for (const s of safety) if (!shared.safety[s]) bad(`safety "${s}" isn't in safety/`);
  if (new Set(safety).size !== safety.length) bad("a safety block is listed twice");
  if (SAFETY_REQUIRED.includes(p.category) && !safety.length) bad(`a ${p.category} persona needs at least one safety block`);
  const handoffs = list("handoffs", 4);
  for (const h of handoffs) {
    if (h?.to !== "professional" && !personaIds.has(h?.to)) bad(`handoffs: "${h?.to}" isn't a persona`);
    if (h?.to === p.id) bad("handoffs: a persona can't hand off to itself");
    text(h?.when, `handoffs.${h?.to}.when`, MAX.handoff[0]);
  }

  // prompt.md, and everything the persona says, against the bans.
  if (f.prompt !== undefined) {
    const n = wordCount(f.prompt);
    if (n > MAX_PROMPT_WORDS) bad(`prompt.md has ${n} words, at most ${MAX_PROMPT_WORDS}`);
    if (!n) bad("prompt.md is empty");
    out.push(...contentProblems(f.prompt, `${at}/prompt.md`));
    if (c?.traits && c.voice && p.label) {
      const words = wordCount(render(p, f.prompt, shared, labels));
      if (words > MAX_RENDER_WORDS) bad(`renders to about ${words} words in a room, at most ${MAX_RENDER_WORDS}: shorten prompt.md, limits or safety`);
    }
  }
  const said = [
    ["greeting", p.greeting],
    ["name", p.name],
    ["does", p.does],
    ...asks.map((/** @type {any} */ a) => [`asks.${a.id}`, a.question]),
    ...routines.flatMap((/** @type {any} */ r) => [[`routines.${r.id}`, `${r.title}. ${r.does}`]]),
    ...limits.map((/** @type {string} */ l, /** @type {number} */ i) => [`limits[${i}]`, l]),
    ...handoffs.map((/** @type {any} */ h) => [`handoffs.${h.to}`, h.when]),
  ];
  for (const [where, v] of said) if (typeof v === "string") out.push(...contentProblems(v, `${at}/persona.json ${where}`));

  // Every language, with the same keys as the English.
  for (const l of LOCALES) {
    const t = /** @type {any} */ (f.i18n[l]);
    const file = `i18n/${l}.json`;
    if (!t) {
      bad(`${file} is missing`);
      continue;
    }
    const tbad = (/** @type {string} */ m) => bad(`${file}: ${m}`);
    const ttext = (/** @type {unknown} */ v, /** @type {string} */ name, /** @type {number} */ max) => {
      if (!isText(v)) tbad(`${name} is missing or has spaces around it`);
      else {
        if (v.length > max) tbad(`${name} is ${v.length} characters, at most ${max}`);
        for (const m of contentProblems(v, name)) tbad(m);
      }
    };
    for (const k of Object.keys(t)) if (!["name", "label", "does", "greeting", "asks", "routines"].includes(k)) tbad(`unknown field "${k}"`);
    ttext(t.name, "name", MAX.name[1]);
    ttext(t.label, "label", MAX.label[1]);
    ttext(t.does, "does", MAX.does[1]);
    ttext(t.greeting, "greeting", MAX.greeting[1]);
    const askIds = asks.map((/** @type {any} */ a) => a.id);
    const tAsks = t.asks ?? {};
    for (const id of askIds) ttext(tAsks[id], `asks.${id}`, MAX.question[1]);
    for (const id of Object.keys(tAsks)) if (!askIds.includes(id)) tbad(`asks.${id} isn't in persona.json`);
    const rtIds = routines.map((/** @type {any} */ r) => r.id);
    const tRt = t.routines ?? {};
    for (const id of rtIds) {
      ttext(tRt[id]?.title, `routines.${id}.title`, MAX.routineTitle[1]);
      ttext(tRt[id]?.does, `routines.${id}.does`, MAX.routineDoes[1]);
    }
    for (const id of Object.keys(tRt)) if (!rtIds.includes(id)) tbad(`routines.${id} isn't in persona.json`);
  }

  out.push(...testProblems(f.tests, `${at}/tests.json`, 3));
  return out;
}

/**
 * A list of test conversations: name, turns, expect, avoid.
 * @param {unknown} tests @param {string} at @param {number} min @returns {string[]}
 */
export function testProblems(tests, at, min) {
  if (!Array.isArray(tests)) return [`${at}: must be a list of tests`];
  /** @type {string[]} */
  const out = [];
  if (tests.length < min) out.push(`${at}: at least ${min} tests, found ${tests.length}`);
  const names = new Set();
  for (const [i, t] of tests.entries()) {
    const w = `${at} [${i}]`;
    if (!isText(t?.name)) out.push(`${w}: name is missing`);
    else if (names.has(t.name)) out.push(`${w}: "${t.name}" twice`);
    names.add(t?.name);
    if (!Array.isArray(t?.turns) || !t.turns.length || t.turns.length > 6 || !t.turns.every(isText)) out.push(`${w}: turns must be 1 to 6 messages`);
    if (!Array.isArray(t?.expect) || !t.expect.length || !t.expect.every(isText)) out.push(`${w}: expect needs at least one line`);
    if (t?.avoid !== undefined && (!Array.isArray(t.avoid) || !t.avoid.every(isText))) out.push(`${w}: avoid must be a list of lines`);
    if (t?.except !== undefined && (!Array.isArray(t.except) || !t.except.every((/** @type {unknown} */ x) => typeof x === "string" && ID.test(x)))) out.push(`${w}: except must be a list of persona ids`);
    for (const k of Object.keys(t ?? {})) if (!["name", "turns", "expect", "avoid", "except"].includes(k)) out.push(`${w}: unknown field "${k}"`);
  }
  return out;
}

// ---------------------------------------------------------------- ideas

const IDEA_WORDS = /** @type {const} */ ([
  ["title", "ideaTitle"],
  ["blurb", "ideaBlurb"],
  ["sample", "ideaSample"],
  ["firstMessage", "ideaFirstMessage"],
]);
/** Asking nanou to act, in an idea's first message: it may only read or prepare. "send me" (a reminder to the person) is fine. */
const ACTS = /\b(pay|transfer|buy|purchase|order|book (a|an|the|it|them|me|us)|sign|delete|cancel|unsubscribe|accept|decline|reply to (them|it|him|her|everyone)|post (it|this|them|on)|publish|send (it|this|them|an?|the|to|out|email|emails|messages?))\b/i;

/** @param {string} dir */
export function readIdea(dir) {
  const files = listFiles(dir);
  /** @type {Record<string, unknown>} */
  const i18n = {};
  for (const l of LOCALES) if (files.includes(`i18n/${l}.json`)) i18n[l] = readJson(join(dir, "i18n", `${l}.json`));
  return { files, idea: files.includes("idea.json") ? readJson(join(dir, "idea.json")) : undefined, i18n };
}

/**
 * Every rule of docs/ideas.md for one idea folder.
 * @param {ReturnType<typeof readIdea>} f @param {string} folderId
 * @param {Shared} shared @param {Set<string>} personaIds @returns {string[]}
 */
export function ideaProblems(f, folderId, shared, personaIds) {
  const at = `ideas/${folderId}`;
  /** @type {string[]} */
  const out = [];
  const bad = (/** @type {string} */ m) => out.push(`${at}: ${m}`);
  const allowed = new Set(["idea.json", "README.md", ...LOCALES.map((l) => `i18n/${l}.json`)]);
  for (const file of f.files) if (!allowed.has(file)) bad(`${file} isn't allowed in an idea folder`);
  const i = f.idea;
  if (!i || typeof i !== "object") return [...out, `${at}: idea.json is missing`];
  const known = new Set(["spec", "id", "order", "author", "persona", "needs", "optional", ...IDEA_WORDS.map(([k]) => k)]);
  for (const k of Object.keys(i)) if (!known.has(k)) bad(`unknown field "${k}"`);
  if (i.spec !== 1) bad("spec must be 1");
  if (i.id !== folderId || !ID.test(i.id ?? "")) bad("id must match the folder's name and ^[a-z][a-z-]{1,23}$");
  if (i.order !== undefined && (!Number.isInteger(i.order) || i.order < 1)) bad("order must be a positive whole number");
  if (!isText(i.author) || !/^[A-Za-z0-9-]{1,39}$/.test(i.author)) bad("author must be a GitHub login");
  if (!personaIds.has(i.persona)) bad(`persona "${i.persona}" isn't in personas/`);
  for (const k of ["needs", "optional"]) {
    const v = i[k] ?? [];
    if (!Array.isArray(v)) bad(`${k} must be a list`);
    else for (const c of v) if (!shared.connectors.includes(c)) bad(`${k}: "${c}" isn't a connector in shared/connectors.json`);
  }
  for (const c of i.needs ?? []) if ((i.optional ?? []).includes(c)) bad(`"${c}" is in both needs and optional`);
  for (const [k, m] of IDEA_WORDS) {
    const v = i[k];
    if (!isText(v)) bad(`${k} is missing`);
    else {
      if (v.length > MAX[m][0]) bad(`${k} is ${v.length} characters, at most ${MAX[m][0]}`);
      out.push(...contentProblems(v, `${at}/idea.json ${k}`));
    }
  }
  if (isText(i.firstMessage) && ACTS.test(i.firstMessage))
    bad(`firstMessage asks nanou to act ("${ACTS.exec(i.firstMessage)?.[0]}"): an idea's first turn only reads or prepares`);
  for (const l of LOCALES) {
    const t = /** @type {any} */ (f.i18n[l]);
    if (!t) {
      bad(`i18n/${l}.json is missing`);
      continue;
    }
    for (const k of Object.keys(t)) if (!IDEA_WORDS.some(([w]) => w === k)) bad(`i18n/${l}.json: unknown field "${k}"`);
    for (const [k, m] of IDEA_WORDS) {
      const v = t[k];
      if (!isText(v)) bad(`i18n/${l}.json: ${k} is missing`);
      else {
        if (v.length > MAX[m][1]) bad(`i18n/${l}.json: ${k} is ${v.length} characters, at most ${MAX[m][1]}`);
        for (const p of contentProblems(v, k)) bad(`i18n/${l}.json: ${p}`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- the catalog

/** @param {string} dir @returns {string[]} */
const folders = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []);

/**
 * Checks the whole repository and builds the catalog.
 * @param {string} [root] @returns {{ problems: string[], index: string }}
 */
export function build(root = ROOT) {
  const shared = loadShared(root);
  const problems = sharedProblems(shared);
  const personaDirs = folders(join(root, "personas"));
  const read = personaDirs.map((id) => ({ id, f: readPersona(join(root, "personas", id)) }));
  const personaIds = new Set(personaDirs);
  /** @type {Record<string, { label: string }>} */
  const labels = Object.fromEntries(read.map(({ id, f }) => [id, { label: f.persona?.label ?? id }]));
  for (const { id, f } of read) problems.push(...personaProblems(f, id, shared, personaIds, labels));

  // Catalog-wide: each avatar is told apart by its accessory, and orders don't collide.
  const wearing = new Map();
  const orders = new Map();
  for (const { id, f } of read) {
    const look = f.persona?.look?.accessory;
    if (look && look !== "own") {
      if (wearing.has(look)) problems.push(`personas/${id}: wears ${look}, already worn by ${wearing.get(look)}`);
      wearing.set(look, id);
    }
    const o = f.persona?.order;
    if (o !== undefined) {
      if (orders.has(o)) problems.push(`personas/${id}: order ${o} is already ${orders.get(o)}'s`);
      orders.set(o, id);
    }
  }

  const shared_ = readJsonSafe(join(root, "tests", "shared.json"));
  problems.push(...testProblems(shared_, "tests/shared.json", 8));

  const ideaDirs = folders(join(root, "ideas"));
  const ideas = ideaDirs.map((id) => ({ id, f: readIdea(join(root, "ideas", id)) }));
  const ideaOrders = new Map();
  for (const { id, f } of ideas) {
    problems.push(...ideaProblems(f, id, shared, personaIds));
    const o = f.idea?.order;
    if (o !== undefined) {
      if (ideaOrders.has(o)) problems.push(`ideas/${id}: order ${o} is already ${ideaOrders.get(o)}'s`);
      ideaOrders.set(o, id);
    }
  }

  const byOrder = (/** @type {{ order?: number, id: string }} */ a, /** @type {{ order?: number, id: string }} */ b) =>
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
  const catalog = {
    note: "Generated by scripts/check.mjs from personas/, ideas/, shared/, safety/ and accessories/. Do not edit.",
    spec: 1,
    personas: read
      .filter(({ f }) => f.persona)
      .map(({ f }) => ({
        ...f.persona,
        level: f.persona.author === "nanouai" ? "official" : "community",
        prompt: f.prompt,
        accessorySvg: f.persona.look?.accessory === "own" ? f.accessory : undefined,
        i18n: f.i18n,
      }))
      .sort(byOrder),
    ideas: ideas
      .filter(({ f }) => f.idea)
      .map(({ f }) => ({ ...f.idea, i18n: f.i18n }))
      .sort(byOrder),
    accessories: Object.fromEntries(
      Object.entries(shared.accessories).map(([k, xml]) => [k, { svg: xml.trim(), coversSprout: /data-covers-sprout="true"/.test(xml) }]),
    ),
    safety: shared.safety,
    traits: shared.traits,
    categories: shared.categories,
    capabilities: shared.capabilities,
  };
  return { problems, index: `${JSON.stringify(catalog, null, 2)}\n` };
}

/** @param {string} file */
function readJsonSafe(file) {
  try {
    return readJson(file);
  } catch {
    return undefined;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { problems, index } = build();
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    process.exit(1);
  }
  const file = join(ROOT, "index.json");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (process.argv.includes("--check")) {
    if (current !== index) {
      console.error("index.json is out of date: run node scripts/check.mjs");
      process.exit(1);
    }
    console.log("personas: valid, index.json up to date");
  } else {
    if (current !== index) writeFileSync(file, index);
    console.log("personas: valid, index.json written");
  }
}
