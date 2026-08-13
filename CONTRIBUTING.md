# Contributing to The Token Cosmos

We welcome contributions from the community! To maintain code quality, security compliance, and comprehensive documentation, please adhere to the following development guidelines.

---

## 1. Branch Naming Conventions

When creating branches in Git, use the following prefix styles:

- `feature/summary-of-feature`: For new features or visual enhancements (e.g. `feature/3d-canvas-rotations`).
- `bugfix/summary-of-fix`: For resolving bugs or interface crashes (e.g. `bugfix/mobile-telemetry-overflow`).
- `docs/summary-of-update`: For documentation-only modifications (e.g. `docs/fix-sla-typo`).
- `refactor/summary-of-change`: For code cleanup without changing feature behavior.

---

## 2. Commit Message Standards

We enforce the **Conventional Commits** format. Each commit message must follow this structure:

```
<type>(<scope>): <short description>
```

### Supported Types
- `feat`: A new feature (e.g. `feat(webgpu): add SmolLM2 quantization tier`).
- `fix`: A bug resolution (e.g. `fix(softmax): prevent negative log division`).
- `docs`: Documentation updates only (e.g. `docs(security): update COOP header detail`).
- `style`: Formatting, spacing, CSS modifications (no functional logic changes).
- `test`: Adding or correcting tests (e.g. `test(api): add logit endpoint validation`).
- `chore`: Infrastructure updates, package bumps, pre-commit hook installations.

---

## 3. Pull Request Requirements

Before opening a pull request, complete the following pre-flight checklist:

1. **Verify Builds**:
   - Run `npm run build` in `/frontend` to verify TypeScript compile and Vite asset bundle.
2. **Run Backend Tests**:
   - Execute backend tests: `cd backend && python -m unittest discover -s . -p 'test_*.py'`.
3. **Validate Documentation**:
   - If you modified FastAPI endpoints in `backend/main.py`, run `python scripts/generate_api_docs.py` to update the API reference.
   - Run `python scripts/verify_docs.py` to ensure that you did not introduce any broken relative hyperlinks.
   - Run `mkdocs build` to check that the site compiles without warnings.
