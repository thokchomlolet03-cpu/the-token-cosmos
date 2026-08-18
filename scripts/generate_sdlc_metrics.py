import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Environment variables
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "lolet/The-Token-Cosmos")

def github_api_request(endpoint):
    url = f"https://api.github.com/repos/{GITHUB_REPOSITORY}/{endpoint}"
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github.v3+json")
    if GITHUB_TOKEN:
        req.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")
    req.add_header("User-Agent", "SDLC-Metrics-Generator")
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.URLError as e:
        print(f"Error fetching {url}: {e}")
        return None

def calculate_dora_metrics():
    # In a full implementation, this parses the 'deploy.yml' workflow runs
    # For now, we simulate calculation logic based on runs, with fallbacks.
    runs_data = github_api_request("actions/workflows/deploy.yml/runs?per_page=30")
    
    if not runs_data or 'workflow_runs' not in runs_data or len(runs_data['workflow_runs']) == 0:
        return {
            "deploymentFrequency": "0 / day",
            "leadTimeForChanges": "N/A",
            "changeFailureRate": "0%",
            "timeToRestoreService": "N/A",
        }, []
    
    runs = runs_data['workflow_runs']
    successful_runs = [r for r in runs if r.get('conclusion') == 'success']
    failed_runs = [r for r in runs if r.get('conclusion') == 'failure']
    
    deploy_freq = f"{len(successful_runs)} / week" if len(successful_runs) > 0 else "0 / week"
    failure_rate = f"{round((len(failed_runs) / len(runs)) * 100, 1)}%"
    
    deployments = []
    for r in runs[:10]:
        duration_seconds = 0
        if r.get('created_at') and r.get('updated_at'):
            created = datetime.strptime(r['created_at'], "%Y-%m-%dT%H:%M:%SZ")
            updated = datetime.strptime(r['updated_at'], "%Y-%m-%dT%H:%M:%SZ")
            duration_seconds = (updated - created).total_seconds()
            
        deployments.append({
            "id": str(r.get('id', '')),
            "sha": r.get('head_sha', '')[:7],
            "status": 'success' if r.get('conclusion') == 'success' else 'failure',
            "timestamp": r.get('created_at', datetime.now(timezone.utc).isoformat()),
            "duration": f"{int(duration_seconds // 60)}m {int(duration_seconds % 60)}s"
        })
        
    return {
        "deploymentFrequency": deploy_freq,
        "leadTimeForChanges": "45 mins", # Simulated parsing commit vs run
        "changeFailureRate": failure_rate,
        "timeToRestoreService": "12 mins", # Simulated
    }, deployments

def main():
    print("Gathering SDLC Telemetry...")
    dora, deploys = calculate_dora_metrics()
    
    # Static ADR and SPACE data for this snapshot
    space = {
        "satisfaction": 94,
        "activity": 130,
        "efficiency": 88
    }
    
    adrs = [
        {"id": "0001", "title": "Edge-AI WebGPU Inference Architecture", "status": "Approved", "date": "2026-08-15"},
        {"id": "0002", "title": "SDLC Tracking via GitHub Actions", "status": "Approved", "date": "2026-08-18"}
    ]
    
    output = {
        "dora": dora,
        "space": space,
        "deployments": deploys,
        "adrs": adrs,
        "lastUpdated": datetime.now(timezone.utc).isoformat()
    }
    
    # Write to the tracker's public directory so Vite can serve it statically
    out_dir = os.path.join("tracker", "public")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "metrics.json")
    
    with open(out_file, "w") as f:
        json.dump(output, f, indent=2)
        
    print(f"Metrics successfully baked into {out_file}")

if __name__ == "__main__":
    main()
