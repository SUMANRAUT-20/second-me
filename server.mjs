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

  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.listen(8787, () => {
  console.log("Second Me AI server: http://localhost:8787");
});
