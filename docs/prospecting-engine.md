# Daily prospecting engine

Archic Control owns the commercial pre-project loop as well as delivery QA. The objective is not to generate a large lead list. The objective is to produce **one unusually well-researched, presentation-ready opportunity per day** without wasting build time on dead, ambiguous or low-value businesses.

## Daily loop

1. Search several candidate businesses in commercially relevant geographies and sectors.
2. Exclude existing Archic projects and businesses already processed by the prospecting history.
3. Deep-research the strongest candidates with current web search.
4. Verify that the business still appears to be operating.
5. Score fit, digital gap, ability to pay, contactability and prototype leverage.
6. Reject anything below `PROSPECTING_MIN_SCORE` (80 by default).
7. Spend the daily build slot on only one verified candidate.
8. Build a self-contained Next.js prototype using grounded business information and the strongest usable image from the official site's Open Graph metadata when available.
9. Create a dedicated GitHub repository.
10. Create/link a Vercel project and trigger a production deployment.
11. Persist evidence, research, score, price, outreach copy, repository and deployment URL.
12. Create a non-blocking `Needs Vadim` decision so Vadim can review the opportunity before any outreach.

Control never contacts a prospect automatically.

## Operating-status verification

The phrase “100% sure it is open” is not attainable from public web data alone. Control therefore uses a conservative operational definition instead of pretending certainty.

A candidate is allowed to consume the daily prototype slot only when all of the following hold:

- at least three independent evidence hostnames;
- an official/current website that Control can reach;
- at least one dated recent activity signal within `PROSPECTING_FRESH_DAYS` (30 by default), such as an official social post, current booking/availability, or recent credible coverage;
- at least two evidence URLs independently reachable by Control;
- no credible closure, relocation, temporary-closure or prolonged-inactivity contradiction;
- commercial score at or above the configured threshold.

`observedAt` must be a date actually shown by the source. The model is explicitly forbidden from using the current access date as a fabricated publication date.

If verification fails, Control excludes that candidate and searches again. It can reject up to three researched candidates in one daily iteration. If none qualifies, the date is stored as `discarded` and no prototype is created.

## Prototype policy

Daily prototypes are concepts, not production client sites. They must still be structurally sound and presentation-ready:

- responsive Next.js baseline;
- restrained premium typography and composition;
- no invented business metrics, awards, services, fleet sizes or claims;
- current services and copy grounded in research;
- official Open Graph imagery when it can be safely resolved;
- semantic sections and accessible navigation;
- reduced-motion support;
- direct enquiry CTA using a verified WhatsApp/email when available;
- repository README clearly labels the site as an Archic concept prototype.

A successful Vercel build is the publication gate. After a prospect becomes a real opportunity/client, it moves into the normal Archic Quality Standard, Playwright, benchmark and polish pipeline.

## Pricing and outreach

Research returns a minimum, target and maximum one-off price plus optional monthly maintenance. The target price is what Control recommends based on scope and business value. The range is context for negotiation, not an automatic discount ladder.

Outreach copy is generated for Vadim to review. It must not imply an existing relationship, promise unsupported results, or claim the prototype is official. The business is never contacted by the daily cron.

## Required configuration

- `DATABASE_URL`
- `CRON_SECRET`
- `OPENAI_API_KEY`
- `PROSPECTING_MODEL`
- `GITHUB_AUTOMATION_TOKEN`
- `GITHUB_PROSPECT_OWNER`
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`

Optional tuning:

- `PROSPECTING_MIN_SCORE=80`
- `PROSPECTING_FRESH_DAYS=30`
- `PROSPECT_REPOS_PRIVATE=false`

## Failure behavior

Failures are explicit. Control never writes a fake `ready` record.

- Missing credentials: the run reports `not_configured` and does not consume the date.
- No trustworthy candidate: `discarded`; no repository or deployment.
- GitHub/Vercel failure after verification: `blocked`; research is preserved and a `Needs Vadim` item explains the provider failure.
- Successful research + repository + deployment: `ready` with both URLs and the commercial handoff.
