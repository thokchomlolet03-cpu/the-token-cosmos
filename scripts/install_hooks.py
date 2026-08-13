import os
import sys
from pathlib import Path

def install_pre_commit_hook():
    root_dir = Path(__file__).parent.parent
    git_dir = root_dir / ".git"
    
    if not git_dir.exists():
        print("Error: .git directory not found. Ensure you run this from within a initialized Git repository.")
        sys.exit(1)
        
    hooks_dir = git_dir / "hooks"
    hooks_dir.mkdir(exist_ok=True)
    
    pre_commit_path = hooks_dir / "pre-commit"
    
    hook_content = """#!/bin/sh
# Programmatic Git Pre-Commit Hook for The Token Cosmos Documentation Linter
# Runs verify_docs.py before allowing a commit to ensure no broken relative links are pushed.

echo "🔍 Running pre-commit documentation check..."

# Run the verify_docs script from the project root
python3 scripts/verify_docs.py
RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo "❌ Error: Documentation link check failed. Commit aborted."
  echo "Please repair the broken relative links or missing files under /docs before committing."
  exit 1
fi

echo "✅ Documentation check passed successfully."
exit 0
"""
    
    try:
        # Write pre-commit hook
        with open(pre_commit_path, "w", encoding="utf-8") as f:
            f.write(hook_content)
            
        # Make the hook executable on Unix systems (like macOS/Linux)
        if os.name != 'nt':
            os.chmod(pre_commit_path, 0o755)
            
        print(f"✅ Successfully installed Git pre-commit hook at: {pre_commit_path}")
        print("The hook will now run automatically on every 'git commit' to prevent pushing broken documentation links.")
        
    except Exception as e:
        print(f"Error: Failed to install pre-commit hook. Detail: {e}")
        sys.exit(1)

if __name__ == "__main__":
    install_pre_commit_hook()
