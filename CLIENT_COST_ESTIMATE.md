# BLAK MOH Client Cost Estimate

**Prepared:** 2026-07-26
**Currency:** USD
**Purpose:** a conservative operating budget, not an invoice or a vendor quote.

## What was actually found

- Vercel currently shows the project on the **Hobby** plan. Its public `vercel.app` URL is available, and no BLAK MOH-specific custom domain is attached to the accessible Vercel account.
- The Supabase dashboard supplied by the owner shows Dangote Mentorship on Free/Nano in Frankfurt, with private `portal-files` storage. The application requires Supabase for PostgreSQL, private storage, and Realtime.
- The deployed environment contains configuration for Anthropic, OpenAI, Upstash Redis, Sentry, and Microsoft Graph. It contains legacy S3 variables, but the current application storage implementation uses Supabase rather than S3.
- GitHub repository visibility is public, so standard GitHub-hosted Actions minutes are free.

No secret values, billing dashboards, token use, file-storage volume, or provider usage telemetry were read for this estimate. Usage-driven charges therefore remain variables, not commitments.

## Fixed platform baseline

| Service | Current position | Client-ready recommendation | Monthly | Yearly | Notes |
|---|---|---:|---:|---:|---|
| Vercel hosting | Hobby, $0 | Pro, one developer seat | $20.00 | $240.00 | Hobby is personal/non-commercial only; Pro includes $20 usage credit. Add $20/month per additional developer seat; viewer seats are free. |
| Supabase production | Free/Nano, $0 | Pro, one production project | $25.00 | $300.00 | Includes the first project/compute credit; production backups and non-pausing are the reason to budget Pro. |
| Supabase isolated staging branch | Not yet created | Keep active for ongoing QA | $9.81 | $117.73 | Confirmed branch rate: $0.01344/hour × 730 hours/month. Delete or pause after the test campaign to remove this line. |
| GitHub repository and standard Actions | Public repository | Keep public standard runners | $0.00 | $0.00 | Private repository usage has included-minute/storage limits instead. |

### Fixed total

| Operating posture | Monthly | Yearly |
|---|---:|---:|
| Current free pilot (not suitable for a commercial client launch) | $0.00 | $0.00 |
| Commercial production: Vercel Pro + Supabase Pro | **$45.00** | **$540.00** |
| Commercial production plus always-on isolated staging | **$54.81** | **$657.73** |

## Usage-based or optional services

| Service | Why it exists in this project | Price basis | Budget treatment |
|---|---|---|---|
| Anthropic API | Primary AI adapter, default `claude-sonnet-4-6` | $3/million input tokens + $15/million output tokens | Variable; add a hard monthly cap. |
| OpenAI API | Fallback adapter, default `gpt-4o-mini` | $0.15/million input tokens + $0.60/million output tokens | Variable; fallback use should not be budgeted as a second full primary workload. |
| Upstash Redis | Shared rate limiting when its two environment variables are set | Free tier: 500K commands/month. Pay-as-you-go: $0.20 per 100K commands; fixed plans start at $10/month. | Start at $0 with a $5 monthly usage budget; raise only after telemetry shows the command volume. |
| Sentry | Browser, edge, and server error tracking | Developer: $0 for one user; Team: $26/month | $0 for one owner, or budget $26/month when multiple team members/integrations are needed. |
| Microsoft 365 / Exchange | Required only for live Graph mail/calendar sender mailbox and any organisation policy needs | Business Basic US list price: $6/user/month on annual billing ($7.20 monthly billing) | $0 incremental if the client already owns a suitable licensed mailbox; otherwise budget at least one mailbox. Regional/reseller pricing may differ. |
| Domain | No BLAK MOH custom domain was found in the accessible Vercel account | Depends on chosen TLD/registrar | Not included: choose a domain and obtain the renewal quote before launch. Vercel-managed HTTPS is included. |
| Legacy S3 variables | Variables exist but current source does not select S3 storage | Unknown | Do not budget or renew until the owner confirms a separate S3 workload exists; remove unused credentials after that review. |

## AI cost model

The code limits each request to at most 1,024 output tokens, but actual prompt length is product-dependent. A transparent planning assumption of **2,000 input + 500 output tokens per AI request** gives:

| Provider/model | Estimated cost per request | Estimated cost per 1,000 requests |
|---|---:|---:|
| Anthropic Claude Sonnet 4.6 (primary) | $0.0135 | $13.50 |
| OpenAI GPT-4o mini (fallback) | $0.0006 | $0.60 |

Use this formula for a monthly budget rather than buying a fixed AI subscription:

`$54.81 fixed baseline + (Anthropic requests × $0.0135) + (OpenAI requests × $0.0006) + optional services + platform overages`

For example, a continuously staged pilot with 1,000 Anthropic requests, one Microsoft Basic mailbox, and Sentry Team would be about **$100.31/month** or **$1,203.73/year**, before domain, storage/egress, Vercel overages, and tax. If the client already has Microsoft licensing and uses Sentry Developer, remove $32/month from that example.

## Spend controls required before launch

1. Upgrade the client-owned Vercel team to Pro and set a low hard spend limit/notifications.
2. Put production on Supabase Pro, record usage limits, and explicitly approve the staging branch charge before creating it.
3. Set monthly caps and 70%/90% alerts for Anthropic, OpenAI, Upstash, Sentry, Vercel, and Supabase.
4. Use a client-owned Microsoft 365 mailbox; confirm the actual licence count and regional price with the tenant/reseller.
5. Pick and register the production domain; add its renewal price to the annual operating budget.
6. Recheck this document after 30 days of staging/production telemetry. No request, token, storage, or egress forecast exists yet, so the first month is the calibration period.

## Pricing sources

- [Vercel pricing](https://vercel.com/pricing) and [Hobby-plan restrictions](https://vercel.com/docs/plans/hobby)
- [Supabase pricing](https://supabase.com/pricing)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Sentry pricing](https://sentry.io/pricing/)
- [OpenAI GPT-4o mini pricing](https://developers.openai.com/api/docs/models/gpt-4o-mini)
- [Anthropic Claude Sonnet pricing](https://www.anthropic.com/claude/sonnet)
- [Microsoft 365 Business Basic pricing](https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-business-basic?market=en)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
