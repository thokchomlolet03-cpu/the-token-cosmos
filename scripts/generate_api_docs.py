import os
import sys
from pathlib import Path

# Add backend to path so we can import main
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir / "backend"))

try:
    from main import app
except ImportError as e:
    print(f"Error: Could not import FastAPI application. Ensure backend dependencies are installed. Detail: {e}")
    sys.exit(1)

def generate_markdown_docs():
    schema = app.openapi()
    
    md = []
    md.append(f"# API Documentation & Integration")
    md.append("")
    md.append("This document is programmatically generated from the FastAPI backend schemas. It provides details on endpoints, request parameters, response schemas, and client integration scripts.")
    md.append("")
    md.append("---")
    md.append("")
    md.append("## 1. General API Information")
    md.append("")
    md.append(f"- **API Title**: {schema.get('info', {}).get('title', 'The Token Cosmos API')}")
    md.append(f"- **API Version**: {schema.get('info', {}).get('version', '2.0.0')}")
    md.append(f"- **Description**: {schema.get('info', {}).get('description', '')}")
    md.append("- **Base URL**: `/` (FastAPI serves both API and frontend SPA)")
    md.append("- **Authentication**: Public access (No auth token required by default).")
    md.append("- **Rate Limits**: Configured at the GCP Cloud Run container layer (concurrency limit is 80 concurrent connections per instance).")
    md.append("")
    md.append("---")
    md.append("")
    md.append("## 2. API Endpoints Reference")
    md.append("")

    paths = schema.get("paths", {})
    for path, methods in paths.items():
        for method, details in methods.items():
            md.append(f"### `{method.upper()} {path}`")
            md.append("")
            md.append(f"**Summary**: {details.get('summary', 'No summary provided')}")
            if details.get('description'):
                md.append(f"**Description**: {details.get('description')}")
            md.append("")

            # Request Body
            request_body = details.get("requestBody", {})
            if request_body:
                md.append("#### Request Body Schema")
                md.append("")
                content = request_body.get("content", {})
                json_schema = content.get("application/json", {}).get("schema", {})
                ref_link = json_schema.get("$ref")
                if ref_link:
                    schema_name = ref_link.split("/")[-1]
                    md.append(f"This endpoint requires a JSON body matching the **[{schema_name}](#{schema_name.lower()})** schema.")
                else:
                    md.append("Custom JSON Schema payload required.")
                md.append("")

            # Responses
            responses = details.get("responses", {})
            if responses:
                md.append("#### Response Statuses")
                md.append("")
                md.append("| HTTP Code | Description | Schema |")
                md.append("| :--- | :--- | :--- |")
                for code, resp_details in responses.items():
                    desc = resp_details.get("description", "No description")
                    schema_ref = resp_details.get("content", {}).get("application/json", {}).get("schema", {}).get("$ref", "")
                    schema_text = "None"
                    if schema_ref:
                        ref_name = schema_ref.split("/")[-1]
                        schema_text = f"[{ref_name}](#{ref_name.lower()})"
                    md.append(f"| `{code}` | {desc} | {schema_text} |")
                md.append("")

            md.append("---")
            md.append("")

    md.append("## 3. Data Schemas (Pydantic Models)")
    md.append("")

    schemas = schema.get("components", {}).get("schemas", {})
    for schema_name, schema_info in schemas.items():
        md.append(f"### `{schema_name}`")
        if schema_info.get("description"):
            md.append(f"*{schema_info.get('description')}*")
        md.append("")
        md.append("| Field Name | Type | Required | Description / Constraints |")
        md.append("| :--- | :--- | :---: | :--- |")
        
        properties = schema_info.get("properties", {})
        required_fields = schema_info.get("required", [])
        
        for prop_name, prop_details in properties.items():
            prop_type = prop_details.get("type", "unknown")
            is_req = "Yes" if prop_name in required_fields else "No"
            
            # Format types for lists and refs
            if prop_details.get("items"):
                items_ref = prop_details["items"].get("$ref")
                if items_ref:
                    prop_type = f"Array of [{items_ref.split('/')[-1]}](#{items_ref.split('/')[-1].lower()})"
                else:
                    prop_type = f"Array of {prop_details['items'].get('type', 'unknown')}"
            elif prop_details.get("$ref"):
                ref_name = prop_details["$ref"].split("/")[-1]
                prop_type = f"[{ref_name}](#{ref_name.lower()})"
            
            # Constraints and Description
            description = prop_details.get("description", "")
            constraints = []
            if "minimum" in prop_details:
                constraints.append(f"min: {prop_details['minimum']}")
            if "maximum" in prop_details:
                constraints.append(f"max: {prop_details['maximum']}")
            if "default" in prop_details:
                constraints.append(f"default: `{prop_details['default']}`")
            
            constraint_text = ", ".join(constraints)
            desc_text = description
            if constraint_text:
                desc_text += f" ({constraint_text})" if desc_text else constraint_text
            
            md.append(f"| `{prop_name}` | `{prop_type}` | {is_req} | {desc_text or '-'} |")
        md.append("")
        md.append("---")
        md.append("")

    # Add code examples
    md.append("## 4. Integration Code Snippets")
    md.append("")
    md.append("### Python Request Example")
    md.append("```python")
    md.append("""import requests

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
```""")
    md.append("")
    md.append("### Javascript / Node.js Example")
    md.append("```javascript")
    md.append("""const url = "https://the-token-cosmos.run.app/api/logits";
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
```""")
    md.append("")
    md.append("### Curl Command Example")
    md.append("```bash")
    md.append("""curl -X POST "https://the-token-cosmos.run.app/api/logits" \\
     -H "Content-Type: application/json" \\
     -d '{
       "prompt": "What is gravity?",
       "system_prompt": "Explain briefly.",
       "rag_context": "Gravity is a fundamental interaction.",
       "top_n": 10
     }'
```""")
    md.append("")

    return "\n".join(md)

if __name__ == "__main__":
    docs_dir = root_dir / "docs"
    docs_dir.mkdir(exist_ok=True)
    
    print("Generating API reference markdown...")
    markdown_content = generate_markdown_docs()
    
    api_docs_path = docs_dir / "api.md"
    with open(api_docs_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)
        
    print(f"Successfully generated {api_docs_path}")
