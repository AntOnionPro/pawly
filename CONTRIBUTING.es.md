# Guía de contribución

[English](CONTRIBUTING.md) · **Español**

## Ramas

| Rama | Uso | Protección |
| --- | --- | --- |
| `main` | Producción: lo que está aquí se despliega. | Sin push directo ni borrado. Solo recibe PR desde `development`. |
| `development` | Integración: aquí llega todo el trabajo. Es la rama por defecto. | Sin push directo ni borrado. Solo recibe PR con el CI en verde. |
| `<tipo>/<n°issue>-<descripcion>` | Trabajo de un issue concreto. | Se borra al mergear. |

Ejemplos de rama de trabajo: `feat/12-modo-oscuro`, `fix/31-cierre-al-subir-imagen`, `docs/7-instalacion`.

## Flujo de trabajo

1. **Issue.** Todo cambio sale de un issue creado con una de las plantillas (`feat`, `bug`, `chore`, `ci`, `docs`, `perf`, `refactor`, `test`). No se permiten issues en blanco. Quien crea el issue queda asignado automáticamente.
2. **Rama.** Crea la rama desde `development`. Desde el issue puedes usar *Development → Create a branch* y elegir `development` como rama base.
3. **Commits.** Usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `feat: ...`, `fix: ...`, `docs: ...`, `ci: ...`, etc.
4. **Pull Request hacia `development`.** Completa la plantilla y referencia el issue en *Notas Adicionales* (por ejemplo `Closes #12`).
5. **Documentación.** Actualiza la sección *Estado del proyecto* de `README.md` y `README.es.md` en el mismo PR. Toda la documentación se mantiene en inglés y en español.
6. **Revisión y merge.** Para mergear hace falta que los 4 checks estén en verde y que todas las conversaciones estén resueltas. No se exigen aprobaciones (el repositorio tiene un solo mantenedor y GitHub no permite aprobar un PR propio); quien mergea revisa el PR antes.
7. **Release.** Para desplegar se abre un PR `development → main` (merge commit, sin squash, para que ambas ramas no diverjan). A diferencia de `development`, la regla de `main` no exige que la rama esté actualizada: cada release deja un merge commit solo en `main`, y actualizar `development` sería un push directo, que su propia regla prohíbe.

## Checks de CI obligatorios

| Check | Workflow | Qué valida |
| --- | --- | --- |
| `Lint` | `.github/workflows/ci.yml` | Sintaxis YAML (yamllint), workflows (actionlint), etiquetas de las plantillas, scripts del servidor (ShellCheck), y ESLint, Prettier y TypeScript de la app. |
| `Tests` | `.github/workflows/ci.yml` | Pruebas del servidor (PocketBase), pruebas de la app (Jest) y compilación de la app para Android, iOS y web. |
| `Rama destino` | `.github/workflows/pr-checks.yml` | Que los PR hacia `main` vengan únicamente de `development`. |
| `Issue vinculado` | `.github/workflows/pr-checks.yml` | Que el PR hacia `development` referencie un issue (`#N`). |

Workflows de apoyo:

- `.github/workflows/auto-assign.yml`: asigna cada issue nuevo a quien lo creó.
- `.github/workflows/labels.yml`: crea y actualiza las etiquetas definidas en `.github/labels.yml`.

## Configuración del repositorio (administradores)

Las reglas de protección de `main` y `development` están en `.github/rulesets/`. Si se cambian, hay que actualizar también la regla en GitHub (*Settings → Rules → Rulesets*), porque GitHub no lee estos archivos solo.

Para crearlas desde cero:

- **Desde la web:** *Settings → Rules → Rulesets → New ruleset → Import a ruleset* y sube `development.json` y luego `main.json`.
- **Desde la terminal** (con `gh` autenticado como administrador):

  ```bash
  gh api -X POST repos/AntOnionPro/pawly/rulesets --input .github/rulesets/development.json
  ```

  ```bash
  gh api -X POST repos/AntOnionPro/pawly/rulesets --input .github/rulesets/main.json
  ```

Ninguna regla tiene excepciones (`bypass_actors` vacío): tampoco los administradores pueden hacer push directo ni borrar estas ramas.

Ajustes en *Settings → General*:

- **Default branch:** `development`.
- **Automatically delete head branches:** activado.
