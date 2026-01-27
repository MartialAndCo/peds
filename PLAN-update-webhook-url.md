# Plan: Update Webhook URL

## Overview
Update the Baileys webhook URL from the old Amplify instance (`main.die6qcz48fek8...`) to the new one (`main.d2in5shy58lp10...`) to resolve connection failures and DNS errors.

## Project Type
- **BACKEND** (Docker, Configuration)

## Success Criteria
1. `docker-compose.yml` uses the new URL.
2. `cron` service no longer fails with `ENOTFOUND`.
3. WhatsApp session connects and sends webhooks successfully.

## Tech Stack
- Docker / Docker Compose
- Bash / Cron

## File Structure
No changes to file structure.

## Task Breakdown

### 1. Update Configuration Files
- **Goal**: Replace old URL with `https://main.d2in5shy58lp10.amplifyapp.com/api/webhooks/whatsapp`.
- **Input**: `docker-compose.yml`, `services/cron/crontab`, `scripts/test_virtual_webhook.js`
- **Output**: Files with updated URL.
- **Verification**: `grep` check.

#### Tasks:
1. `[ ]` Update `docker-compose.yml` environment variable `WEBHOOK_URL`.
2. `[ ]` Update `services/cron/crontab` webhook endpoints.
3. `[ ]` Update `scripts/test_virtual_webhook.js` target URL.

### 2. Apply Changes
- **Goal**: Rebuild containers to pick up changes.
- **Input**: Docker daemon.
- **Output**: Running `baos` and `nextjs_cron` containers (recreated).
- **Verification**: `docker ps` and `docker logs`.

#### Tasks:
1. `[ ]` Run `docker-compose down` (optional, for clean slate).
2. `[ ]` Run `docker-compose up -d --build`.

## Phase X: Verification
- [ ] Check logs: `docker logs -f baos` shows "OPEN" without DNS errors.
- [ ] Check cron logs: No `ENOTFOUND`.
