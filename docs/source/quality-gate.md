# Archic Quality Gate — canonical source snapshot

Source: `vornicx/archic-design-system@fa3c04edbcaa5c0f7d26eb2460dc1b22a4c2f7be`

# The Archic Quality Gate

**Pass/fail. Not advisory.**

Run before every delivery, on the real site, on real devices, with real content. Every unchecked box is either fixed or justified **in writing** in the sign-off document. There is no third option.

Time-box: half a day for a standard site. If that seems like a lot, compare it to the cost of a client finding these things.

---

## How to run it

1. **Fresh eyes.** Whoever built it should not be the only one running it. If Archic is one person, run it a day later, on a different machine, at a different time of day. Distance is the point.
2. **Real devices.** A real iPhone, a real mid-range Android, a laptop, a large monitor.
3. **Mode-appropriate content.** Production uses production data, real/authorized photography and real copy. Prototype uses realistic content and provenance-tracked representative assets without presenting concept material as documentary truth.
4. **Real connection.** Throttled at least once. Ideally on actual mobile data.
5. **Record every finding.** Screenshot, location, severity. No mental notes.

---

## A · Brand coherence

- [ ] The identity is consistent across every page and every state
- [ ] Typefaces used as specified — no stray system fonts, no unintended weights
- [ ] Colours from the token set only — no hardcoded hex anywhere (`grep -rE "#[0-9a-fA-F]{3,8}" src/` returns only tokens and documented exceptions)
- [ ] Tone of voice consistent — including error messages, empty states, confirmation emails and the 404
- [ ] Iconography consistent in weight, size, terminals and metaphor
- [ ] Favicon, app icons, OG images all present and correct
- [ ] The site would look wrong with a competitor's logo on it
- [ ] **Direction Vector divergence check passed and recorded** in the project registry

## B · Visual craft

- [ ] All alignments correct — optically, not just mathematically
- [ ] Spacing from the scale everywhere; no arbitrary values
- [ ] Rhythm consistent page to page
- [ ] Hierarchy clear on every screen (blur test at 12 px produces the intended grouping)
- [ ] No orphans in headlines or pull quotes at any breakpoint
- [ ] Tracking correct at every size
- [ ] All images ≥2× density; no compression artefacts, no upscaling, no soft downscales
- [ ] Crops correct at every breakpoint — **looked at, not assumed**
- [ ] Consistent grade across the whole image set
- [ ] Aspect ratios consistent within each set
- [ ] No layout shift on load — watch it load, don't just read the CLS number
- [ ] Text never sits on an unmanaged photograph

## C · Interaction

- [ ] Every interactive element has all six states
- [ ] Hover ≤140 ms, everywhere
- [ ] Focus visible on every element, ≥3:1, never removed
- [ ] Loading states hold layout — button widths do not change
- [ ] Transitions consistent with the declared motion intensity
- [ ] Dialogs: focus trapped, restored, Escape closes, scroll locked without shift
- [ ] Drawers slide from their own edge; swipe-dismiss on touch
- [ ] No hover-only information or actions
- [ ] Feedback within 100 ms of every action
- [ ] Repeated-path interactions under 200 ms

## D · UX

- [ ] Primary task completable in the minimum reasonable steps
- [ ] Navigation clear; current location always evident
- [ ] One primary action per view
- [ ] Every form: validation, errors, success, preserved input
- [ ] Every error says what happened, why, and what to do next
- [ ] Every empty state designed, not defaulted
- [ ] Destructive actions reversible or specifically confirmed
- [ ] Back button works; scroll position restored
- [ ] Deep links work, including filtered views
- [ ] 404 and 500 pages designed and helpful
- [ ] The interaction signature exists and works on touch

## E · Responsive

- [ ] 320 px — no horizontal overflow anywhere
- [ ] 375 px — the mobile composition, not a squeeze
- [ ] 768 px — decided explicitly, not left to chance
- [ ] 1024 / 1440 / 2560 px
- [ ] Landscape phone (short viewport — sticky headers do not eat the screen)
- [ ] 200% browser zoom — nothing lost, nothing overlapping
- [ ] Touch targets ≥44 px, ≥8 px apart
- [ ] Sticky elements do not cover content; safe areas respected
- [ ] Tables have a real mobile strategy
- [ ] Forms usable with the on-screen keyboard open

