# Contributing

Thanks for building a persona. Start with
[docs/build-a-persona.md](docs/build-a-persona.md); the format is specified
in [docs/persona.md](docs/persona.md), and setup ideas in
[docs/ideas.md](docs/ideas.md).

## Ground rules

- **Instructions only.** A persona is text: no code, no links, nothing that
  loads. It can't add a tool, a permission or an account, and it can't
  loosen nanou's rules: changes wait for the family's approval card, and
  nothing moves money.
- **Adults only.** nanou is for adults. Personas about children talk to
  their parents, never to the children.
- **No credentials, no money.** A persona never asks for a password, a code,
  a card number or a seed phrase, and never pays, transfers or trades.
- **Honest.** A role, not a person, and no licence or title it doesn't have.
  Health and money personas pick nanou's safety blocks.
- **Every language.** nanou speaks 25 languages, so each persona ships the
  words families see in all of them (`i18n/<locale>.json`). A machine draft
  is fine; say so in the pull request and we'll review it.

## Submitting

Open a pull request, then paste its link on
[nanou.ai/personas](https://nanou.ai/personas), signed in with a nanou
account that belongs to a family. Each submission reviews one commit,
through explicit states you can follow ([docs/review.md](docs/review.md)).

## Sign your commits (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/)
instead of a contributor agreement: by signing off, you certify you wrote the
change or have the right to contribute it under this repository's license.

```sh
git commit -s -m "feat(baker): add the baker persona"
```

CI refuses commits without a `Signed-off-by` line.

## Before you open a pull request

```sh
node scripts/check.mjs --check            # validates everything; index.json must be current
node scripts/review.mjs personas/<id>     # the automatic review CI runs on your folder
node --test "tests/*.test.mjs"
```

Node 22 or newer, no dependencies.

## License

Contributions are licensed under the [Apache License 2.0](LICENSE),
certified by your sign-off.
