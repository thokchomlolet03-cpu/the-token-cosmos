---
name: Incident Post-Mortem (RCA)
about: Standard template for auditing Sev1/Sev2 outages and root cause analysis.
title: 'post-mortem: [YYYY-MM-DD] [Brief incident name]'
labels: post-mortem, security-audit
assignees: ''
---

## 1. Incident Metadata

- **Severity Level**: Sev1 (Critical) / Sev2 (Major)
- **Incident Commander (IC)**: @username
- **Outage Start Time**: YYYY-MM-DD HH:MM UTC
- **Resolution Time**: YYYY-MM-DD HH:MM UTC
- **Total Downtime**: XX minutes
- **PagerDuty Incident ID**: #XXXXX
- **Slack Comms Channel**: #incident-xxxx

---

## 2. Executive Summary & Impact

### Outage Summary
Provide a brief, high-level summary of the outage in plain language. (e.g. "An incompatible WebGPU driver update on Android devices caused client-side memory allocation crashes, preventing 15% of mobile users from rendering the 3D starfield canvas.")

### User Symptoms
Describe what users experienced during the outage.

### Business & SLA Impact
- Uptime SLA breached? (Yes/No)
- Latency targets exceeded? (Yes/No)
- Estimated count of affected user sessions:

---

## 3. Timeline of Events

*All times must be logged in UTC.*

- **HH:MM** - Automated healthcheck alert triggers PagerDuty notification.
- **HH:MM** - Incident Commander acknowledges the alert and initiates triage.
- **HH:MM** - IC detects client-side WebGPU OOM exceptions in Sentry logs.
- **HH:MM** - Containment: IC rolls back the Cloud Run container to the last stable revision tag.
- **HH:MM** - Telemetry confirms error rates drop back to 0%. Outage contained.
- **HH:MM** - Root cause isolated: Hotfix PR approved and merged to main.
- **HH:MM** - CD pipeline deploys hotfix revision to production. Uptime checks pass. Incident resolved.

---

## 4. Root Cause Analysis (The 5 Whys)

*Use the "Five Whys" methodology to drill down from the surface symptom to the underlying systemic failure.*

1. **Why** did the client canvas crash?
   - Because the WebGPU memory allocation failed.
2. **Why** did the WebGPU allocation fail?
   - Because...
3. **Why** did...
   - Because...
4. **Why** did...
   - Because...
5. **Why** did...
   - Because... (Systemic / process root cause)

---

## 5. Action Items & Preventative Measures

*Every action item must have an assigned owner and a linked GitHub issue to track implementation.*

| Action Item / Preventative Task | Owner | Linked Issue | Target Date |
| :--- | :---: | :---: | :--- |
| **Short-term**: Revert revision ... | @username | #issue | Complete |
| **Preventative**: Add integration test for ... | @username | #issue | YYYY-MM-DD |
| **Process**: Update Sentry routing filters for ... | @username | #issue | YYYY-MM-DD |

---

## 6. Lessons Learned

- **What went well?** (e.g. Rollback took under 1 minute; telemetry alerts fired instantly).
- **What went poorly?** (e.g. Sentry alerts lacked GPU context; secondary engineer escalations delayed).
- **Where did we get lucky?** (e.g. Outage occurred during low-traffic timezone).
