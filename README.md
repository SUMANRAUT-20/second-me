# Second Me — AI Night-Shift Worker

**While I sleep, my dream keeps working.**

Second Me is an AI night-shift worker for solo online sellers. The owner works a day job (or studies, or works nights somewhere else) and has no time to run a shop. So at night, Second Me does the research, checks real suppliers, cleans the messy data and drafts the listings — and in the morning, the owner spends a few minutes as the CEO: **Approve** or **Reject**. Nothing is ever published, bought or spent without the owner's approval.

Built solo by Suman Raut for the **Meta AI Developer Hackathon** (Indie track — _Build for Your World_), powered by **Muse Spark** via the Meta Model API, with a **live supplier connection to CJ Dropshipping**.

## The story

I am an IT student in Okinawa, Japan. I study in the afternoon and work a part-time night job at a convenience store. My family in Nepal has a home loan of NPR 30 lakh (about ¥3.5 million). I always wanted to run a small online shop to help them — but I have no time, and no money to hire anyone.

So I built the worker I needed. His name is **Second Me**.

## One night, step by step

1. **Mission (evening).** The owner writes tonight's job in his own words — English, Roman Nepali or Japanese — and can attach a research file (even a saved Google Trends list). The AI reads it back as a **plan** (focus, search keyword, price cap, tasks) and nothing starts until the owner confirms it. A price in any currency is converted to yen automatically.
2. **Trend research.** The AI proposes what to look for tonight — and labels each pick's source honestly: from the owner's **attached file**, or from **AI knowledge** (its memory — an estimate, never dressed up as live data).
3. **Live supplier search.** Each pick is searched in **CJ Dropshipping's real catalog, live**: real prices, real stock, real photos. Second Me then filters a second time — trend match, price cap, stock, the right audience — and logs everything it skipped, and why.
4. **Data cleaning.** The owner's saved supplier list is messy, like real life: missing prices, prices as text, mixed languages, duplicates. The AI cleans the flagged records and lists every issue it found.
5. **Supplier score.** The AI scores the saved suppliers on their profiles — rating, years, orders, response time, verification, returns — with strengths, risks, and a best-overall pick. Missing data is named as a risk, never papered over.
6. **Drafts.** Surviving products become listing drafts with an AI-set price, a competitor range and a written reason. CJ products carry their **photo** and a **link to the exact product page**; if there is no photo, the card warns the owner to look before deciding.
7. **Morning Report.** The shift closes itself: what was done, what failed, what is waiting. If **no** draft passed the filters, the report says so, with the counts — silence is not an option.
8. **CEO Approval.** Products first, then ads **only for approved products**, then customer reply drafts. Every rejection takes one reason — and Second Me **learns the owner's pattern** for the next night. Approved profit moves the **Loan Meter (projected)** toward the goal the owner set — mine is my family's loan.

In the daytime, **Watch mode** only watches and drafts replies. It never acts alone.

## Honesty labels — what is LIVE, what is SAMPLE

Every datapoint in this app is labeled for what it is:

| Part | Status |
|---|---|
| AI thinking (plan, research reading, cleaning, scoring, drafts) | **LIVE** — real Muse Spark calls |
| Supplier catalog (prices, stock, photos, listed-by counts) | **LIVE** — CJ Dropshipping API, fetched during the shift |
| Saved supplier list (4 suppliers, 24 products) | **SAMPLE** — stands in for lists a real owner pastes or connects |
| Trend picks without an attached file | **AI knowledge** — labeled as memory, not live data |
| CJ prices in yen | **est.** — converted from USD at a fixed reference rate |
| Loan Meter | **Projected** — from approved drafts; in the real version only completed sales move it |

Demo rule: **¥0 spend.** The AI drafts everything, but nothing is published, ordered or paid for.

## How we use Meta's models

**Muse Spark is the whole night crew** — every judgment in the loop is one of its calls:

- **Planner** — turns the owner's words (any of his 3 languages) into tonight's plan
- **Researcher** — proposes trend picks, and reads real web/supplier evidence when it is provided
- **Cleaner** — repairs messy supplier data and names every issue
- **Judge** — scores suppliers on evidence, names risks, never invents facts
- **Writer** — drafts each listing with price, competitor range and reasoning

One measured shift: ~12–13 calls, ~10,000 tokens, **under $0.05** of real API cost.

## The app

One page, three tabs — **1 · Mission → 2 · AI Work Log → 3 · CEO Approval** — light theme, English UI. The Work Log shows every step, including what got stuck and why; a Stop button and per-call timeouts mean one slow call can never freeze a shift.

## Run it locally

Create `.env.local` in the project root:

```
MODEL_API_KEY=<your Meta Model API key>        # required
CJ_API_KEY=<your CJ Dropshipping API key>      # optional — enables the LIVE supplier search
```

Then run **two** processes:

```
node server.mjs     # AI server on http://localhost:8787
npm run dev         # web app on http://localhost:5173
```

Keys live only in `.env.local`, which is never committed (check the repo tree — it is not there).

## Roadmap — from demo to real shop

- **Store connection:** plug in a real marketplace (Shopify / Amazon) through official APIs; the Master Product format already matches what those feeds provide.
- **Live demand data:** add an approved demand feed (TikTok Shop sales data, Helium 10-style estimates) beside the owner's attached research files — always labeled by source.
- **Ads and tracking:** approved ads actually run; sales, inquiries and profit tracked **including the AI's own cost per sale** — before the profit lands in the Loan Meter.
- **Ordering:** after owner approval, order through the supplier's official API (CJ supports it; it is off in the demo by the ¥0 rule).
- **Quality:** no AI can touch a product — the owner verifies with a sample order before any supplier goes live. Second Me never pretends otherwise.

## Pitch line

The pieces exist separately — product research tools, data cleaners, listing writers. **The full loop in one night-shift operator, with the owner as CEO, does not.** That's Second Me.
