# API Documentation & Integration

This document is programmatically generated from the FastAPI backend schemas. It provides details on endpoints, request parameters, response schemas, and client integration scripts.

---

## 1. General API Information

- **API Title**: The Token Cosmos API
- **API Version**: 2.0.0
- **Description**: FastAPI Backend for raw LLM candidate logits with System Override & BYOE support
- **Base URL**: `/` (FastAPI serves both API and frontend SPA)
- **Authentication**: Public access (No auth token required by default).
- **Rate Limits**: Configured at the GCP Cloud Run container layer (concurrency limit is 80 concurrent connections per instance).

---

## 2. API Endpoints Reference

### `GET /`

**Summary**: Read Root

#### Response Statuses

| HTTP Code | Description | Schema |
| :--- | :--- | :--- |
| `200` | Successful Response | None |

---

### `GET /api/health`

**Summary**: Api Health

#### Response Statuses

| HTTP Code | Description | Schema |
| :--- | :--- | :--- |
| `200` | Successful Response | None |

---

### `POST /api/logits`

**Summary**: Get Logits

#### Request Body Schema

This endpoint requires a JSON body matching the **[LogitRequest](#logitrequest)** schema.

#### Response Statuses

| HTTP Code | Description | Schema |
| :--- | :--- | :--- |
| `200` | Successful Response | [LogitResponse](#logitresponse) |
| `422` | Validation Error | [HTTPValidationError](#httpvalidationerror) |

---

## 3. Data Schemas (Pydantic Models)

### `HTTPValidationError`

| Field Name | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `detail` | `Array of [ValidationError](#validationerror)` | No | - |

---

### `LogitRequest`

| Field Name | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `prompt` | `string` | Yes | - |
| `system_prompt` | `unknown` | No | - |
| `rag_context` | `unknown` | No | - |
| `top_n` | `integer` | No | min: 1.0, max: 200.0, default: `50` |

---

### `LogitResponse`

| Field Name | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `candidates` | `Array of [TokenCandidate](#tokencandidate)` | Yes | - |
| `prompt` | `string` | Yes | - |
| `system_prompt` | `unknown` | No | - |
| `rag_enabled` | `boolean` | Yes | - |
| `engine` | `string` | Yes | - |
| `processing_time_ms` | `number` | Yes | - |

---

### `TokenCandidate`

| Field Name | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `token_id` | `integer` | Yes | - |
| `token_str` | `string` | Yes | - |
| `raw_logit` | `number` | Yes | - |
| `is_rag_grounded` | `boolean` | No | default: `False` |

---

### `ValidationError`

| Field Name | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `loc` | `Array of unknown` | Yes | - |
| `msg` | `string` | Yes | - |
| `type` | `string` | Yes | - |
| `input` | `unknown` | No | - |
| `ctx` | `object` | No | - |

---

## 4. Integration Code Snippets

### Python Request Example
```python
import requests

url = "https://the-token-cosmos.run.app/api/logits"
payload = {
    "prompt": "What is gravity?",
    "system_prompt": "Explain briefly.",
    "rag_context": "Gravity is a fundamental interaction.",
    "top_n": 50
}

response = requests.post(url, json=payload)
data = response.json()

for candidate in data["candidates"]:
    print(f"Token: {candidate['token_str']} | Logit: {candidate['raw_logit']}")
```

### Javascript / Node.js Example
```javascript
const url = "https://the-token-cosmos.run.app/api/logits";
const payload = {
  prompt: "What is gravity?",
  system_prompt: "Explain briefly.",
  rag_context: "Gravity is a fundamental interaction.",
  top_n: 50
};

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => {
  data.candidates.forEach(c => {
    console.log(`Token: ${c.token_str} | Logit: ${c.raw_logit}`);
  });
});
```

### Curl Command Example
```bash
curl -X POST "https://the-token-cosmos.run.app/api/logits" \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "What is gravity?",
       "system_prompt": "Explain briefly.",
       "rag_context": "Gravity is a fundamental interaction.",
       "top_n": 10
     }'
```
