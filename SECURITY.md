# Security Policy & Vulnerability Disclosure

We take the security of The Token Cosmos seriously. This document outlines how to report security vulnerabilities and our response process.

---

## 1. Supported Versions

We actively monitor and issue security patches for the following versions:

| Version | Supported | Release Date |
| :--- | :---: | :--- |
| **v4.x.x** | ✅ Yes | 2026-08-13 (Current) |
| **v3.x.x** | ❌ No | 2026-02-10 |
| **v2.x.x** | ❌ No | 2025-09-05 |

---

## 2. Reporting a Vulnerability

> [!WARNING]
> Please do **not** report security vulnerabilities via public GitHub issues.

If you discover a security vulnerability (such as a private data leak, Cross-Site Scripting (XSS), or container permission escalation), please report it to us privately:

- **Email**: Send detailed disclosure reports to `security@the-token-cosmos.org`.
- **Details to Include**:
  - Description of the vulnerability.
  - Steps to reproduce (including proof-of-concept scripts or model URLs).
  - Potential impact on client browsers or backend systems.

### Browser Sandbox & WebGPU Exploits
Because the application runs compiled neural networks locally via WebGPU:
- Model calculations are sandboxed by browser drivers.
- If you find a model weight configuration that causes physical GPU timeouts (TDR), system hangs, or browser memory leak escapes, please report it immediately.

---

## 3. Our Response & Remediation Plan

Upon receiving a report:
1. **Acknowledgement**: We will acknowledge receipt of your report within **24 hours**.
2. **Assessment**: Our engineering team will assess the report and coordinate a fix within **7 days**.
3. **Disclosure**: Once a patch is merged, we will credit you in the release notes (unless you request anonymity) and publish the advisory.
