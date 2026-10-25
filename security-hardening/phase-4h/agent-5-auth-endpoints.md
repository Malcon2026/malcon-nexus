# Agent 5 — Auth endpoints & rate limits

## Public / semi-public endpoints

| Endpoint | Auth | Production behavior |
|----------|------|---------------------|
| `POST /api/auth/login` | None | Admin email/password; 10 / 15 min per email (`memoryRateLimit`) |
| `POST /api/auth/request-otp` | None | Employee code → Telegram OTP |
| `POST /api/auth/verify-otp` | None | Issues JWT on success |
| `POST /api/telegram/webhook` | `x-telegram-bot-api-secret-token` | 401 if missing/wrong in prod |
| `POST /api/case-alerts/process` | `x-cron-secret` | 401 if wrong |

## Protected API

- Production requires mapped employee (`ENVIRONMENT=production`; `API_REQUIRE_AUTH` not set to `0`).
- Unauthenticated `/api/*` → 401.

## Phase 4F edge (unchanged)

- API GW stage throttle 50 r/s, burst 100.
- WAF `malcon-nexus-api-edge` on ALB (managed rules + IP rate limit).
