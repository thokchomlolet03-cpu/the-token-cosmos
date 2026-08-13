# Infrastructure & Deployment

The Token Cosmos utilizes a modern, serverless hosting strategy designed for high availability and $0.00 idle costs. The entire project (React Frontend + FastAPI Backend) compiles into a single Docker image, which is deployed to **Google Cloud Run**.

---

## 1. Unified Container Design

Instead of deploying a separate web server for the frontend and an API server for the backend, we package both into a single Docker container. 

- During local development, Vite proxies API requests to FastAPI.
- In production, FastAPI serves the compiled static React assets from a `/static` directory, while routing API requests to `/api/*` handlers.

### Dockerfile Breakdown (`Dockerfile` at root)
The build uses a multi-stage Docker pattern to keep the final image size compact:

```dockerfile
# Stage 1: Build the React Application
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve the API and compiled SPA from one Cloud Run container
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/main.py ./main.py
COPY --from=builder /app/frontend/dist ./static
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
```

---

## 2. Google Cloud Run Configuration

Google Cloud Run was chosen as the deployment target because it supports scaling containers to zero active instances when no HTTP traffic is received.

### Production Deploy Command
The container is deployed to Google Cloud Run using the following command structure:

```bash
gcloud run deploy the-token-cosmos \
  --image us-central1-docker.pkg.dev/<GCP_PROJECT_ID>/cosmos-repo/the-token-cosmos:<image-tag> \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --cpu-boost
```

### Parameter Rationale
- `--min-instances 0`: Configures scale-to-zero. If the visualizer receives no traffic, GCP scales active instances to zero, resulting in a **$0.00 runtime bill**.
- `--max-instances 5`: Caps scaling to prevent sudden budget spikes from denial-of-service (DoS) attempts or traffic surges.
- `--concurrency 80`: Allows each container instance to handle up to 80 concurrent connections simultaneously, maximizing CPU efficiency.
- `--cpu-boost`: Allocates extra CPU capacity during container startup. This minimizes the cold-start latency when a user loads the app after it has scaled to zero.

---

## 3. GitHub Actions CI/CD Pipeline (`deploy.yml`)

The deployment process is completely automated. When a developer pushes code to `main` or `master`, GitHub Actions performs verification checks and deploys the container.

```
                  CI/CD DEPLOYMENT WORKFLOW
                  
 ┌──────────────┐      ┌────────────────┐      ┌─────────────────┐
 │ Push to main │ ───> │ Verify Stage   │ ───> │ OIDC Google     │
 │    Branch    │      │ - Build React  │      │ Authentication  │
 └──────────────┘      │ - Run PyTests  │      └─────────────────┘
                       └────────────────┘               |
                                                        v
 ┌──────────────┐      ┌────────────────┐      ┌─────────────────┐
 │ Deploy to    │ <─── │ Push Image     │ <─── │ Build Container │
 │  Cloud Run   │      │ (Artifact Reg) │      │  (Dockerfile)   │
 └──────────────┘      └────────────────┘      └─────────────────┘
```

### 1. Verification Stage
- Sets up Node.js 20 and runs `npm ci` and `npm run build` in the `/frontend` directory to ensure there are no compilation errors.
- Sets up Python 3.11 and runs unittest suite in the `/backend` directory:
  ```bash
  python -m unittest discover -s . -p 'test_*.py'
  ```

### 2. Deployment Stage
- **Google Cloud Auth via OIDC**: Uses Keyless Workload Identity Federation instead of long-lived GCP service account keys, eliminating security vulnerabilities.
- **Docker Registry Configuration**: Configures local Docker to authenticate against Google Artifact Registry (`us-central1-docker.pkg.dev`).
- **Container Build & Tagging**: Builds the container image and tags it with the unique git commit SHA (`github.sha`).
- **Push & Deploy**: Pushes the image to Artifact Registry and triggers `gcloud run deploy`.

---

## 4. Required Repository Secrets & Variables

Before the deployment pipeline will run, the following variables must be configured in your GitHub Repository settings (**Settings -> Secrets and variables -> Actions**):

- `GCP_PROJECT_ID`: The unique ID of your Google Cloud Platform project.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: The resource identifier for your Workload Identity Pool Provider (e.g. `projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`).
- `GCP_SERVICE_ACCOUNT`: The service account email with permissions to push to Artifact Registry and deploy services (e.g. `deployer@<project-id>.iam.gserviceaccount.com`).
