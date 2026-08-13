import os
import re
import sys
from pathlib import Path

# High-precision patterns for actual security credentials
SECRET_PATTERNS = {
    "Google Cloud Private Key": re.compile(r"-----BEGIN PRIVATE KEY-----"),
    "Google API Key": re.compile(r"AIzaSy[a-zA-Z0-9_\-]{33}"),
    "AWS Access Key ID": re.compile(r"AKIA[0-9A-Z]{16}"),
    "Stripe API Key": re.compile(r"sk_live_[0-9a-zA-Z]{24}"),
    "Hardcoded Assignment (secret/password)": re.compile(
        r"(db_password|password|passwd|secret_key|api_key|client_secret|private_key)\s*[:=]\s*['\"][a-zA-Z0-9_\-\+]{12,}['\"]", 
        re.IGNORECASE
    ),
}

# Directories and files to exclude from scanning
EXCLUDE_DIRS = {".git", "node_modules", "site", ".venv", "__pycache__", "dist", "build"}
EXCLUDE_FILES = {"detect_secrets.py", "package-lock.json", "requirements.txt"}

# Ignore lines containing comments or mock patterns
SAFE_SUBSTRINGS = ["# nosec", "mock", "synthetic", "test-key", "sample", "localhost", "example", "dummy"]

def scan_file_for_secrets(filepath: Path) -> list:
    findings = []
    try:
        # Skip binary files
        if filepath.suffix in [".bin", ".png", ".jpg", ".jpeg", ".webp", ".pdf", ".gguf", ".DS_Store"]:
            return []
            
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f, 1):
                # Ignore lines that are comments or clearly mock settings
                if any(safe in line.lower() for safe in SAFE_SUBSTRINGS):
                    continue
                
                # Check for matches
                for pattern_name, regex in SECRET_PATTERNS.items():
                    matches = regex.findall(line)
                    if matches:
                        findings.append((idx, pattern_name, line.strip()))
                        break
    except Exception:
        pass
    return findings

def main():
    root_dir = Path(__file__).parent.parent
    print("🔍 Scanning repository for hardcoded secrets and credentials...")
    
    violations = {}
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Exclude directories in-place
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        
        for filename in filenames:
            if filename in EXCLUDE_FILES:
                continue
            
            filepath = Path(dirpath) / filename
            findings = scan_file_for_secrets(filepath)
            if findings:
                violations[str(filepath.relative_to(root_dir))] = findings

    if violations:
        print("\n❌ Error: Hardcoded secrets or credentials detected in the codebase!")
        for file_rel, findings in violations.items():
            print(f"\n📄 File: {file_rel}")
            for line_no, pattern_name, line_content in findings:
                print(f"  Line {line_no} ({pattern_name}): {line_content[:80]}")
        print("\nPlease remove these credentials or exclude them using '# nosec' annotations.")
        sys.exit(1)
    else:
        print("✅ Secrets Scan Successful: No hardcoded secrets found.")
        sys.exit(0)

if __name__ == "__main__":
    main()
