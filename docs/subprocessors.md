# Third-Party Subprocessor Registry

To comply with the General Data Protection Regulation (GDPR), California Consumer Privacy Act (CCPA), and enterprise vendor security assessments, **The Token Cosmos** maintains a public register of all third-party subprocessors authorized to process platform telemetry and inference requests.

---

## 1. Active Subprocessor Registry

The following entities process telemetry parameters, runtime exception logs, or server-side API inference logs:

| Subprocessor | Purpose | Data Transferred | Processing Location | Privacy & DPA Link |
| :--- | :--- | :--- | :--- | :--- |
| **Google Cloud Platform (GCP)** | - Application hosting (Cloud Run).<br>- Ephemeral container storage.<br>- Telemetry database (BigQuery). | - Ephemeral session IDs.<br>- Generation speed metrics.<br>- Device properties (Browser/OS).<br>- Model weights parameters (top_p, min_p). | `us-central1` (Iowa, USA) | [GCP Privacy Agreement](https://cloud.google.com/terms/data-processing-terms) |
| **Functional Software, Inc. (Sentry)** | - Client-side WebGPU exception logging.<br>- Server-side error stack trace capture. | - JavaScript stack traces.<br>- Ephemeral browser console logs.<br>- Client hardware characteristics (GPU adapter details). | United States (Global Multi-Tenant) | [Sentry Privacy Policy](https://sentry.io/privacy/) |
| **OpenAI / Anthropic / GCP Vertex AI** | - Tier 3 server-side fallback logits processing. | - Prompt input string.<br>- System instruction parameters.<br>- Generation configurations (temperature, top_k).<br>- *Note: Excluded from telemetry unless fallback is active.* | United States (API Endpoints) | [OpenAI Enterprise Privacy](https://openai.com/enterprise-privacy) / [Anthropic DPA](https://www.anthropic.com/legal/dpa) |

---

## 2. Data Processing Addendums (DPAs) & SCCs

The Token Cosmos ensures that all subprocessors listed above operate under executed **Data Processing Addendums (DPAs)** incorporating the European Commission's **Standard Contractual Clauses (SCCs)**.

### Policy Directives:
- **Least Privilege Access**: Subprocessors are restricted to the minimum datasets required to perform their diagnostic or hosting services.
- **No Data Selling**: Under no circumstances is telemetry metadata sold, shared for cross-context behavioral advertising, or reused by subprocessors to train third-party model weights.
- **Audit Verification Cadence**: The compliance team reviews subprocessor SOC 2 Type II reports and privacy policies annually to ensure security controls remain aligned with enterprise safety commitments.
