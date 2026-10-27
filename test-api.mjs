import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const keyLine = envText.split("\n").find((l) => l.startsWith("MODEL_API_KEY="));
const key = keyLine.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");

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
          "You are Second Me, an AI night-shift worker for a small online shop. Answer briefly.",
      },
      {
        role: "user",
        content:
          "Product: Okinawa Brown Sugar Coffee Beans 200g. Cost: 1200 yen. Competitor prices: 2700-3200 yen. Write: 1) a short product listing title, 2) a selling price, 3) one line explaining the price choice.",
      },
    ],
  }),
});

const data = await res.json();
console.log("Status:", res.status);
console.log(JSON.stringify(data, null, 2));
