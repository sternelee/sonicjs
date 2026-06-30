# SonicJS.com Homepage Redesign — Messaging & Section Strategy

> **Deliverable:** Strategy + section blueprint (no code this pass). When greenlit to build, the homepage lives at `www/src/app/page.mdx` (Next.js 16 + MDX + Tailwind), `/compare` at `www/src/app/compare/page.mdx`, raw copy at `docs/marketing/homepage-marketing-copy.md`.

## Context

SonicJS competes in a crowded headless-CMS market (Payload, Strapi, Directus, Sanity, Contentful — the five named on `/compare`). The current homepage leads on **"The Fastest Headless CMS"** with a benchmark/price jab at Strapi in the subhead. That's a contestable, benchmark-baiting claim that (a) invites a speed argument SonicJS can't always win on every axis, and (b) leaves the *second, equally strong* differentiator — being genuinely, permanently free and independent — underplayed. The goal of this redesign: sharpen the high-level message so a developer comparing alternatives is willing to **invest real time evaluating SonicJS**, and reduce the friction + trust gap that stops them.

## Competitive Landscape

What each rival leads with on their homepage today:

| CMS | Hero angle | Business model | Weakness SonicJS exploits |
|---|---|---|---|
| **Strapi** | "Open-source headless CMS for AI websites" | VC-backed; Cloud upsell; gates SSO + version history | Single-region Node; paywalls creeping in |
| **Payload** | "The backend to build the modern web" | VC-backed; enterprise push; managed cloud paused | Serverful Node; cold starts; query perf |
| **Directus** | "The backend for your whole team" | VC-backed; restrictive license drift; Cloud | Single-region; license uncertainty |
| **Sanity** | "Structure powers intelligence" / AI content ops | Pure SaaS, per-seat | Hosted-only; no self-host; $/seat; lock-in |
| **Contentful** | "Content chaos — your time's up" / DXP | Pure SaaS, enterprise | $300+/mo; marketer-not-dev; lock-in |

**The pattern:** two camps. Commercial SaaS (Sanity, Contentful) = powerful, pricey, locked-in, drifting toward marketers. Open-source self-host (Strapi, Payload, Directus) = all **Node.js, single-region by default, all VC-backed and monetizing harder every year** (paywalls, license changes, cloud upsells).

**The whitespace nobody owns:** a CMS that is *simultaneously* (1) the fastest **by architecture** — edge-native on Cloudflare Workers, zero cold start, global by default — and (2) genuinely free forever — MIT, no paywalls, no VC monetization clock. **Every competitor forces a trade: speed via paid SaaS, or freedom via slow single-region Node. SonicJS refuses the trade.**

## Core Positioning (the wedge)

> **Fast because it's edge-native. Free because it's truly open.**
> Speed and freedom are the two things every competitor makes you choose between. SonicJS gives you both.

Internal positioning statement: *SonicJS is the only headless CMS that runs entirely on the edge — global, zero-cold-start performance hosted SaaS can't match — while staying 100% MIT with every feature free, forever.*

## Hero Recommendation

