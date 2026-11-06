# Build a nanou persona

A persona is who nanou, the private family assistant, becomes in a room: a
running coach, a gestor for paperwork, a book editor. **A persona is one
folder of text**: who it is, how it works, what it asks once, the routines it
can offer, its limits, and the conversations that test it. It adds no tool
and no permission: nanou stays nanou, with the family's own connectors and
its own rules, which always come last and win.

```
personas/<id>/
  persona.json        who it is: name, look, character, asks, routines, limits, safety, handoffs
  prompt.md           how it works, ≤ 250 words
  i18n/<locale>.json  the words families see, in 24 more languages
  tests.json          at least three test conversations
  accessory.svg       only if it brings its own accessory
```

Every folder in [personas/](../personas) is built this way. The format is
[persona.md](persona.md); [chef](../personas/chef) is a good one to copy.

## Three levels

| Level | Lives | Who sees it |
|---|---|---|
| **Official** | here, by the nanou team (`author: nanouai`) | every family |
| **Community** | here, by you, through a pull request, credited "by @you" | every family |
| **Private** | in one family, made in the app ("Make your own") | that family only, marked "Made by …" |

## The rules

1. **Instructions only.** No code, links or anything that loads. A persona
   can't add a tool, skip an approval card or move money: say what it does
   and let nanou's rules do the rest.
2. **Adults only.** nanou is for adults. A persona about children talks to
   their parents.
3. **Honest about what it is.** A role, never a person or a title someone
   could rely on ("Dr", "Maître", "CPA"). For health or money, pick the
   safety blocks nanou keeps ([safety/](../safety)); you can't edit them,
   and you don't need to repeat them.
4. **Short.** `prompt.md` ≤ 250 words, the whole block nanou reads on every
   turn ≤ 450. Tone goes in `character`, not in the prompt.
5. **Ask once, offer, hand over.** Questions in `asks` are asked once and
   remembered. `routines` are only ever offered, as a card the family
   accepts. `handoffs` suggest another persona when the talk crosses into
   its field.
6. **Every language.** Families use nanou in 25 languages, so the words
   they see come in all of them. A machine draft is fine; say so in the pull
   request.

## Step by step

1. **Pick an id** (`^[a-z][a-z-]{1,23}$`) that isn't in [personas/](../personas).
2. **Write persona.json.** Start from [chef's](../personas/chef/persona.json).
   Choose 2 to 4 traits from [shared/traits.json](../shared/traits.json), a
   category, an accessory nobody wears yet (or `"own"`), a color that stands
   out against the mascot's dark outline.
3. **Say what it needs, rarely.** `needs` is for capabilities it can't do
   its core job without (an accountant without a bank), `optional` for the
   ones that help. Name capabilities (`calendar`), never connectors: any
   calendar the family connects counts.
4. **Write prompt.md**: "Be the family's …", then "How you work:" bullets.
   What to check first, how to answer, what to remember, when to prepare a
   card.
5. **Translate** the name, label, does, greeting, asks and routines into
   every file in `i18n/`.
6. **Write tests.json**: at least three conversations on what makes this
   persona itself, each with what you `expect` and what to `avoid`. The
   shared safety suite runs too ([tests/shared.json](../tests/shared.json)).
7. **Check** and open a pull request:

```sh
node scripts/check.mjs                      # validates everything, rebuilds index.json
node scripts/review.mjs personas/<id>       # the automatic review of your folder
node --test "tests/*.test.mjs"
```

Then paste the pull request's link on
[nanou.ai/personas](https://nanou.ai/personas): [review.md](review.md) says
what happens next.

## A setup idea

An idea is a card on the setup's first screen that starts a room with a
persona: one folder in [ideas/](../ideas), described in
[ideas.md](ideas.md). Its first message only reads or prepares.
