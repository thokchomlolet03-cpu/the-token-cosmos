# Telemetry & BigQuery Data Pipeline

This document outlines the data schemas, retention guidelines, and service authentication flows for streaming user telemetry metrics to Google Cloud BigQuery for enterprise performance auditing.

---

## 1. System Overview

To track model performance and parameter configurations across various clients, the system is designed to stream anonymized usage data to **Google Cloud BigQuery** in real-time.

```
                  TELEMETRY PIPELINE DESIGN
                  
   ┌───────────────────┐        ┌──────────────────┐        ┌─────────────────┐
   │ Client Telemetry  │ ────-> │   FastAPI Host   │ ────-> │  Google Cloud   │
   │ (VRAM, Speed, UI) │        │ (Metadata Service│        │    BigQuery     │
   └───────────────────┘        └──────────────────┘        └─────────────────┘
                                         |
                                         v
                                  (PII Stripped)
```

> [!IMPORTANT]
> **Data Privacy Mandate**: Prompts, system prompts, context texts, and generated words are **explicitly excluded** from telemetry payloads. Only numerical parameters and speed indexes are tracked, keeping the platform compliant with GDPR and CCPA guidelines.

---

## 2. BigQuery Telemetry Schema

The telemetry records are ingested into the BigQuery table `cosmos_telemetry.performance_logs` using the following schema specifications:

| Field Name | Data Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `timestamp` | `TIMESTAMP` | Yes | UTC execution date and time. |
| `session_id` | `STRING` | Yes | Ephemeral UUID identifying the client session (wiped on reload). |
| `model_id` | `STRING` | Yes | Active model loaded (e.g. `SmolLM2-135M-Instruct-q4f16_1-MLC`). |
| `engine` | `STRING` | Yes | Inference type: `webgpu`, `wasm`, `llama-cpp`, or `synthetic`. |
| `step_count` | `INTEGER` | Yes | Total tokens generated in this sequence. |
| `generation_time_ms` | `FLOAT` | Yes | Total duration of the token generation run in milliseconds. |
| `tokens_per_second` | `FLOAT` | Yes | Throughput speed: `step_count / (generation_time_ms / 1000)`. |
| `vram_allocated_mb` | `INTEGER` | No | VRAM GPU memory reservation reported by WebGPU. |
| `temperature` | `FLOAT` | Yes | Active Temperature parameter. |
| `top_k` | `INTEGER` | Yes | Active Top-K parameter. |
| `top_p` | `FLOAT` | Yes | Active Top-P parameter. |
| `min_p` | `FLOAT` | Yes | Active Min-P parameter. |
| `browser` | `STRING` | Yes | Browser name parsed from User-Agent (e.g. `Chrome 122`). |

---

## 3. Data Retention & Compliance Rules

To comply with SOC 2, CCPA, and GDPR data minimization requirements, the platform enforces automated data lifecycles and complete PII segregation.

### 1. BigQuery Partition Expiration (TTL)
To avoid manual deletion scripts and guarantee database-level pruning, all telemetry tables implement **time-partitioning expiration**:
- **TTL Limit**: 90 Days (7,776,000 seconds).
- **Automated Drops**: BigQuery automatically purges partitioned data partitions once their partition date (calculated from the `timestamp` field) exceeds the 90-day threshold.
- **Configuration Commands**:
  ```bash
  # Enforce 90-day automatic partition expiration on performance logs
  bq update --time_partitioning_expiration 7776000 <GCP_PROJECT_ID>:cosmos_telemetry.performance_logs

  # Enforce 90-day automatic partition expiration on friction points
  bq update --time_partitioning_expiration 7776000 <GCP_PROJECT_ID>:cosmos_telemetry.friction_points
  ```

### 2. Anonymization & Session Isolation
- **No Cookies or LocalStorage**: The `session_id` is an ephemeral UUID generated in-memory on page load via `crypto.randomUUID()`. It is never stored in persistent browser cookies, indexDB, or local storage.
- **Volatile Lifespan**: Closing the browser tab destroys the `session_id` context. Subsequent visits generate entirely new, uncorrelated session identifier strings.
- **PII Strip-Check**: Telemetry endpoint routes (e.g. `POST /api/telemetry`) accept only numeric indicators (tokens/second, temperature, min_p, model_id, etc.). Any string payload containing prompt inputs or generated text is rejected by schema validation filters on the FastAPI backend before reaching database storage. Because no database record maps back to user identities, the dataset is permanently anonymous.


---

## 4. Service Authentication Flow

No static BigQuery API keys or passwords are saved inside the application. Access permissions follow the Principle of Least Privilege (PoLP):

1. **Service Identity**: The Google Cloud Run container is assigned a custom Service Account identity (e.g. `telemetry-writer@<gcp-project>.iam.gserviceaccount.com`).
2. **IAM Permissions**: The Service Account is granted only the **BigQuery Data Editor** (`roles/bigquery.dataEditor`) role on the specific dataset.
3. **Application Auth**: The FastAPI code uses Google's standard library credentials:
   ```python
   from google.cloud import bigquery
   # Client automatically retrieves OAuth tokens from GCP metadata service
   client = bigquery.Client()
   ```

---

## 5. Friction Hunter Ingestion & Synchronization Pipeline

The **Friction Hunter** is a diagnostic bridge that analyzes the logical flow of text sequences. It monitors points where the mathematical transition probability drops abruptly between consecutive phrases. This pipeline, including the client-side buffers and the BigQuery synchronization script backend, was deployed in **August 2026** alongside the version `v4.1.0` release.

### Ingestion Flow & Buffering
1. **Calculation**: The client-side logic calculates consecutive log-probability differences $D_i$ at 60 FPS.
2. **Detection**: Friction points are flagged if $D_i$ exceeds the $\sigma$-based sensitivity threshold (formula: $D_i > \mu + \theta_\sigma \times \sigma \times 0.5$).
3. **Buffering**: To prevent spamming HTTP connections, the client buffers these events in memory. When the buffer reaches 5 events, or the user navigates away, the client streams the payload via `POST /api/telemetry/friction`.
4. **Backend Routing**: FastAPI receives the JSON payload, validates it, and streams the events into BigQuery.

### BigQuery Friction Schema (`cosmos_telemetry.friction_points`)

| Column Name | Type | Constraint | Description |
| :--- | :---: | :---: | :--- |
| `timestamp` | `TIMESTAMP` | Required | Ingestion date/time. |
| `session_id` | `STRING` | Required | Unique session UUID (PII-free). |
| `phrase` | `STRING` | Required | The text fragment that caused the drop (e.g. "Select * from"). |
| `log_prob_drop` | `FLOAT` | Required | The logit difference $D_i$. |
| `previous_log_prob`| `FLOAT` | Required | Probability before the drop. |
| `current_log_prob` | `FLOAT` | Required | Probability after the drop. |
| `severity` | `STRING` | Required | Severity rating: `critical`, `warning`, or `info`. |
| `reason` | `STRING` | Required | Structured text reason string indicating why the drop occurred. |

### BigQuery Partitioning & Cost Controls
To minimize analysis costs, the `friction_points` table is partitioned by day using the `timestamp` field:
- **Partition Filter**: All analytical queries must include a filter on `timestamp` (e.g. `WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)`).
- **Clustering**: Rows are clustered by `severity` and `model_id` to speed up filtering on critical failures.

