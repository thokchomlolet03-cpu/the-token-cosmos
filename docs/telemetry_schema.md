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

- **PII Protections**: Payloads are checked at the API Gateway; if text fields are present in the telemetry endpoint payload, the gateway rejects the transmission.
- **Raw Event Logs**: Detailed rows are preserved in BigQuery for **90 days**, after which they are automatically pruned.
- **Aggregated Metric Tables**: Daily aggregates (e.g. average tokens/sec, support rate by browser) are computed via scheduled SQL queries and retained **indefinitely** for long-term capability trends.

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
