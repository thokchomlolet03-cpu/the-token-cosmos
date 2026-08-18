# Software Development Lifecycle (SDLC) Policy & Governance

This document defines the formal Software Development Lifecycle (SDLC) and engineering governance model for "The Token Cosmos". Our philosophy is that software development is an automated, measurable assembly line.

## 1. Measurement Frameworks

We evaluate engineering health using two primary frameworks:

### DORA Metrics
DORA (DevOps Research and Assessment) metrics provide objective telemetry on our CI/CD velocity and stability:
1. **Deployment Frequency**: How often code is deployed to production.
   - *Target*: On-demand (multiple times per day).
2. **Lead Time for Changes**: The time from commit creation to production deployment.
   - *Target*: < 1 hour.
3. **Change Failure Rate**: The percentage of deployments causing a failure in production (requiring hotfix/rollback).
   - *Target*: < 5%.
4. **Time to Restore Service**: How long it takes to recover from a production failure.
   - *Target*: < 1 hour.

### SPACE Framework
SPACE metrics ensure we measure the holistic human and system experience, balancing velocity with quality and well-being:
- **Satisfaction and well-being**: Monitored via internal surveys and retention rates.
- **Performance**: System latency, SLA adherence (see `sla.md`), and feature utilization.
- **Activity**: PR volume, deployment frequency, commit counts.
- **Communication and collaboration**: Code review velocity, ADR discussions, documentation freshness.
- **Efficiency and flow**: CI pipeline execution time, time spent waiting on reviews.

## 2. The Toolchain and Pipeline

Our CI/CD toolchain is fully automated via GitHub Actions (`deploy.yml` and `docs.yml`). Every change must pass:
1. **Automated Testing**: Unit tests via `pytest` (backend) and Vitest (frontend).
2. **Security Scanning**: `bandit`, `pip-audit`, Trivy container SCA, GitLeaks secret detection.
3. **License Verification**: `license-checker` and `pip-licenses` to enforce open-source compliance.
4. **Containerization**: Immutable Docker images published to Google Artifact Registry.
5. **Deployment**: Automatic Scale-to-Zero rollout on Google Cloud Run upon merging to `main`.

## 3. Architecture Decision Records (ADRs)

All significant architectural changes, framework adoptions, or security model alterations MUST be documented via an ADR before implementation.
- ADRs are stored in `docs/adrs/`.
- Use the `docs/adrs/template.md` format.
- ADRs must be reviewed and approved (merged to `main`) before writing the associated code.