**Replace** "The Fastest Headless CMS" + competitor/price jab. Lead with the **mechanism** (edge / Cloudflare Workers — the one fact rivals can't copy or dispute) fused with the **freedom** hook.

**Recommended:**
- **Headline:** *The headless CMS that runs on the edge.*
- **Subhead:** *Zero cold starts, anywhere on Earth. 100% MIT open source, every feature free. Built on Cloudflare Workers, TypeScript end to end.*

**Alternates:**
- **A (freedom-forward):** *The fast, free headless CMS you actually own.* — sub: edge-native on Workers · MIT · no paywalls · no lock-in.
- **B (mechanism-forward, most credible):** *Your CMS, running in 330+ cities.* — sub: edge-native headless CMS on Cloudflare Workers — 0ms cold starts, MIT, free to start.

**CTAs (friction-ordered):**
1. **Try the live admin — no signup** (primary)
2. `npx create-sonicjs@latest` copy button
3. Star on GitHub (show live count)
4. Docs

**Demote "Sponsor"** out of the hero to the footer/GitHub — don't ask for money before earning the dev's interest.

**Why not lead on "Fastest" alone:** contestable, invites benchmark wars, and speed alone doesn't make a dev adopt a CMS — they also need to trust it's complete and won't trap them.

## Four Messaging Pillars

1. **Edge-native, zero cold start** — runs on Cloudflare Workers in 330+ cities; 0–5ms cold start vs 100–3000ms; no regions to choose, global by default. *Why you care: sub-50ms responses everywhere, zero DevOps.*
2. **100% MIT, every feature free** — version history, auth/SSO, RBAC, workflows — all free, forever. No open-core bait, no per-seat, no Enterprise gate. *Why: the feature you need won't be paywalled the day you need it.*
3. **Independent & community-owned** — no VC clock, no monetization pressure, no license rug-pull. *Why: every rival is VC-backed and tightening the screws (paywalls, license changes, cloud upsells). SonicJS won't.* ← **freshest 2026 wedge.**
4. **Code-first DX + AI-ready** — TypeScript end-to-end, schema-as-code, auto-generated REST API, AI-agent-ready docs + MCP. *Why: define a model, get an API, ship — and your AI tools understand it.*

### Messaging to Add (beyond existing 4 differentiators)

- **Own your data / no lock-in** — D1 + self-host + MIT = a real escape hatch. (Fold into pillars 2/3.)
- **Cost at scale** — runs on Cloudflare's free tier; near-zero cost even at scale; $0–5/mo vs $99–$300. Indie devs and startups care a lot.
- **DX specifics** — time-to-first-API, local dev, migrations, schema-as-code. This is what makes a dev *lean in*.
- **AI story (must be visible)** — in 2026 every competitor leads with AI. Surface AI search + agent-ready docs + MCP, or the page reads as dated.
- **Modern-stack credibility** — Hono, Workers, D1, Drizzle, TypeScript. Signals "built the way I'd build it."
- **Honesty/transparency** — the candid `/compare` (which names what SonicJS *isn't* good at yet) is a trust asset. Devs trust a vendor that names its own gaps.
- **Maturity/velocity** — GitHub stars, release cadence (the changelog is an asset — proves it's alive), Discord, production users. **This closes the #1 objection for a younger CMS.**

## What Developers Care About When Evaluating

| Dev question | Homepage answer |
|---|---|
| Is it complete enough for my project? | Feature grid + link to the 125-feature `/compare` matrix |
| How good is the DX / time to value? | npx one-liner + schema→API→deploy code section + live demo |
| Will I get locked in? Is it *really* open? | MIT badge, self-host, own-your-data, "no open-core" |
| Is it fast / will it scale? | Benchmark table (keep — verifiable) |
| What will it cost at scale? | Transparent pricing + "free forever" |
| Is it mature / maintained / trusted? | Stars, changelog velocity, Discord, testimonials, prod logos |
| Can I extend it? | Plugins, hooks, custom endpoints |
| Can I try it in 60s, no commitment? | **Live demo (no signup)** + npx + one-click deploy |

**Throughline for "make devs invest time evaluating":** *reduce friction + close the trust gap.* Friction killers = live demo, npx, one-click deploy. Trust closers = stars, release velocity, candor (`/compare`), production proof. Both belong above the fold or just below.

## Recommended Section Blueprint (top → bottom)

1. **Hero** — dual value (edge speed + MIT free) · npx · CTAs: [Try live demo] [npx] [GitHub ★]. Micro trust-strip beneath: `★ stars · MIT · 330+ edge cities · $0 start`.
2. **Credibility bar** — stars / downloads / edge locations / production logos (if any).
3. **The wedge ("Why SonicJS")** — the choice rivals force vs SonicJS's both/and. Sharpen the current "Why developers switch" 4 pains (migration hell, slow queries, paywalls, single-region).
4. **Live demo spotlight** — embedded admin preview → "Try the admin, no signup." *(NEW)*
5. **Four pillars** — edge / MIT-free / independent / DX+AI.
6. **Performance proof** — benchmark table (keep).
7. **DX showcase** — schema → API → deploy 3-step (keep; strong).
8. **Feature breadth grid** — answers "is it complete?" + link to `/compare`.
9. **AI section** — AI search, agent-ready docs, MCP. *(Elevate — currently buried.)*
10. **Pricing / cost** — transparent table, "free forever, no paywalls" (keep, sharpen freedom angle).
11. **Honesty / comparison teaser** — link to `/compare`; lean into the candor.
12. **Social proof + maturity** — testimonials, Discord, changelog velocity.
13. **Final CTA** — demo + npx + GitHub + Discord. (Sponsor lives here, not the hero.)

## Demo Site Recommendation

**Decision: YES — live no-signup hosted admin demo**

**What:** a hosted instance of the *real* SonicJS admin (e.g. `demo.sonicjs.com`), seeded with realistic content (blog, products, media, users, workflows), auto-logged-in as a demo admin — **no signup, no email gate**. One click → inside the actual product.

**Why it's strategic:**
- Closes the trust/maturity gap faster than any copy.
- Frictionless = on-brand for "fast / free / open."
- Competitors gate demos behind signup or sales calls — a **no-signup instant demo is itself a differentiator.**
- Directly serves the "make devs invest time evaluating" goal.

**Three rungs of commitment to offer together:** look (**demo**) → own-instant (**Deploy to Cloudflare** button) → local (**npx**).

**Scope (cheapest path first):**
- **Phase A (do first):** shared sandbox; writes allowed but **auto-reset on a cron** (e.g. hourly wipe + reseed). Low eng cost, high value.
- **Phase B (later):** per-session ephemeral instance (isolated seeded data, torn down after) — higher eng cost, but a live proof of "deploy globally in seconds."

**Ops / security guardrails (real cost — flag before building):**
- Rate-limit + Turnstile on the demo entry (Turnstile already ships in SonicJS)
- No real secrets/keys; seeded data only
- Auto-reset cron on all writes
- Disable or sandbox destructive ops (DB wipe, outbound email, public R2 writes)
- Isolate via `tenant_id` (multi-tenant already in SonicJS)
- Monitor for abuse; rotate demo creds

**Primary hero CTA copy:** *"Try the live admin — no signup."*

## Messaging Do / Don't

**Do:**
- Lead with the mechanism (edge/Workers) — rivals can't dispute it
- Fuse speed + freedom in the hero
- Make "independent · MIT forever · no paywalls" a loud pillar — freshest 2026 wedge as rivals monetize harder
- Surface AI — every competitor leads with AI now; burying it makes the page look dated
- Close the trust gap: demo, stars, release velocity, candor
- Keep CTAs friction-free and in commitment order (look → deploy-instant → local)

**Don't:**
- Lead on "Fastest" alone — contestable, invites benchmark wars
- Name a competitor + price *in the hero* — keep head-to-head on `/compare`
- Bury AI or the demo below the changelog
- Ask for money (Sponsor button) before earning the dev's interest
- Hide tradeoffs — the honest `/compare` is a trust asset, not a weakness

## Success Metrics

- **A/B the hero**: current "Fastest" vs recommended dual-value → click-through to demo/docs
- **Track:** demo-CTA click rate, demo → quickstart/docs funnel, npx copy clicks, GitHub referrals, scroll depth to pricing, time on page
- **North-star proxy for "invest time evaluating":** % of visitors who reach any *evaluation action* (open demo · copy npx · open docs · deploy · star)

## Implementation Notes (when greenlit to build)

- Homepage: `www/src/app/page.mdx` (reorder/rewrite sections per blueprint above)
- Raw copy: `docs/marketing/homepage-marketing-copy.md`
- Reuse existing components: `Button.tsx`, `FeatureGrid.tsx`, `ComparisonMatrix.tsx`
- Demo site: spec `demo.sonicjs.com` Phase A sandbox as a separate task
- Demo CTA in hero requires a live URL before the hero copy ships
