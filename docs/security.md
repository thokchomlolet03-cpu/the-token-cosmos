# Security & Vulnerability Management

The Token Cosmos utilizes modern security patterns to protect infrastructure and user data. This page documents security middleware, authentication strategies, and secret management.

---

## 1. Browser Sandboxing & WebGPU Requirements (COOP/COEP)

To execute heavy local inference models, the WebGPU engine uses `SharedArrayBuffer` to rapidly share memory between the background WebWorker thread and the main UI thread. 

For security reasons (preventing Spectre/Meltdown attacks), modern browsers block `SharedArrayBuffer` unless the website is served in a secure cross-origin isolated context. The backend FastAPI application injects these isolation headers on all incoming requests:

```python
@app.middleware("http")
async def add_browser_isolation_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
    return response
```

- **Cross-Origin-Opener-Policy (COOP)**: Set to `same-origin`. This isolates the document from cross-origin window objects.
- **Cross-Origin-Embedder-Policy (COEP)**: Set to `credentialless`. This prevents loading cross-origin resources that do not explicitly permit it via CORS.

---

## 2. CORS (Cross-Origin Resource Sharing) Policy

In production, the compiled React Single Page App (SPA) and the FastAPI server run on the **same container and port** (port 8080). This eliminates cross-origin request issues because all browser API requests target the same host.

For local development (Vite running on port 3000 and FastAPI on port 8000), the backend implements a CORS middleware configuration:

```python
# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
> [!IMPORTANT]
> The configuration uses `allow_credentials=False` because the wild-card origin (`*`) is allowed. In enterprise environments restricting external API use, origins should be restricted to specific domain whitelists.

---

## 3. CI/CD Deployment Security (Workload Identity Federation)

We do not store static Google Cloud service account keys (JSON files) inside GitHub repository secrets. If a static key is leaked, it could give unauthorized users full administrative access to your GCP billing accounts.

Instead, the CI/CD pipeline implements **Google Cloud Workload Identity Federation (OIDC)**:
1. GitHub Actions requests a short-lived OIDC token from GitHub.
2. The pipeline presents this token to Google Cloud Security Token Service.
3. Google verifies that the token corresponds to a trust relationship configured on your GCP project.
4. Google issues a **temporary** token (valid for 1 hour) allowing container deployment to Cloud Run.

---

## 4. Routine Dependency Scanning & Vulnerability Management

To ensure security vulnerabilities are caught early, the repository integrates the following tools:

- **GitHub Dependabot**: Automatically scans `package.json` and `requirements.txt` for outdated or vulnerable libraries. It auto-submits pull requests for security patches.
- **Vulnerability Checks in Pipeline**:
  - Node dependencies are checked with `npm audit` during development build tests.
  - Python dependencies can be checked using `safety check -r requirements.txt`.
- **Stateless Runtime**: Because the Cloud Run backend has no database or disk storage, it is extremely resilient to remote code execution (RCE) attacks; restarting a container wipes any modifications to the ephemeral runtime layer.

---

## 5. Secrets & Credentials Management Strategy

To prevent credential leakage and comply with enterprise security auditing, The Token Cosmos implements a strict **Zero-Key Policy**.

```
                   SECRET INGESTION FLOW
                   
   Local Workspace          GitHub Actions          GCP Runtime (Production)
   ┌───────────────┐       ┌───────────────┐       ┌────────────────────────┐
   │ pre-commit    │ ────> │ detect-secrets│ ────> │ GCP Secret Manager     │
   │ secrets check │       │  action run   │       │ (Mounted via IAM role) │
   └───────────────┘       └───────────────┘       └────────────────────────┘
```

### 1. Automated Detection (Pre-Commit & CI)
- **Local Git Hooks**: The git pre-commit hook (installed via `scripts/install_hooks.py`) runs `gitleaks protect` locally on staged files. If a developer accidentally stages a secret, the commit is blocked.
- **CI/CD Gates**: The GitHub Actions runner executes `gitleaks-action` on all branch pushes and pull requests. If a leak bypasses local hooks, the CI build fails immediately and prevents deployment.

### 2. Runtime Secrets Resolution (GCP Secret Manager)
If the backend is scaled to connect to external systems requiring authentication (e.g., relational databases, private reasoning endpoints):
- **No Env File Commits**: The `.env` file is explicitly included in `.gitignore` and is never checked into git.
- **Secret Manager Mounting**: Secrets are stored securely in **Google Cloud Secret Manager**.
- **IAM Access Integration**: The Cloud Run container is granted the `Secret Manager Secret Accessor` (`roles/secretmanager.secretAccessor`) role. The environment variables are populated at runtime dynamically using GCP's native secret mounting:
  ```bash
  gcloud run deploy the-token-cosmos \
    --update-secrets=API_KEY=my-secret-key:latest
  ```

### 3. CI/CD Environment Credentials
Deployment authentication variables (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`) are stored as **GitHub Repository Variables**, rather than Secrets. Because Workload Identity Federation uses temporary OIDC tokens, these variables are completely safe to expose to developers in the repository settings.

---

## 6. Access Control & Branch Protection Rules

To comply with SOC 2 access control guidelines and prevent unauthorized code execution in the production environment, the following governance rules are enforced:

### 1. GitHub Branch Protection Policies
Direct pushes to the `main` and `master` branches are blocked. Branch protection rules mandate:
- **Required Reviews**: All pull requests must receive at least **one approving review** from a designated code owner (mapped via `.github/CODEOWNERS`) before they can be merged.
- **Mandatory Status Checks**: The pull request cannot merge until all automated checks in `.github/workflows/docs.yml` pass successfully. This guarantees that:
  - Trivy Container vulnerability scans report zero vulnerabilities.
  - Gitleaks detects zero hardcoded secrets.
  - `pip-audit` and `npm audit` return zero dependency CVE vulnerabilities.
  - Backend unit tests pass.
- **Block Force Pushes**: Force pushes (`git push --force`) are globally blocked to prevent history alteration.
- **Signed Commits Enforced**: All commits must be cryptographically signed using GPG or SSH keys. Unsigned commits are blocked by the gateway.

### 2. Two-Factor Authentication (2FA)
All contributors, organization members, and external collaborators are required to enable Two-Factor Authentication (2FA) on their GitHub profiles. Contributors without 2FA active are automatically stripped of repository access.


