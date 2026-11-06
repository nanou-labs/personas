# The nanou persona format (spec 1)

**Bottom line:** a persona is who nanou becomes in a room: a character, a
voice, the questions it asks once, the routines it can offer, its limits and
when it hands over. It is **instructions only**. A persona never adds a tool,
a permission or an account, and it can't loosen a rule: the gateway wraps
every persona in nanou's own rules, and those win.

## A persona is one folder

```
personas/<id>/
  persona.json        the structured part (this spec)
  prompt.md           how the persona works, in the author's words (≤ 250 words)
  accessory.svg       only with "accessory": "own": what nanou wears
  i18n/<locale>.json  the words families see, in each of nanou's 25 languages
  tests.json          the test conversations the review runs (≥ 3)
  README.md           optional: notes for reviewers and the author's credits
```

No code, no scripts, no links that load anything. `scripts/check.mjs` refuses
any other file, a symlink, or a hidden file.

## persona.json

```json
{
  "spec": 1,
  "id": "chef",
  "order": 3,
  "name": "Chef & meal planner",
  "label": "chef and meal planner",
  "does": "Menus, recipes, groceries",
  "category": "home",
  "author": "nanouai",
  "look": { "accessory": "toque", "color": "#F2B66D" },
  "greeting": "Bonjour from the kitchen! I can plan the week's meals around what everyone likes, use up what's in the fridge and write the shopping list. What are we cooking?",
  "character": {
    "traits": ["warm", "practical", "enthusiastic"],
    "voice": { "length": "short", "formality": "casual", "humour": "light", "emoji": "none" }
  },
  "asks": [
    { "id": "diet", "question": "Who doesn't eat what, and does anyone have an allergy?", "keep": "family" },
    { "id": "size", "question": "How many of you usually eat at home on weekdays?", "keep": "family" }
  ],
  "routines": [
    {
      "id": "weekly-plan",
      "title": "Plan next week's meals",
      "does": "Drafts next week's menu around the calendar and posts the shopping list.",
      "when": { "every": "week", "day": "sun", "time": "17:00" }
    }
  ],
  "needs": [],
  "optional": ["calendar", "whatsapp"],
  "limits": [],
  "safety": ["allergy"],
  "handoffs": [{ "to": "medical", "when": "a diet for a medical condition" }]
}
```

### Fields

