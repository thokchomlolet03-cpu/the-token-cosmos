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

---

## 5. Infrastructure Provisioning & Cloud Governance (Manual Setup)

As of current operations, **The Token Cosmos** manages its Google Cloud Platform resources manually via the Google Cloud Console and `gcloud` CLI (no Terraform or other Infrastructure as Code scripts are active in the source repository).

### 1. Initial GCP Resource Setup Commands
To deploy the system manually or prepare a new GCP environment, run the following commands in the `gcloud` CLI shell:

#### Step A: Configure Project & APIs
Ensure the correct project is selected and enable necessary service APIs:
```bash
gcloud config set project <GCP_PROJECT_ID>
gcloud services enable run.googleapis.com artifactregistry.googleapis.com bigquery.googleapis.com
```

#### Step B: Create Artifact Registry
Create a Docker repository to store application containers:
```bash
gcloud artifacts repositories create cosmos-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker Repository for The Token Cosmos"
```

#### Step C: Create BigQuery Telemetry Dataset
Create a dataset to host telemetry tables, restricted to the `us-central1` region:
```bash
bq --location=us-central1 mk -d \
  --description "Telemetry performance data and friction analysis metrics" \
  cosmos_telemetry
```

#### Step D: Create Partitioned Tables
To contain query costs, both table structures are day-partitioned by the `timestamp` column:
```bash
# Create the performance logs table
bq mk --table \
  --schema timestamp:TIMESTAMP,session_id:STRING,model_id:STRING,engine:STRING,step_count:INTEGER,generation_time_ms:FLOAT,tokens_per_second:FLOAT,vram_allocated_mb:INTEGER,temperature:FLOAT,top_k:INTEGER,top_p:FLOAT,min_p:FLOAT,browser:STRING \
  --time_partitioning_field timestamp \
  --time_partitioning_type DAY \
  cosmos_telemetry.performance_logs

# Create the friction points table
bq mk --table \
  --schema timestamp:TIMESTAMP,session_id:STRING,phrase:STRING,log_prob_drop:FLOAT,previous_log_prob:FLOAT,current_log_prob:FLOAT,severity:STRING,reason:STRING \
  --time_partitioning_field timestamp \
  --time_partitioning_type DAY \
  cosmos_telemetry.friction_points
```

### 2. Infrastructure as Code (IaC) Governance
> [!WARNING]
> Because resources are created manually, there is a risk of configuration drift or human error (e.g. leaving a BigQuery dataset publicly readable).
> 
> **Audit Rules**:
> - Any addition of Terraform (`.tf`), CloudFormation, or Cloud Deployment Manager scripts to this codebase **must** be immediately accompanied by the integration of an IaC static analysis tool (such as `checkov` or `tfsec`) into the `.github/workflows/docs.yml` validation job.
> - Public access to `cosmos_telemetry` datasets is prohibited. Access is restricted exclusively to the Cloud Run service account via IAM policies.

