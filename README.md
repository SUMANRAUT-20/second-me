# Second Me — AI Night-Shift Worker

**While I sleep, my dream keeps working.**

Second Me is an AI night-shift worker for solo online sellers. The owner works a day job (or studies, or works nights somewhere else) and has no time to run their shop. So at night, Second Me does the research, cleans the data, scores the suppliers and drafts the listings — and in the morning, the owner spends a few minutes as the CEO: **Approve** or **Reject**. Nothing is ever published, bought or spent without the owner's approval.

Built solo by Suman Raut for the **Meta AI Developer Hackathon** (Indie track — Build for Your World), powered by **Muse Spark** via the Meta Model API.

## The story

I am an IT student in Okinawa, Japan. I study in the afternoon and work a part-time night job at a convenience store. My family in Nepal has a home loan of NPR 30 lakh (about ¥3.5 million). I always wanted to run a small online shop to help — but I have no time, and no money to hire anyone.

So I built the worker I needed. His name is **Second Me**.

## How it works — the loop

1. **Watch mode (day):** notices orders and messages, drafts replies only — never acts alone.
2. **Night Shift (23:00–07:00):** product research → competitor price check → supplier scoring → data cleaning → listing drafts.
3. **Morning Report (07:00):** what was done, what needs decisions, estimated profit.
4. **CEO Approval Queue:** the owner approves or rejects each draft. Rejections ask for a quick reason — and Second Me **learns the owner's pattern** (price range, categories, taste) for the next night.

Every approved yen of profit moves the **Loan Meter** toward the NPR 30 lakh family loan.

## Live AI features (Muse Spark, real API calls)

- **Live AI Draft** — give a product and cost; the AI writes the listing title, sets a price inside the competitor range, and explains its reasoning. The draft lands in the Approval Queue as a LIVE card.
- **Clean with AI** — supplier data is messy in real life: missing prices, prices typed as text, out-of-stock items, duplicates, mixed languages. The AI cleans each flagged record, lists the issues it found, and suggests the next action.
- **Mission Check** — the owner writes tonight's mission in their own words, and the AI reads it back as a structured plan (focus, price cap, tasks) before the shift starts. Tested and working in **English, Roman Nepali and Japanese** — the owner talks to it like a person, in their own language.
- **Supplier Score** — the AI compares suppliers and gives a trust score (0–100) with strengths and risks, and picks the better deal when two suppliers sell the same product. The final trust, negotiation, sample-order and payment decisions always stay with the owner.

## Honesty labels

Every datapoint in the app is labeled for what it is:

- **LIVE** — a real Muse Spark call or real analysis happening now.
- **SAMPLE** — demonstration data (the two suppliers and 12 products in `src/suppliers.json`).

Demo runs at **¥0 spend**: the AI drafts everything, but nothing is published, ordered or paid for in demo mode.

## Architecture

- **Frontend:** React + Vite (light theme, English UI)
- **AI server:** a small dependency-free Node server (`server.mjs`) that keeps the API key off the browser and calls the Meta Model API (`muse-spark-1.3`)
- **Data hub:** supplier feeds come in → one **Master Product List** (cleaned by AI) → platform-ready listings go out

## Run it locally

You need a Meta Model API key in a file named `.env.local` in the project root:

    MODEL_API_KEY=your_key_here

Then run **two** processes:

    node server.mjs     # AI server on http://localhost:8787
    npm run dev         # web app on http://localhost:5173

Open the web app, and try: Generate Draft, Clean with AI, Mission Check, Score My Suppliers.

## Roadmap — from demo to real shop

- Connect real marketplaces and supplier networks through their **official APIs** (e.g. Shopify, AliExpress Open Platform) — the Master Product format already matches what those feeds provide.
- Owner verifies physical quality with a sample order before any supplier goes live. No AI can guarantee quality — so Second Me never pretends to.
- Real Watch mode notifications, and per-item scheduling after approval.

## Pitch line

The pieces exist separately — product research tools, data cleaners, listing writers. **The full loop in one night-shift operator, with the owner as CEO, does not.** That's Second Me.
