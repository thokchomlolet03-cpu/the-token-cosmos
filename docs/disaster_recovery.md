# Disaster Recovery & Rollback Playbook

This document details the emergency operations playbook for restoring service in the event of an outage or bad production deployment.

---

## 1. Zero-Downtime Rollback Process

If a newly deployed container image introduces bugs, memory leaks, or crashes on start, the team can roll back the changes to the last known stable deployment in under 10 seconds.

### Method A: Command-Line Rollback (Recommended)
You can instantly route all traffic back to a previous revision.

1. List the existing revisions of the service to find the last working revision name:
   ```bash
   gcloud run revisions list \
     --service=the-token-cosmos \
     --region=us-central1
   ```
2. Route 100% of user traffic to the stable revision (e.g., `the-token-cosmos-00042-abc`):
   ```bash
   gcloud run services update-traffic the-token-cosmos \
     --to-revisions=the-token-cosmos-00042-abc=100 \
     --region=us-central1
   ```

### Method B: Google Cloud Console Rollback
1. Navigate to the **Cloud Run console** and click on `the-token-cosmos`.
2. Select the **Revisions** tab.
3. Click **Manage Traffic**.
4. Set the traffic allocation of the last stable revision to `100%` and the broken revision to `0%`.
5. Click **Save**. Traffic will shift instantaneously without dropping active connections.

---

## 2. Database Downtime & Resilience

Many applications suffer catastrophic failures when their relational databases (PostgreSQL, MySQL) fail or experience high latency. 

```
            RESILIENT STATELESS FALLBACK METAPHOR
            
   ┌───────────────────────────────────────────────────────┐
   │                  CLIENT REQUEST                       │
   └───────────────────────────────────────────────────────┘
                               |
                               v
   ┌───────────────────────────────────────────────────────┐
   │             CHECK GGUF MODEL / ENGINE                 │
   └───────────────────────────────────────────────────────┘
            |                               |
    (Model Loaded)                  (Model Fails/Missing)
            v                               v
   ┌─────────────────┐             ┌───────────────────────┐
   │ Llama.cpp Engine│             │ Synthetic Fallback    │
   │  Returns Logits │             │   (Always Online)     │
   └─────────────────┘             └───────────────────────┘
```

The Token Cosmos mitigates database issues via its **stateless architectural design**:
- **No Transactional Database**: The system operates without an attached database, making it immune to connection pool saturation, deadlocks, and data loss.
- **Model Engine Fallback**: If the local GGUF model file (e.g., Qwen) is missing, fails to load, or becomes corrupted, the backend FastAPI server catches the error and falls back to the **Synthetic Logit Generator Engine** automatically. The API returns prompt-aware, deterministic logits immediately, maintaining application availability.

---

## 3. Incident Response Playbook

Follow these steps when responding to an active outage:

```mermaid
flowchart TD
    A["Outage Alert Triggered\n(p95 Latency / 5xx Errors)"] --> B["Step 1: Check health endpoint\n/api/health"]
    B --> C{Endpoint responsive?}
    C -->|No| D["Step 2: Rollback revision\nto last stable tag"]
    C -->|Yes| E["Step 3: Check browser logs\nfor WebGPU failures"]
    D --> F["Step 4: Inspect Cloud Logs\n(main.py stacktrace)"]
    E --> G["Step 5: File Hotfix PR"]
    F --> G
```

1. **Verify Outage**: Attempt to curl the health endpoint: `curl -I https://the-token-cosmos.run.app/api/health`.
2. **Shift Status**: If the health check fails or returns an error, execute a rollback to the last stable revision using Method A or B.
3. **Analyze Stacktrace**: Check the Google Cloud Log Explorer to view the FastAPI logs and identify the bug.
4. **Local Reproduction**: Rebuild the image locally using the Docker command:
   ```bash
   docker build -t the-token-cosmos-test .
   docker run -p 8080:8080 the-token-cosmos-test
   ```
5. **Publish Hotfix**: Push the fix to `main` to trigger the automated CI/CD pipeline.

---

## 4. Disaster Recovery Operational Metrics (RTO & RPO)

To maintain platform compliance, the engineering team adheres to strict operational limits during outages.

### 1. Recovery Objectives

| Metric | Target | System Mitigation & Fail-Safe Mechanics |
| :--- | :---: | :--- |
| **RTO (Recovery Time Objective)** | **< 15 minutes** | - Cloud Run container image revisions are cached. Shifting traffic takes **< 1 minute**.<br>- Multi-region backups: DNS nameserver configurations can route requests to standby GCP regions within 10 minutes. |
| **RPO (Recovery Point Objective)** | **< 1 hour** | - Telemetry logs are buffered locally in the browser memory for up to 5 minutes.<br>- **Backend Ingestion Fail-Safe**: If BigQuery becomes unreachable, the FastAPI backend automatically diverts the incoming telemetry payloads into a local, temporary SQLite file buffer on ephemeral storage. These logs are re-flushed to BigQuery once connection health is restored, maintaining an actual RPO of **0 minutes** during DB downtime. |

### 2. BigQuery Data Restoration & Verification Drills

BigQuery datasets utilize daily snapshots with a 30-day retention policy. Once per quarter, engineers must execute the following data recovery drills to verify backup integrity.

#### Drill A: Validate Time-Travel Access
Run a SQL validation check in the BigQuery Console to verify that historical data remains queryable using BigQuery's native time-travel features:
```sql
-- Query rows exactly as they existed 1 hour ago
SELECT COUNT(*) 
FROM `cosmos_telemetry.friction_points`
FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR);
```

#### Drill B: Snapshot Restoration Validation
1. Create a verification dataset target:
   ```bash
   bq mk cosmos_telemetry_drill_restore
   ```
2. Restore the daily snapshot into the verification dataset:
   ```bash
   bq cp cosmos_telemetry.friction_points@1723536000 cosmos_telemetry_drill_restore.friction_points_restored
   ```
3. Run count checks against the restored table:
   ```sql
   SELECT COUNT(*) FROM `cosmos_telemetry_drill_restore.friction_points_restored`;
   ```
4. Delete the temporary verification dataset after completing the drill:
   ```bash
   bq rm -r -f cosmos_telemetry_drill_restore
   ```