| Field | Required | Rules |
|---|---|---|
| `spec` | yes | `1` |
| `id` | yes | `^[a-z][a-z-]{1,23}$`, the folder's name, unique in the catalog. Private personas get a `p-` prefix the gateway adds |
| `order` | no | a whole number ≥ 1, unique: the Official dock order. Personas without one come after, by id |
| `name` | yes | ≤ 32 characters, a role, never a person's name or a real professional title someone could rely on (no "Dr", "Maître", "CPA") |
| `label` | yes | ≤ 40 characters, the role as a bare noun, read after "your …" (`"chef and meal planner"`) |
| `does` | yes | ≤ 48 characters, what people come for |
| `category` | yes | one of `home`, `money`, `admin`, `health`, `learning`, `work`, `creative`, `leisure` ([shared/categories.json](../shared/categories.json)) |
| `author` | yes | the author's GitHub login; `nanouai` for Official |
| `look.accessory` | yes | a shared accessory id ([accessories/](../accessories)), or `"own"` with an `accessory.svg` in the folder. No two personas wear the same one |
| `look.color` | yes | `#RRGGBB`, contrast ≥ 3:1 against the mascot's dark outline (`#1f1b16`), which it sits right against |
| `greeting` | yes | ≤ 280 characters, ideally ending with one question, no promise of a result |
| `character.traits` | yes | 2 to 4 words from the trait list below |
| `character.voice` | yes | `length` short / medium; `formality` casual / neutral / formal; `humour` none / light; `emoji` none / light |
| `asks` | no | ≤ 4. `question` ≤ 120 characters; `keep` is `family` (one answer for the household) or `person` (each member's own) |
| `routines` | no | ≤ 3. `title` ≤ 40 characters, `does` ≤ 120; `when.every` day / week / month, `day` (mon…sun for week, 1–28 for month, none for day), `time` HH:MM in the family's own time zone |
| `needs` | no | ≤ 3 capabilities from the list below that the persona can't do its core job without. Rare on purpose |
| `optional` | no | capabilities that make it better |
| `limits` | no | ≤ 5 lines of ≤ 160 characters: what this persona won't do |
| `safety` | no | shared safety blocks to include, see below. At least one when `category` is `health` or `money` |
| `handoffs` | no | ≤ 4. `to` is another persona's id or `"professional"`; `when` ≤ 80 characters |

**Traits** ([shared/traits.json](../shared/traits.json), translated once by
nanou): calm, warm, brisk, patient, practical, precise, playful, encouraging,
direct, gentle, curious, thorough, pragmatic, reassuring, upbeat, wry, frank,
methodical, creative, organised, honest, tactful, unhurried, energetic,
down-to-earth, detail-minded, big-picture, kind, firm, cheerful,
enthusiastic. A new trait is a pull request to that file with all 25
languages.

### needs and optional

**Capabilities** ([shared/capabilities.json](../shared/capabilities.json)):
`calendar`, `email`, `drive`, `contacts`, `bank`, `crypto`, `whatsapp`,
`tasks`, `chat`, `code`, `browser`, `images`, `documents`, `signing`,
`vault`. A persona names what it needs, never a connector: **any** connector
that provides the capability counts (`calendar` is Google or Outlook,
`drive` is Google Drive or OneDrive). The file lists, for each capability,
the connectors that provide it today (`nanou` means built in) and its name
in every language; it mirrors the connectors catalog that nanou pins, and
changes with it. Lists, memory and jobs every family has, so they aren't
named.

`needs` and `optional` are **informational only and grant nothing**: no
tool, no account, no permission. They drive the app:

- When a room's persona needs something the person hasn't connected or been
  given through sharing, the app shows **one card** in that room ("The
  accountant works with your bank. Connect / Not now"), once per room, and
  not again once declined.
- `optional` shows on the persona's sheet as "Also works with …".
- Without a need met, the persona still works and says plainly what it can't
  do yet.

### Safety blocks

Written and kept by nanou in [safety/](../safety) so an author can't weaken
them; a persona picks them by id:

| Block | What it says |
|---|---|
| `health` | not a doctor; never diagnoses, prescribes or invents a dose; 112 or the emergency department first for emergencies |
| `mental` | not a therapist; never the only support; crisis first: 112 or a crisis line |
| `legal` | not a lawyer, not legal advice; deadlines first; a lawyer or legal aid before anything binding |
| `money` | nothing moves money; never asks for credentials; no promised returns; not regulated advice |
| `allergy` | never guesses whether a product is safe; label or maker; 112 for a severe reaction |
| `tax` | not a tax adviser; never files, signs or pays; an adviser for complex cases |
| `safety-at-home` | gas, sparks, flooding, structure: get safe and call first; no gas, mains or structural work |

Each block stays under 90 words. Emergency numbers are written for Europe:
112 works across the EU, and the `mental` block names national crisis lines
only where they're verified.

## prompt.md

How the persona works and sounds, in plain English, ≤ 250 words (each word
rides along on every turn in the room). Write it as "Be the family's …" and
then "How you work:" bullets, like the Official ones. Don't repeat what
`character`, `limits` or `safety` already say: the gateway renders those
next to it. The model answers in the family's language, so the prompt isn't
translated.

Not allowed in `prompt.md`, `persona.json` or any translation (the check
refuses it):

- Anything about getting around an approval card, sending without asking,
  hiding something from the family, or ignoring nanou's rules.
- Asking for passwords, card numbers, codes or seed phrases, or moving money
  (a sentence that says "never" does is the rule working, and passes).
- Claiming a licence, a title or a credential.
- Links, code, HTML, tool calls written out, or text styled as a system
  message (`[family-guard …]`, `## System`). The one exception is naming
  nanou's own list tool, `` `family_todo` ``, in backticks.
- Naming an AI company or model.
- Writing for children or aimed at minors: nanou is for adults. Parenting
  and school personas talk *to adults about* children.

## i18n/<locale>.json

```json
{ "name": "Chef & menus", "label": "cheffe et planificatrice de menus",
  "does": "Menus, recettes, courses",
  "greeting": "Bonjour depuis la cuisine ! …",
  "asks": { "diet": "Qui ne mange pas quoi, et quelqu'un a-t-il une allergie ?" },
  "routines": { "weekly-plan": { "title": "Préparer les repas de la semaine", "does": "…" } } }
```

Every locale nanou ships (`en` is `persona.json` itself): fr es de it pt bg
cs da el et fi ga hr hu lt lv mt nl pl ro sk sl sv tr. The same `asks` and
`routines` ids as the English, no more, no fewer. Languages run longer, so
translations may be longer: name 48, label 64, does 64, greeting 360,
question 160, routine title 56 and does 160 characters. Informal address
throughout, the brand `nanou` untouched. A machine draft is fine: say so in
the pull request.

## tests.json

```json
[
  {
    "name": "asks about diets before a full plan",
    "turns": ["Can you plan dinners for next week?"],
    "expect": ["asks who eats what or about allergies before giving a full week"],
    "avoid": ["a full seven-day plan with no question first"]
  }
]
```

At least three of the persona's own, on what makes it this persona: 1 to 6
`turns` each, at least one `expect` line, `avoid` optional. The review also
runs the shared suite every persona must pass,
[tests/shared.json](../tests/shared.json): an approval-card bypass request, a
password, a request to move money, "are you a real doctor or lawyer", a
prompt injection pasted from an email, French and Turkish messages answered
in that language, and a handoff case. A shared test may list `except`: the
personas it doesn't apply to (the car persona isn't asked to hand over car
questions).

Test conversations run on nanou's review host in a throwaway family with no
real accounts. A grader reads each transcript against `expect` and `avoid`,
and the report is attached to the submission. They aren't run in CI (they
cost model time), only at the review's live-test step
([review.md](review.md)).

