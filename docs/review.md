# How a persona is reviewed

Every persona and setup idea that reaches families goes through the same
steps. A **Private** persona, made by a family in the app, skips all of it:
only that family sees it, and nanou runs the same automatic checks on it
inside the family's own space, so it can't hold what a public one may not.

## Submitting

Open a pull request adding `personas/<id>/` (or `ideas/<id>/`), then paste
its link on [nanou.ai/personas](https://nanou.ai/personas). Submitting is
for nanou members: sign in on nanou.ai with an account that belongs to a
family; the nanou team reaches you at that account's email. You get a link
to follow your submission's state.

Once merged, a persona is **Community**: listed for every family, credited
"by @you" from `author`, and maintained here with you. **Official** personas
are the nanou team's (`author: nanouai`). There is no third level: a persona
is text, so it lives in this one catalog.

## The states

Each submission reviews **one commit**: the one the link pointed to when
you submitted. A later push changes nothing; submit again for a new commit.

| State | What happens | Who |
|---|---|---|
| `received` | the submission is in; checks start on their own | automatic |
| `checking` | `scripts/check.mjs` and `scripts/review.mjs` run on that commit (below). Free, and in CI on every pull request | automatic |
| `checks_failed` | at least one check failed: you see which and why. Fix it and submit again | you |
| `audit` | a person on the nanou team reads every file: does the character match the claim, are the limits honest, are the safety blocks the right ones, do the translations say the same thing | nanou reviewer |
| `live_test` | one click runs `tests.json` and the shared suite on nanou's review host, in a throwaway family with no accounts. A grader scores each conversation against `expect` and `avoid`, and the report is attached to the submission. About 15 short conversations | nanou reviewer |
| `accepted` | the pull request is merged | nanou |
| `listed` | nanou's pin of this repository moves past the merge: every family has it | automatic |
| `declined` | stopped at a human step, always with a reason you can act on | nanou reviewer |

A reviewer moves a submission from `audit` to `live_test`, and from
`live_test` to `accepted`, only with a note saying what they checked.

**Updates** are new submissions of the same id. They go through the same
states, and the reviewer reads the diff from the listed commit. Until the
update is listed, families keep the reviewed version.

## The automatic checks

`node scripts/review.mjs <folder>` runs them on one persona or idea folder,
here or anywhere else; CI runs it on every folder a pull request adds or
changes. It only reads text: nothing in a folder is ever run.

| Check | What it makes sure of |
|---|---|
| `files` | only the files the format allows ([persona.md](persona.md), [ideas.md](ideas.md)), at most 60 files and 300 KB, no symlinks or hidden files |
| `schema` | every field's type and length, ids, `order`, traits, voice, routine schedules, categories, safety required for health and money |
| `refs` | handoffs and ideas point at real personas, `needs`/`optional` at capabilities (personas) or connectors (ideas), safety blocks exist |
| `content` | no approval-card bypass, credentials, moving money, licence or title claimed, AI company or model named, links, code or HTML, system-styled text, or writing for children; an idea's first message only reads or prepares |
| `size` | `prompt.md` ≤ 250 words, and the block the gateway renders ≤ 450 |
| `look` | the accessory is the plain-shapes SVG subset on the mascot's 64-unit grid and nobody else wears it; the color's contrast against the mascot's outline is at least 3:1 |
| `languages` | all 24 translations, with the same asks and routines as the English, within their lengths |
| `tests` | at least three tests of its own, each well formed |
| `id` | a new submission doesn't take an id already in the catalog |

`node scripts/check.mjs --check` then runs the same rules on the whole
repository and makes sure `index.json` is current.
