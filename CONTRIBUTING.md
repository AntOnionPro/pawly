# Contributing guide

**English** · [Español](CONTRIBUTING.es.md)

## Branches

| Branch | Purpose | Protection |
| --- | --- | --- |
| `main` | Production: whatever is here gets deployed. | No direct pushes or deletion. Only accepts PRs from `development`. |
| `development` | Integration: all work lands here. It is the default branch. | No direct pushes or deletion. Only accepts PRs with CI in green. |
| `<type>/<issue#>-<description>` | Work on a single issue. | Deleted on merge. |

Work branch examples: `feat/12-dark-mode`, `fix/31-crash-on-image-upload`, `docs/7-installation`.

## Workflow

1. **Issue.** Every change starts from an issue created with one of the templates (`feat`, `bug`, `chore`, `ci`, `docs`, `perf`, `refactor`, `test`). Blank issues are disabled. The issue author is assigned automatically.
2. **Branch.** Create the branch from `development`. From the issue you can use *Development → Create a branch* and pick `development` as the base branch.
3. **Commits.** Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `feat: ...`, `fix: ...`, `docs: ...`, `ci: ...`, etc.
4. **Pull request to `development`.** Fill in the template and reference the issue under *Notas Adicionales* (for example `Closes #12`).
5. **Documentation.** Update the *Project status* section of `README.md` and `README.es.md` in the same PR. All documentation is kept in English and Spanish.
6. **Review and merge.** Merging requires the 4 checks in green and every conversation resolved. Approvals are not required (the repository has a single maintainer and GitHub does not allow approving your own PR); whoever merges reviews the PR first.
7. **Release.** To deploy, open a `development → main` PR (merge commit, no squash, so both branches do not diverge).

## Required CI checks

| Check | Workflow | What it validates |
| --- | --- | --- |
| `Lint` | `.github/workflows/ci.yml` | YAML syntax (yamllint), workflows (actionlint), and that templates only use labels defined in `.github/labels.yml`. |
| `Tests` | `.github/workflows/ci.yml` | Runs the project's test suite (`npm test` or `pytest`, depending on the detected stack). |
| `Rama destino` | `.github/workflows/pr-checks.yml` | PRs to `main` only come from `development`. |
| `Issue vinculado` | `.github/workflows/pr-checks.yml` | PRs to `development` reference an issue (`#N`). |

Supporting workflows:

- `.github/workflows/auto-assign.yml`: assigns each new issue to its author.
- `.github/workflows/labels.yml`: creates and updates the labels defined in `.github/labels.yml`.

## Repository settings (admins)

The protection rules for `main` and `development` live in `.github/rulesets/`. If you change them, also update the rule on GitHub (*Settings → Rules → Rulesets*), because GitHub does not read these files on its own.

To create them from scratch:

- **From the web:** *Settings → Rules → Rulesets → New ruleset → Import a ruleset*, then upload `development.json` and then `main.json`.
- **From the terminal** (with `gh` authenticated as an admin):

  ```bash
  gh api -X POST repos/AntOnionPro/pawly/rulesets --input .github/rulesets/development.json
  ```

  ```bash
  gh api -X POST repos/AntOnionPro/pawly/rulesets --input .github/rulesets/main.json
  ```

No rule has exceptions (`bypass_actors` is empty): admins cannot push directly to or delete these branches either.

Settings under *Settings → General*:

- **Default branch:** `development`.
- **Automatically delete head branches:** enabled.
