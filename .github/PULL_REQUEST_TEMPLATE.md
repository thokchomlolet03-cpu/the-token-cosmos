## Description

Provide a brief summary of the changes proposed in this Pull Request and their technical context.

## Related Issues
Closes # (issue number)

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update (non-functional changes to `/docs` or `/README.md`)

## Pre-flight Quality Checklist

Please check all items that apply to this PR:

- [ ] **Code Builds**: My code builds successfully locally (running `npm run build` in `/frontend`).
- [ ] **Tests Pass**: Backend unit tests execute and pass without errors (`cd backend && python -m unittest discover`).
- [ ] **API Reference Sync**: If I altered FastAPI Pydantic models or endpoint routes, I regenerated the API reference by running `python scripts/generate_api_docs.py`.
- [ ] **Documentation Linter**: I ran `python scripts/verify_docs.py` and confirmed there are no broken relative links in the `/docs` files.
- [ ] **Documentation Compiles**: Running `mkdocs build` locally completes without any markdown warnings or errors.
- [ ] **Local Verification**: I tested the changes inside a browser and confirmed both local WebGPU execution and API fallback behavior operate correctly.
