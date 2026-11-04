# CLAUDE.md

Context for Claude Code. Read it before every change.

@README.md
@CONTRIBUTING.md

## Rules

- Work follows the stages in `docs/roadmap.md`. Never start a stage until the user has merged the previous one.
- Before starting a stage or a new branch, pull the latest `development` (`git fetch origin` and branch from `origin/development`).
- Each issue gets its own branch named `<type>/<issue#>-<description>` (for example `feat/6-app-scaffold`). The user authorized creating these branches.
- Every change starts from an issue that uses the matching template in `.github/ISSUE_TEMPLATE/`, is worked on its own branch from `development`, and reaches `development` through a pull request that follows `.github/pull_request_template.md` and references the issue.
- Never push directly to `main` or `development`.
- Issues and pull requests are written in Spanish, following the templates.
- Documentation is bilingual. Keep `README.md` / `README.es.md` and `CONTRIBUTING.md` / `CONTRIBUTING.es.md` in sync.
- Update the "Project status" section of both READMEs in the same pull request as the change.
- App interface: icons only, never emojis; the reaction is a paw print; colors, themes and languages as defined in the README.