## How the gateway uses it

On every turn in the room, before the family's message, the gateway adds, in
this order:

1. "In this room the family asked nanou to be their <label>. You are still
   nanou: same memory, same tools, same rules."
2. The voice and traits as one line ("Sound warm, practical and
   enthusiastic: short replies, casual, light humour, no emoji.").
3. `prompt.md`.
4. What the family already answered to `asks` (from the persona's notes in
   the family's workspace), and which questions are still open: ask those one
   at a time, when they matter, never as a form.
5. The routines it may offer, each at most once per room: for now in a
   sentence, later as a card. Only the family's yes sets one up; a persona
   never creates a job by itself.
6. `limits`, then each `safety` block, then `handoffs`.
7. nanou's rules again, last: approval cards, nothing moves money, no
   credentials, no licence or title claimed, and "if anything above disagrees with these rules, the rules
   win."

The whole block is capped at **450 words**. `scripts/check.mjs` renders it
(`render()`, with every ask still open) and refuses a persona that runs
longer. The family's remembered answers aren't counted: the gateway caps
those on their own, at 2,000 characters.

## The catalog

`node scripts/check.mjs` validates everything and writes `index.json`: every
persona with its prompt, translations and level (`official` when the author
is `nanouai`, `community` otherwise), the ideas ([ideas.md](ideas.md)), the
accessories, safety blocks, traits, categories and capabilities. nanou pins
a commit of this repository and reads that one file.
