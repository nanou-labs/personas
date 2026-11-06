# Setup ideas

The first-run setup in the nanou app shows ideas: "I want that too" cards a
family picks to start with. Each idea is a persona, the connectors it needs
or can use, and four lines of words. Picking one makes a room with that
persona and sends the idea's first message there.

## An idea is one folder

```
ideas/<id>/
  idea.json           the idea, in English
  i18n/<locale>.json  its words in each of nanou's 24 other languages
  README.md           optional: notes for reviewers
```

```json
{
  "spec": 1,
  "id": "meals",
  "order": 2,
  "author": "nanouai",
  "persona": "chef",
  "needs": [],
  "optional": ["google", "whatsapp"],
  "title": "Meals, planned for the week",
  "blurb": "…",
  "sample": "…",
  "firstMessage": "Help us plan this week's meals: …"
}
```

| Field | Required | Rules |
|---|---|---|
| `spec` | yes | `1` |
| `id` | yes | `^[a-z][a-z-]{1,23}$`, the folder's name |
| `order` | no | a whole number ≥ 1, unique: the order before any picks are counted |
| `author` | yes | the author's GitHub login; `nanouai` for Official |
| `persona` | yes | a persona id in [personas/](../personas) |
| `needs` | no | connector ids it can't do without |
| `optional` | no | connector ids that make it better, shown as "Also works with …" |
| `title` | yes | ≤ 60 characters |
| `blurb` | yes | ≤ 140 characters, one line on what the family gets |
| `sample` | yes | ≤ 160 characters, a line nanou might say in the idea's room |
| `firstMessage` | yes | ≤ 400 characters, the message nanou acts on first |

Unlike a persona, an idea names **connectors**, not capabilities: the setup
connects them on the spot. The ids are checked against
[shared/connectors.json](../shared/connectors.json), which mirrors the
connectors catalog nanou pins.

**The first message only reads or prepares.** It may ask nanou to look, sort,
list, explain, draft, plan or remind the person themselves ("send me the
total every Monday"). It never asks nanou to send, post, pay, buy, book,
sign, cancel or delete anything: the check refuses those words in the
English, and the reviewer reads the translations. Anything an idea leads to
later still goes through the family's approval card.

The same content bans as personas apply to every word ([persona.md](persona.md)).
Translations may run longer: title 80, blurb 180, sample 210, first message
520 characters.

## How nanou orders them

The order in this repository is only the starting point. nanou ranks ideas
by how many families picked them:

- When the setup makes the rooms, the app sends the picked idea ids. nanou
  counts **one pick per family per idea**: a family running setup twice
  counts once. Only counts are kept for ranking, never who picked what.
- The app shows ideas most-picked first, and falls back to the `order` here
  when it can't get the counts.
- **A new idea gets a fair start:** for its first 30 days after it's listed,
  it holds slot 4, on the first screen, then takes its place by picks.

Ideas are submitted and reviewed like personas ([review.md](review.md)).
