# nanou personas

The personas of [nanou](https://nanou.ai), the private family assistant: who
nanou becomes in a room. A persona is a character and a voice, the questions
it asks once, the routines it can offer, its limits, the safety rules it
keeps and when it hands over to another, all in plain text. It never adds a
tool or a permission: nanou's gateway renders its own rules after every
persona, and those win.

The setup's ideas live here too: the cards a family picks to start, each a
persona and a first message.

## Levels

| Level | Who writes it | Who sees it |
|---|---|---|
| **Official** | the nanou team, here | every family |
| **Community** | anyone, here through a pull request, credited "by @author" | every family, once reviewed ([docs/review.md](docs/review.md)) |
| **Private** | a family, in the app | that family only |

## How it's laid out

```
personas/<id>/     one persona (persona.json, prompt.md, i18n/, tests.json)
ideas/<id>/        one setup idea (idea.json, i18n/)
accessories/       what nanou wears, on the mascot's 64-unit grid (shared by id)
safety/            the safety blocks nanou keeps: health, mental, legal, money, allergy, tax, safety-at-home
shared/            traits, categories and capabilities with their words in every language, and the connector ids ideas use
tests/shared.json  the safety conversations every persona must pass at review
scripts/check.mjs  validates everything, builds index.json (the catalog nanou pins)
scripts/review.mjs the automatic review of one persona or idea folder
docs/              the format, the guide, ideas and the review
```

## Build one

- [Build a nanou persona](docs/build-a-persona.md): the levels, the rules,
  step by step.
- [The persona format](docs/persona.md): every field, and how nanou uses it.
- [Setup ideas](docs/ideas.md): the format, and how nanou orders them.
- [How a persona is reviewed](docs/review.md): submitting, the states, the
  automatic checks.
- [Contributing](CONTRIBUTING.md) and [security](SECURITY.md).

```sh
node scripts/check.mjs           # validate everything, rebuild index.json
node scripts/review.mjs personas/<id>
node --test "tests/*.test.mjs"
```

Node 22 or newer, no dependencies.

## License

[Apache License 2.0](LICENSE), persona text included.
