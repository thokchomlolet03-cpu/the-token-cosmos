# Repository map and deployment boundary

The Token Cosmos is one product repository with three maintained surfaces.

| Surface | Location | Purpose | Production status |
| --- | --- | --- | --- |
| Interactive application | `frontend/` | React/Vite/WebGPU experience | Built into the root Cloud Run container |
| API | `backend/` | FastAPI logits, health, and anonymous telemetry | Runs in the same Cloud Run container |
| Documentation | `docs/` | MkDocs product and operational docs | Published separately to GitHub Pages |

## Supported production path

The root `Dockerfile` is the sole production application image. It builds the
frontend and serves its compiled files alongside the FastAPI API. GitHub Actions
deploys this image to Cloud Run only when workload-identity repository variables
are configured.

`frontend/Dockerfile`, `backend/Dockerfile`, and the Nginx configuration files
are retained only for local or historical experiments. They must not be used for
new production deployments without an architecture decision record.

## Product boundaries

- `cli/` is a developer companion, not part of the deployed web application.
- `tracker/` is an internal metrics prototype, not released by the primary workflow.
- `frontend/dist-scorm/` is generated output. Use `npm run build:scorm`; do not
  commit new archives.

## Telemetry privacy boundary

The public telemetry endpoint records anonymous product telemetry only. It does
not infer an organisation from an unverified bearer token. Before enabling
tenant-specific telemetry, implement issuer/audience/JWKS verification and a
documented retention policy.
