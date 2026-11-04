# Guía de contribución

## Ramas

| Rama | Uso | Protección |
| --- | --- | --- |
| `main` | Producción: lo que está aquí se despliega. | Sin push directo ni borrado. Solo recibe PR desde `development`. |
| `development` | Integración: aquí llega todo el trabajo del equipo. | Sin push directo ni borrado. Solo recibe PR aprobados. |
| `<tipo>/<n°issue>-<descripcion>` | Trabajo de un issue concreto. | Se borra al mergear. |

Ejemplos de rama de trabajo: `feat/12-modo-oscuro`, `fix/31-cierre-al-subir-imagen`, `docs/7-instalacion`.

## Flujo de trabajo

1. **Issue.** Todo cambio sale de un issue creado con una de las plantillas (`feat`, `bug`, `chore`, `ci`, `docs`, `perf`, `refactor`, `test`). No se permiten issues en blanco. Quien crea el issue queda asignado automáticamente.
2. **Rama.** Crea la rama desde `development`. Desde el issue puedes usar *Development → Create a branch* y elegir `development` como rama base.
3. **Commits.** Usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `feat: ...`, `fix: ...`, `docs: ...`, `ci: ...`, etc.
4. **Pull Request hacia `development`.** Completa la plantilla y referencia el issue en *Notas Adicionales* (por ejemplo `Closes #12`).
5. **Revisión.** Para mergear hace falta que el CI esté en verde, al menos **1 aprobación** de otra persona y todas las conversaciones resueltas. Si subes cambios nuevos, la aprobación se descarta y hay que volver a aprobar.
6. **Release.** Para desplegar se abre un PR `development → main` (merge commit, sin squash, para que ambas ramas no diverjan).

## Checks de CI obligatorios

| Check | Workflow | Qué valida |
| --- | --- | --- |
| `Lint` | `.github/workflows/ci.yml` | Sintaxis YAML (yamllint), workflows (actionlint) y que las plantillas usen etiquetas definidas en `.github/labels.yml`. |
| `Tests` | `.github/workflows/ci.yml` | Ejecuta la suite de pruebas del proyecto (`npm test` o `pytest`, según el stack detectado). |
| `Rama destino` | `.github/workflows/pr-checks.yml` | Que los PR hacia `main` vengan únicamente de `development`. |
| `Issue vinculado` | `.github/workflows/pr-checks.yml` | Que el PR hacia `development` referencie un issue (`#N`). |

Workflows de apoyo:

- `.github/workflows/auto-assign.yml`: asigna cada issue nuevo a quien lo creó.
- `.github/workflows/labels.yml`: crea y actualiza las etiquetas definidas en `.github/labels.yml`.

## Configuración del repositorio (administradores)

Las reglas de protección de `main` y `development` están en `.github/rulesets/` y se aplican una sola vez:

- **Desde la web:** *Settings → Rules → Rulesets → New ruleset → Import a ruleset* y sube `development.json` y luego `main.json`.
- **Desde la terminal** (con `gh` autenticado como administrador):

  ```bash
  gh api -X POST repos/AntOnionPro/pawly/rulesets --input .github/rulesets/development.json
  ```

  ```bash
  gh api -X POST repos/AntOnionPro/pawly/rulesets --input .github/rulesets/main.json
  ```

Ninguna regla tiene excepciones (`bypass_actors` vacío): tampoco los administradores pueden hacer push directo ni borrar estas ramas.

Ajustes recomendados en *Settings → General*:

- **Default branch:** `development`, para que los PR apunten ahí por defecto y `Closes #N` cierre el issue al mergear.
- **Automatically delete head branches:** activado.
