import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const keyLine = envText.split("\n").find((l) => l.startsWith("MODEL_API_KEY="));
const key = keyLine.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");

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
            'You are Second Me, an AI night-shift worker. The shop owner writes tonight\'s mission in their own words (English or Roman Nepali). Understand it and reply ONLY with JSON like {"focus": string, "maxProducts": number, "maxPrice": number or null, "startTime": string, "tasks": [string], "summary": string}. tasks = 3 to 5 short action steps for tonight. summary = one friendly sentence in English confirming what you will do.',
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
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.listen(8787, () => {
  console.log("Second Me AI server: http://localhost:8787");
});
