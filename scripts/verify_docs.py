import os
import re
import sys
from pathlib import Path

# Required files in the documentation suite
REQUIRED_FILES = [
    "index.md",
    "architecture.md",
    "deployment.md",
    "ownership.md",
    "monitoring.md",
    "security.md",
    "disaster_recovery.md",
    "incident_response.md",
    "api.md",
    "sla.md",
    "onboarding.md",
    "user_guide.md",
    "glossary.md",
    "compliance.md",
    "subprocessors.md",
    "changelog.md",
    "testing.md",
    "telemetry_schema.md",
    "adrs/0001-use-edge-webgpu-inference.md",
]

def verify_documentation():
    root_dir = Path(__file__).parent.parent
    docs_dir = root_dir / "docs"
    
    if not docs_dir.exists():
        print(f"Error: docs/ directory does not exist at {docs_dir}")
        return False
        
    print(f"Verifying documentation files in: {docs_dir}")
    
    has_errors = False
    
    # 1. Verify existence of all required files
    print("\n--- Checking File Existence ---")
    for filename in REQUIRED_FILES:
        filepath = docs_dir / filename
        if not filepath.exists():
            print(f"❌ Missing required file: {filename}")
            has_errors = True
        else:
            print(f"✅ Found: {filename}")
            
    if has_errors:
        print("\nSkipping link verification because files are missing.")
        return False
        
    # 2. Verify hyperlinks inside files
    print("\n--- Verifying Relative Markdown Hyperlinks ---")
    
    # Simple regex to capture markdown links: [link text](destination)
    # Ignores external URLs starting with http/https/mailto and anchor links starting with #
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    for filename in REQUIRED_FILES:
        filepath = docs_dir / filename
        print(f"Analyzing links in: {filename}...")
        
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        links = link_pattern.findall(content)
        
        for text, destination in links:
            # Clean up destination (ignore query params or anchors)
            clean_dest = destination.split("#")[0].split("?")[0]
            
            # Skip empty anchors, external links, and system links
            if not clean_dest or clean_dest.startswith(("http://", "https://", "mailto:", "file:///")):
                continue
                
            # Treat relative paths
            dest_path = docs_dir / clean_dest
            
            if not dest_path.exists():
                print(f"  ❌ Broken link in '{filename}': Referenced '{destination}' ('{clean_dest}') which does not exist.")
                has_errors = True
            else:
                pass # Link is valid
                
    if has_errors:
        print("\n❌ Verification Failed: Documentation has errors.")
        return False
    else:
        print("\n✅ Verification Successful: All files exist and all links are intact.")
        return True

if __name__ == "__main__":
    success = verify_documentation()
    sys.exit(0 if success else 1)
