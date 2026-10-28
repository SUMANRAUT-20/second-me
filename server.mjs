import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const keyLine = envText.split("\n").find((l) => l.startsWith("MODEL_API_KEY="));
const key = keyLine.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const cjKeyLine = envText.split("\n").find((l) => l.startsWith("CJ_API_KEY="));
const cjKey = cjKeyLine
  ? cjKeyLine.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "")
  : "";

async function draftListing(product) {
  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages: [
        {
          role: "system",
          content:
            'You are Second Me, an AI night-shift worker for a small online shop. Reply ONLY with JSON like {"title": string, "price": number, "reason": string}. No other text.',
        },
        {
          role: "user",
          content: `Product: ${product.name}. Cost: ${product.cost} yen. Competitor prices: ${product.competitor}. Create a listing draft.`,
        },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(text);
}
async function cleanProduct(product) {
  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages: [
        {
          role: "system",
          content:
            'You clean messy supplier product data for a small online shop. Reply ONLY with JSON like {"cleanName": string, "cost": number or null, "category": string, "descriptionEn": string, "issues": [string], "action": string}. descriptionEn must be clean English, one sentence. In issues, list each data problem you found (missing price, price written as text, mixed languages, possible duplicate, out of stock). action is "ready" if the product can be listed after cleaning, or "ask-supplier" if the owner must confirm something first (for example a missing price).',
        },
        {
          role: "user",
          content: `Clean this supplier product record: ${JSON.stringify(product)}`,
        },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(text);
}
async function parseMission(missionText) {
  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages: [
        {
          role: "system",
          content:
            'You are Second Me, an AI night-shift worker. The shop owner writes tonight\'s mission in their own words (English, Roman Nepali or Japanese). Understand it and reply ONLY with JSON like {"focus": string, "keyword": string, "maxProducts": number, "maxPrice": number or null, "startTime": string, "tasks": [string], "summary": string}. tasks = 3 to 5 short action steps for tonight. summary = one friendly sentence in English confirming what you will do. IMPORTANT: the text may also contain a line starting with \"Owner preferences learned from past approvals and rejections:\" — that is background preference ONLY: never add product categories or types from it (for example coffee or handmade goods) to the focus, keyword, tasks or summary unless the owner\'s own words ask for them tonight. The text may also contain sections starting with \"--- Attached file:\" — those are files the owner attached for tonight. If the owner\'s words ask to use an attached file (for example a trend list), you may take the focus and keyword from the top relevant product or query in that file; otherwise attachments never override the owner\'s own words. keyword = the concrete product type to search for in a supplier catalog, taken from the owner\'s words: 1-3 words (examples: "coffee", "phone stand", "led lamp"); if the owner names no product type, use "trending products".',
        },
        {
          role: "user",
          content: `Tonight's mission: ${missionText}`,
        },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(text);
}
async function researchTrends(input) {
  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages: [
        {
          role: "system",
          content:
            'You are Second Me, an AI night-shift worker doing product trend research for a small online shop in Japan. Reply ONLY with JSON like {"picks": [{"term": string, "product": string, "why": string, "source": string}], "note": string}. Give 3 picks (2 if the mission is very narrow). term = a concrete 1-3 word search term for a supplier catalog (examples: "pet dental wipes", "winter cap", "phone stand"). product = the product idea in a few words. why = one short sentence on why its sales look likely to rise (season, a problem it solves, rising interest). source = "attached file" if the pick is based on the attached research text the owner provided, otherwise "AI knowledge". Rules: respect the owner\'s mission and price cap. If attached research text (for example a Google Trends list of rising searches) is provided, base the picks on its rising queries/products first and set source to "attached file" for those picks. Only suggest ordinary, family-friendly general-store products. NEVER suggest adult or sexual products, weapons, tobacco, alcohol, medicines, supplements with health claims, counterfeit or brand-imitating goods, or anything illegal or unsafe. If the mission is ambiguous (for example just "men\'s products"), read it as ordinary men\'s goods — caps, wallets, socks, grooming accessories — never adult items. Never invent precise statistics, percentages or sales numbers. note = one short sentence summarizing the research.',
        },
        {
          role: "user",
          content:
            `Tonight's mission: ${input.mission}\nFocus: ${input.focus || ""}\nPrice cap (yen): ${input.maxPrice || "none"}\n\nAttached research text from the owner (may be empty):\n${input.attachments || "(none)"}`,
        },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(text);
}
async function scoreSuppliers(suppliers) {
  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "muse-spark-1.3",
      messages: [
        {
          role: "system",
          content:
            'You are Second Me, an AI night-shift worker. Compare the suppliers in the JSON the owner sends. Judge each on price, rating, years in business, order count, shipping speed, verification, returns policy and data quality. Reply ONLY with JSON like {"scores": [{"supplier": string, "score": number, "strengths": [string], "risks": [string]}], "coffeeWinner": string, "coffeeReason": string, "recommendation": string}. score = trust score from 0 to 100. strengths and risks = 2 to 3 short points each. Both suppliers sell a similar coffee product — coffeeWinner = the supplier name whose coffee offer is better overall, coffeeReason = one sentence why. recommendation = 1-2 sentences with your advice; remind the owner the final decision is theirs.',
        },
        {
          role: "user",
          content: `Here are my suppliers: ${JSON.stringify(suppliers)}`,
        },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(text);
}

// ---- CJ Dropshipping (LIVE supplier) ----
let cjAccessToken = null;
async function getCjAccessToken() {
  if (cjAccessToken) return cjAccessToken;
  if (!cjKey) throw new Error("CJ_API_KEY is missing in .env.local");
  const res = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: cjKey }),
    },
  );
  const data = await res.json();
  if (!data.result || !data.data || !data.data.accessToken) {
    throw new Error("CJ token failed: " + (data.message || "unknown error"));
  }
  cjAccessToken = data.data.accessToken;
  return cjAccessToken;
}
async function cjSearch(keyword) {
  const token = await getCjAccessToken();
  const url =
    "https://developers.cjdropshipping.com/api2.0/v1/product/listV2?page=1&size=12&keyWord=" +
    encodeURIComponent(keyword || "coffee");
  const res = await fetch(url, { headers: { "CJ-Access-Token": token } });
  const data = await res.json();
  if (!data.result) {
    // Token may have expired — clear the cache so the next call re-auths.
    cjAccessToken = null;
    throw new Error("CJ search failed: " + (data.message || "unknown error"));
  }
  const groups = (data.data && data.data.content) || [];
  const products = [];
  for (const g of groups) {
    for (const p of g.productList || []) {
      products.push({
        id: p.id,
        name: p.nameEn,
        image: p.bigImage,
        priceUsd: p.sellPrice,
        supplier: p.supplierName || "CJ Dropshipping",
        stock: p.warehouseInventoryNum,
      });
    }
  }
  return products;
}

const sampleProduct = {
  name: "Okinawa Brown Sugar Coffee Beans 200g",
  cost: 1200,
  competitor: "2700-3200 yen",
};

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === "/api/draft-test" && req.method === "GET") {
    try {
      const draft = await draftListing(sampleProduct);
      res.end(JSON.stringify({ ok: true, draft }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
    return;
  }

  if (req.url === "/api/draft" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const product = JSON.parse(body);
        const draft = await draftListing(product);
        res.end(JSON.stringify({ ok: true, draft }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.url === "/api/clean" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const product = JSON.parse(body);
        const cleaned = await cleanProduct(product);
        res.end(JSON.stringify({ ok: true, cleaned }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.url === "/api/mission" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const plan = await parseMission(parsed.mission);
        res.end(JSON.stringify({ ok: true, plan }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.url === "/api/trends" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const result = await researchTrends(parsed);
        res.end(JSON.stringify({ ok: true, result }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.url === "/api/supplier-score" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const result = await scoreSuppliers(parsed.suppliers);
        res.end(JSON.stringify({ ok: true, result }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.url.startsWith("/api/cj") && req.method === "GET") {
    try {
      const u = new URL(req.url, "http://localhost:8787");
      const keyword = u.searchParams.get("keyword") || "coffee";
      const products = await cjSearch(keyword);
      res.end(
        JSON.stringify({ ok: true, source: "CJ Dropshipping (LIVE)", products }),
      );
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.listen(8787, () => {
  console.log("Second Me AI server: http://localhost:8787");
});