## F · Content

- [ ] Zero Lorem ipsum, zero placeholder images, zero `TODO`
- [ ] Every headline passes the find-and-replace test
- [ ] Zero banned phrases from the [anti-slop registry](../00-foundation/05-anti-slop-registry.md)
- [ ] Spelling and grammar checked by a native speaker, in every language
- [ ] All facts verified with the client — prices, hours, addresses, phone numbers, names, dates
- [ ] **Every phone number dialled. Every email sent to. Every link clicked.**
- [ ] Every map pin checked against the real address
- [ ] Legal pages present and current (privacy, cookies, terms, and for Spain: aviso legal / LSSI)
- [ ] Every language complete — no untranslated strings
- [ ] Copyright year correct and auto-updating

## G · Technical

- [ ] LCP ≤2.0 s, INP ≤200 ms, CLS ≤0.05 on a mid-tier Android over 4G
- [ ] Lighthouse ≥90 performance, ≥95 accessibility, ≥95 best practices, ≥95 SEO
- [ ] axe DevTools: zero violations
- [ ] Primary task completable by keyboard alone
- [ ] Screen reader tested on the primary flow
- [ ] Reduced motion verified **by using the site with it enabled**
- [ ] Semantic HTML; one `<h1>`; no skipped heading levels
- [ ] Meta titles and descriptions unique and written, not generated
- [ ] OG and Twitter cards present, tested in a real preview
- [ ] Structured data where relevant (LocalBusiness, Restaurant, Product, Article)
- [ ] `sitemap.xml`, `robots.txt`, canonical URLs
- [ ] 301s from any old URLs
- [ ] HTTPS, HSTS, security headers
- [ ] Forms tested end to end — **including that the email actually arrives**
- [ ] Analytics and RUM installed and firing
- [ ] Cookie consent compliant and not blocking rendering
- [ ] Tested in Safari, Chrome, Firefox, and Safari iOS

## H · System integrity

- [ ] `node tools/validate-project.mjs project.config.json` exits 0
- [ ] `styles/foundation.css` and `styles/semantic-contract.css` match the frozen Archic release (`verify-client-foundation.mjs`)
- [ ] Semantic contract validator passes — every brand role explicitly mapped
- [ ] `node tools/contrast.mjs styles/brand.css` exits 0 for the default theme **and every additional theme** (WCAG + APCA)
- [ ] No out-of-sRGB gamut failures in contrast validation
- [ ] `node tools/static-audit.mjs .` has zero blocking findings
- [ ] No arbitrary z-index values outside the scale
- [ ] Brand file header complete: vector, archetype, fonts, licences, contrast verification date
- [ ] Asset provenance exists and matches the declared prototype/production policy

---

## I · The Polish pass

Not a checklist. A judgement, made honestly, with the site open.

> ### Is there anything on this site that would make a user feel it is a template, a demo, or unfinished?

Look for, specifically:

- A default browser control that escaped styling
- A grey box saying "No data"
- A hover state that was never designed
- A crop that cuts a subject on one breakpoint
- A section that exists because the page looked short
- An image that is worse than the others
- A sentence that could be on any competitor's site
- A form that gives no feedback
- A transition that is 200 ms too slow
- An icon from a set everyone uses
- A number that shifts when it updates
- The third-level navigation item nobody looked at

**If the answer is yes, it is not finished.** Fix it and run the pass again.

---

## Sign-off

```markdown
# Archic Quality Gate — [Project]
Date: ____  ·  Reviewer: ____  ·  Build: ____

Devices:  iPhone ___ · Android ___ · Laptop ___ · Monitor ___
Network:  throttled 4G ☐   real mobile data ☐

A Brand         ___/8    F Content      ___/10
B Visual        ___/12   G Technical    ___/17
C Interaction   ___/10   H System       ___/9
D UX            ___/11   I Polish       PASS / FAIL
E Responsive    ___/10

## Findings
| # | Severity | Location | Issue | Resolution |
|---|---|---|---|---|

## Justified exceptions
(Every unchecked box, with the argument for shipping it.)

## Verdict
☐ SHIP    ☐ FIX AND RE-RUN

Signed: ____________
```

**The Polish pass is not scored. It is pass/fail, and a fail blocks delivery regardless of every other score.**


