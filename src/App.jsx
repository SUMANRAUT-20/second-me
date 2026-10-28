import { useEffect, useRef, useState } from "react";
import "./App.css";
import supplierData from "./suppliers.json";

const initialQueue = [
  {
    id: 4,
    type: "reply",
    emoji: "💬",
    name: "Customer Reply Draft (SAMPLE)",
    detail:
      'Customer asked: "How long does delivery take?" — Draft reply: We ship within 2–4 days and share the tracking number.',
    profit: 0,
  },
];

const rejectReasons = [
  "Price too high",
  "Quality not right",
  "Wrong category",
  "Maybe later",
];
const loanGoal = 3500000;
const API = "http://localhost:8787";

function formatYen(n) {
  return "¥" + n.toLocaleString("en-US");
}

function App() {
  const [queue, setQueue] = useState(initialQueue);
  const [rejectingId, setRejectingId] = useState(null);
  const [patterns, setPatterns] = useState([
    "Prioritize coffee and handmade products",
    "Be careful with products priced over ¥5,000",
    "Avoid suppliers with slow shipping",
  ]);
  const [aiActions, setAiActions] = useState({
    draft: 0,
    clean: 0,
    mission: 0,
    score: 0,
  });

  // ---- Mission state ----
  const [missionText, setMissionText] = useState(
    "Tonight, focus on coffee products only. Make up to 5 drafts, keep prices under ¥3,000, start at 23:00.",
  );
  const [missionPlan, setMissionPlan] = useState(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState("");
  const [attachments, setAttachments] = useState([]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const read = [];
    for (const f of files) {
      try {
        const lower = f.name.toLowerCase();
        let text = "";
        if (lower.endsWith(".pdf")) {
          const pdfjs = await import("pdfjs-dist");
          const workerUrl = (
            await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
          ).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          const buf = await f.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: buf }).promise;
          const pages = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            pages.push(content.items.map((it) => it.str).join(" "));
          }
          text = pages.join("\n");
        } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
          const XLSX = await import("xlsx");
          const buf = await f.arrayBuffer();
          const wb = XLSX.read(buf);
          const parts = [];
          for (const name of wb.SheetNames) {
            parts.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
          }
          text = parts.join("\n");
        } else {
          text = await f.text();
        }
        if (text.trim().length > 0) {
          read.push({ name: f.name, text: text.slice(0, 4000) });
        }
      } catch (err) {
        // unreadable file — skip it silently
      }
    }
    if (read.length > 0) {
      setAttachments((prev) => [...prev, ...read]);
      setMissionPlan(null);
    }
    e.target.value = "";
  }

  // ---- Research state ----
  const [cleanResults, setCleanResults] = useState({});
  const [cleaningId, setCleaningId] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");

  // ---- Draft state ----
  const [aiForm, setAiForm] = useState({
    name: "Okinawa Brown Sugar Coffee Beans 200g",
    cost: 1200,
    competitor: "2700-3200 yen",
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // ---- Shift (chain) state ----
  const [workLog, setWorkLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [shiftDone, setShiftDone] = useState(false);
  const stopRef = useRef(false);

  const [tab, setTab] = useState("mission");

  // ---- Ads state (Part 3b) ----
  const [adDrafts, setAdDrafts] = useState({});

  const supplierName = (id) =>
    supplierData.suppliers.find((s) => s.id === id)?.name || id;

  const flagFor = (p) => {
    const flags = [];
    if (p.cost === null || p.cost === undefined)
      flags.push("⚠️ No price — ask the supplier");
    if (typeof p.cost === "string")
      flags.push("⚠️ Price is text, not a number");
    if (p.stock === 0) flags.push("⚠️ Out of stock");
    if ((p.description || "").toLowerCase().includes("duplicate"))
      flags.push("⚠️ Possible duplicate listing");
    if (/[^\x00-\x7F]/.test(p.name + " " + (p.description || "")))
      flags.push("⚠️ Mixed-language text");
    return flags;
  };

  // ---- Shared AI calls (used by the buttons AND the automatic chain) ----
  async function callMission() {
    const res = await fetch(`${API}/api/mission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission:
          missionText +
          "\nOwner preferences learned from past approvals and rejections: " +
          patterns.join("; ") +
          attachments
            .map((a) => `\n--- Attached file: ${a.name} ---\n${a.text}`)
            .join(""),
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "AI error");
    setAiActions((a) => ({ ...a, mission: a.mission + 1 }));
    return data.plan;
  }

  async function callTrends(plan) {
    const res = await fetch(`${API}/api/trends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission: missionText,
        focus: plan.focus || "",
        maxPrice: plan.maxPrice || null,
        attachments: attachments
          .map((a) => `--- Attached file: ${a.name} ---\n${a.text}`)
          .join("\n"),
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "AI error");
    setAiActions((a) => ({ ...a, mission: a.mission + 1 }));
    return data.result;
  }

  async function callClean(product) {
    const res = await fetch(`${API}/api/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "AI error");
    setAiActions((a) => ({ ...a, clean: a.clean + 1 }));
    return data.cleaned;
  }

  async function callScore() {
    const res = await fetch(`${API}/api/supplier-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suppliers: supplierData.suppliers }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "AI error");
    setAiActions((a) => ({ ...a, score: a.score + 1 }));
    return data.result;
  }

  async function callDraft(form) {
    const res = await fetch(`${API}/api/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "AI error");
    setAiActions((a) => ({ ...a, draft: a.draft + 1 }));
    return data.draft;
  }

  // ---- CJ Dropshipping (LIVE supplier) ----
  const [cjQuery, setCjQuery] = useState("coffee");
  const [cjResults, setCjResults] = useState([]);
  const [cjLoading, setCjLoading] = useState(false);
  const [cjError, setCjError] = useState("");
  const USD_JPY = 155;

  function cjPriceYen(p) {
    const m = String(p.priceUsd || "").match(/\d+(\.\d+)?/);
    return m ? Math.round(parseFloat(m[0]) * USD_JPY) : null;
  }

  async function searchCj(keyword) {
    const res = await fetch(
      `${API}/api/cj?keyword=${encodeURIComponent(keyword || "coffee")}`,
    );
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "CJ error");
    return data.products || [];
  }

  async function searchCjManual() {
    setCjLoading(true);
    setCjError("");
    try {
      const products = await searchCj(cjQuery);
      setCjResults(products);
    } catch (e) {
      setCjError(
        'Could not reach CJ. Is "node server.mjs" running with the CJ key set?',
      );
    }
    setCjLoading(false);
  }

  function draftToQueueItem(draft, form) {
    return {
      id: Date.now() + Math.random(),
      type: "listing",
      emoji: "🤖",
      name: draft.title,
      supplier: "Live AI Draft",
      platform: "Shopify",
      price: draft.price,
      profit: draft.price - Number(form.cost),
      competitor: form.competitor,
      signal: "LIVE",
      reason:
        form.product && form.product.trendWhy
          ? `📈 Trend: ${form.product.trendWhy} — ${draft.reason}`
          : draft.reason,
      image:
        form.product && form.product.image ? form.product.image : null,
    };
  }

  // ---- Manual (inspector) handlers ----
  async function understandMission() {
    setMissionLoading(true);
    setMissionError("");
    setMissionPlan(null);
    try {
      const plan = await callMission();
      setMissionPlan(plan);
    } catch (e) {
      setMissionError(
        'Could not reach the AI server. Is "node server.mjs" running?',
      );
    }
    setMissionLoading(false);
  }

  async function cleanWithAI(product) {
    setCleaningId(product.id);
    try {
      const cleaned = await callClean(product);
      setCleanResults((prev) => ({ ...prev, [product.id]: cleaned }));
    } catch (e) {
      setCleanResults((prev) => ({
        ...prev,
        [product.id]: {
          error: 'Could not reach the AI server. Is "node server.mjs" running?',
        },
      }));
    }
    setCleaningId(null);
  }

  async function scoreSuppliers() {
    setScoreLoading(true);
    setScoreError("");
    setScoreResult(null);
    try {
      const result = await callScore();
      setScoreResult(result);
    } catch (e) {
      setScoreError(
        'Could not reach the AI server. Is "node server.mjs" running?',
      );
    }
    setScoreLoading(false);
  }

  async function generateDraft() {
    setAiLoading(true);
    setAiError("");
    try {
      const draft = await callDraft(aiForm);
      setQueue((q) => [draftToQueueItem(draft, aiForm), ...q]);
    } catch (e) {
      setAiError(
        'Could not reach the AI server. Is "node server.mjs" running?',
      );
    }
    setAiLoading(false);
  }

  // ---- The Night Shift chain: Start runs everything, in order ----
  const say = (tag, text) =>
    setWorkLog((l) => [...l, { tag, text }]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runShift() {
    if (!missionPlan || running) return;
    stopRef.current = false;
    setRunning(true);
    setTab("log");
    setShiftDone(false);
    setWorkLog([]);
    const stopped = () => stopRef.current;

    say("Mission", `Plan confirmed — ${missionPlan.summary}`);
    await wait(400);

    // Research: load the supplier data the AI will work on
    say(
      "Research",
      `Loaded ${supplierData.products.length} products from ${supplierData.suppliers.length} suppliers (SAMPLE data). Checking every record…`,
    );
    await wait(400);

    // Trend research first: which products look likely to sell next?
    // (AI analysis — based on the owner's attached research file when
    // one is provided, otherwise on the AI's market knowledge.)
    let trendPicks = [];
    try {
      const trends = await callTrends(missionPlan);
      trendPicks = (trends.picks || []).slice(0, 3);
      say(
        "Research",
        `📈 Trend research: ${trends.note || "picked tonight's product ideas."}`,
      );
      for (const pick of trendPicks) {
        say(
          "Research",
          `📈 Pick: ${pick.product} — ${pick.why} (source: ${
            pick.source === "attached file"
              ? "owner's attached research file"
              : "AI knowledge"
          })`,
        );
      }
    } catch (e) {
      say(
        "Research",
        "📈 Trend research was not available — searching the supplier with the mission keyword instead.",
      );
    }
    if (stopped()) {
      say("Shift", "⏹ Stopped by the owner. Finished steps stay saved above.");
      setRunning(false);
      return;
    }

    // Then the supplier: search CJ (LIVE) for each trend pick.
    // One search failing must not kill the others, and CJ allows
    // about 1 request per second — so searches are spaced out.
    let cjFound = [];
    const terms =
      trendPicks.length > 0
        ? trendPicks.map((p) => p.term).filter(Boolean)
        : [missionPlan.keyword || missionPlan.focus || "coffee"];
    const seen = new Set();
    let cjOk = 0;
    let termNo = 0;
    for (const term of terms.slice(0, 3)) {
      if (stopped()) break;
      termNo++;
      if (termNo > 1) await wait(1200);
      try {
        const products = await searchCj(term);
        cjOk++;
        const pick = trendPicks.find((t) => t.term === term);
        let matched = products;
        if (pick) {
          // A returned product only counts as this pick when its name
          // really matches the search term — CJ search is loose (it
          // returned coffee mugs for "pocket cup"). Unmatched products
          // never receive the pick's trend reason.
          const tokens = term
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length > 2);
          matched = products.filter((p) => {
            const name = (p.name || "").toLowerCase();
            const hits = tokens.filter((t) => name.includes(t)).length;
            return tokens.length <= 1 ? hits === 1 : hits >= 2;
          });
        }
        say(
          "Research",
          `🌐 CJ Dropshipping (LIVE): "${term}" → ${products.length} real products${
            pick ? `, ${matched.length} match the trend pick` : ""
          }.`,
        );
        for (const p of matched) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          cjFound.push(
            pick ? { ...p, trendWhy: pick.why, trendTerm: term } : p,
          );
        }
      } catch (e) {
        say(
          "Research",
          `🌐 CJ Dropshipping (LIVE): "${term}" search failed — continuing with the other picks.`,
        );
      }
    }
    if (cjFound.length > 0) {
      setCjResults(cjFound);
      setCjQuery(terms.join(", "));
      say(
        "Research",
        `🌐 CJ Dropshipping (LIVE): ${cjFound.length} real products collected — shown in the Live Supplier Research section below.`,
      );
    } else if (cjOk === 0) {
      say(
        "Research",
        "🌐 CJ live search was not available — continuing with the sample suppliers (SAMPLE).",
      );
    } else {
      say(
        "Research",
        "🌐 CJ Dropshipping (LIVE): no products matched tonight's picks — continuing with the sample suppliers (SAMPLE).",
      );
    }
    if (stopped()) {
      say("Shift", "⏹ Stopped by the owner. Finished steps stay saved above.");
      setRunning(false);
      return;
    }

    // Clean every flagged product, one by one
    const flaggedAll = supplierData.products.filter(
      (p) => flagFor(p).length > 0,
    );
    const flagged = flaggedAll.slice(0, 5);
    const cleanedMap = {};
    say(
      "Clean",
      `${flaggedAll.length} products have messy data — cleaning ${flagged.length} of them tonight, the rest stay queued for the next shift.`,
    );
    for (const p of flagged) {
      if (stopped()) break;
      try {
        const cleaned = await callClean(p);
        cleanedMap[p.id] = cleaned;
        setCleanResults((prev) => ({ ...prev, [p.id]: cleaned }));
        say(
          "Clean",
          `✔ "${p.name}" → "${cleaned.cleanName}" — ${
            cleaned.cost === null
              ? "price still missing"
              : formatYen(cleaned.cost)
          } (${cleaned.action === "ready" ? "ready to list" : "ask the supplier first"})`,
        );
      } catch (e) {
        say("Clean", `⚠️ Could not clean "${p.name}" — skipped, shift continues.`);
      }
    }
    if (stopped()) {
      say("Shift", "⏹ Stopped by the owner. Finished steps stay saved above.");
      setRunning(false);
      return;
    }

    // Score the suppliers
    try {
      const result = await callScore();
      setScoreResult(result);
      const top = [...result.scores].sort((a, b) => b.score - a.score)[0];
      say(
        "Supplier",
        `✔ Suppliers scored — best: ${top.supplier} (${top.score}/100). Coffee pick: ${result.coffeeWinner}.`,
      );
    } catch (e) {
      say("Supplier", "⚠️ Supplier scoring failed — shift continues without it.");
    }
    if (stopped()) {
      say("Shift", "⏹ Stopped by the owner. Finished steps stay saved above.");
      setRunning(false);
      return;
    }

    // Draft listings for the best eligible products
    const cap = missionPlan.maxPrice || Infinity;
    const maxDrafts = Math.min(missionPlan.maxProducts || 2, 3);
    const eligible = supplierData.products
      .map((p) => {
        const cleaned = cleanedMap[p.id] || cleanResults[p.id];
        const cost =
          cleaned && cleaned.cost !== null && cleaned.cost !== undefined
            ? Number(cleaned.cost)
            : p.cost === null || p.cost === undefined
              ? null
              : Number(String(p.cost).replace(/,/g, ""));
        return { p, cost };
      })
      .filter(
        ({ p, cost }) =>
          cost !== null && !Number.isNaN(cost) && cost > 0 && p.stock > 0,
      )
      .filter(({ cost }) => cost * 1.5 <= cap)
      .slice(0, maxDrafts);

    say(
      "Draft",
      `Preparing up to ${maxDrafts} listing drafts from the eligible products…`,
    );
    let drafted = 0;
    for (const { p, cost } of eligible) {
      if (stopped()) break;
      const form = {
        name: p.name,
        cost,
        competitor:
          `${Math.round((cost * 2.2) / 10) * 10}-${Math.round((cost * 2.7) / 10) * 10} yen`,
      };
      try {
        const draft = await callDraft(form);
        setQueue((q) => [draftToQueueItem(draft, form), ...q]);
        drafted++;
        say(
          "Draft",
          `✔ Draft ready: "${draft.title}" — ${formatYen(draft.price)} (in the CEO Approval queue)`,
        );
      } catch (e) {
        say("Draft", `⚠️ Draft for "${p.name}" failed — skipped.`);
      }
    }

    // Draft from the LIVE CJ products too — automatically, no clicking
    const cjEligible = cjFound
      .map((p) => ({ p, cost: cjPriceYen(p) }))
      .filter(({ cost }) => cost && cost > 0)
      .filter(({ cost }) => cost * 1.5 <= cap)
      .slice(0, 2);
    if (cjEligible.length > 0) {
      say(
        "Draft",
        `Preparing ${cjEligible.length} drafts from LIVE CJ products…`,
      );
    }
    for (const { p, cost } of cjEligible) {
      if (stopped()) break;
      const form = {
        name: p.name,
        cost,
        competitor: `${Math.round((cost * 2.2) / 10) * 10}-${Math.round((cost * 2.7) / 10) * 10} yen`,
        product: p,
      };
      try {
        const draft = await callDraft(form);
        setQueue((q) => [
          { ...draftToQueueItem(draft, form), supplier: "CJ Dropshipping" },
          ...q,
        ]);
        drafted++;
        say(
          "Draft",
          `✔ CJ LIVE draft ready: "${draft.title}" — ${formatYen(draft.price)} (in the CEO Approval queue)`,
        );
      } catch (e) {
        say("Draft", `⚠️ CJ draft for "${p.name}" failed — skipped.`);
      }
    }

    if (stopped()) {
      say("Shift", "⏹ Stopped by the owner. Finished steps stay saved above.");
      setRunning(false);
      return;
    }

    say(
      "Done",
      `🌅 Morning Report is ready — ${drafted} new draft${drafted === 1 ? "" : "s"} waiting in CEO Approval below. Nothing was published or spent.`,
    );
    setShiftDone(true);
    setRunning(false);
  }

  function stopShift() {
    stopRef.current = true;
  }

  // ---- Approval logic (Part 3) ----
  function makeAd(item) {
    return {
      headline: `${item.name} — now on sale`,
      copy: `${item.reason} Order today: ${formatYen(item.price)} on ${item.platform}. (Demo ad draft — nothing is posted without your approval.)`,
      status: null,
    };
  }

  function approve(item) {
    setQueue((q) =>
      q.map((i) => (i.id === item.id ? { ...i, status: "approved" } : i)),
    );
    if (item.type === "listing") {
      setAdDrafts((prev) =>
        prev[item.id] ? prev : { ...prev, [item.id]: makeAd(item) },
      );
    }
  }

  function chooseReason(item, reason) {
    setQueue((q) =>
      q.map((i) =>
        i.id === item.id ? { ...i, status: "rejected", reason } : i,
      ),
    );
    setPatterns((p) => [...p, item.name + ": " + reason]);
    setRejectingId(null);
  }

  function decideAd(id, status) {
    setAdDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], status },
    }));
  }

  // ---- Derived numbers ----
  const approvedProfit = queue
    .filter((i) => i.status === "approved")
    .reduce((sum, i) => sum + (i.profit || 0), 0);
  const loanPercent = (approvedProfit / loanGoal) * 100;
  const pendingCount = queue.filter((i) => !i.status).length;
  const totalDraftProfit = queue
    .filter((i) => i.type === "listing" && !i.status)
    .reduce((sum, i) => sum + i.profit, 0);
  const aiActionCount =
    aiActions.draft + aiActions.clean + aiActions.mission + aiActions.score;
  const aiCostEst = aiActionCount * 5;

  const listingItems = queue.filter((i) => i.type === "listing");
  const replyItems = queue.filter((i) => i.type === "reply");
  const approvedListings = listingItems.filter((i) => i.status === "approved");

  function renderActions(item) {
    if (item.status === "approved") {
      return (
        <span className="done ok">
          ✅ Approved
          {item.type === "listing"
            ? " — projected profit added to the Loan Meter"
            : " — reply ready to send"}
        </span>
      );
    }
    if (item.status === "rejected") {
      return (
        <span className="done no">
          ❌ Rejected — {item.reason} (saved to Owner Pattern)
        </span>
      );
    }
    if (rejectingId === item.id) {
      return (
        <div className="reason-chips">
          <span className="dim">Choose a reason:</span>
          {rejectReasons.map((r) => (
            <button
              key={r}
              className="chip"
              onClick={() => chooseReason(item, r)}
            >
              {r}
            </button>
          ))}
        </div>
      );
    }
    return (
      <>
        <button className="approve" onClick={() => approve(item)}>
          ✅ Approve
        </button>
        <button className="reject" onClick={() => setRejectingId(item.id)}>
          ❌ Reject
        </button>
      </>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🌙 Second Me</div>
        <div className="badges">
          <span className="badge demo">DEMO MODE — ¥0</span>
          <span className="badge credit">$150 Credit Active</span>
        </div>
      </header>

      <p className="tagline">While I sleep, my dream keeps working.</p>
      <p className="why-line">
        Why Second Me works every night: you give one mission, the AI works
        the whole night, and you make the CEO decisions in the morning.
      </p>

      <div className="slim-bar">
        <div className="slim-loan">
          <span className="slim-label">🎯 Loan Meter</span>
          <div className="bar slim">
            <div
              className="bar-fill"
              style={{
                width: Math.max(approvedProfit > 0 ? 2 : 0, loanPercent) + "%",
              }}
            />
          </div>
          <span className="slim-text">
            {formatYen(approvedProfit)} of {formatYen(loanGoal)} ·{" "}
            {loanPercent.toFixed(2)}% — family loan NPR 30 lakh, projected
            from approved drafts
          </span>
        </div>
        <div className="slim-cost">
          <span className="slim-label">🤖 AI Cost</span>
          <span className="slim-text">
            {formatYen(aiCostEst)} / ¥500 tonight · {aiActionCount} AI actions
          </span>
        </div>
      </div>

      <div className="tabs">
        <button
          className={tab === "mission" ? "tab active" : "tab"}
          onClick={() => setTab("mission")}
        >
          1 · 🌙 Mission
        </button>
        <span className="tab-arrow">›</span>
        <button
          className={tab === "log" ? "tab active" : "tab"}
          onClick={() => setTab("log")}
        >
          2 · 📜 AI Work Log
        </button>
        <span className="tab-arrow">›</span>
        <button
          className={tab === "ceo" ? "tab active" : "tab"}
          onClick={() => setTab("ceo")}
        >
          3 · 👑 CEO Approval{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>
      </div>

      {tab === "mission" && (
      <section className="card">
        <h2>🌙 What should Second Me do tonight?</h2>
        <textarea
          className="mission-input"
          rows={3}
          value={missionText}
          onChange={(e) => {
            setMissionText(e.target.value);
            setMissionPlan(null);
          }}
        />
        <div className="attach-row">
          <label className="attach-btn">
            📎 Attach a file
            <input
              type="file"
              accept=".txt,.md,.csv,.pdf,.xlsx,.xls"
              multiple
              hidden
              onChange={handleFiles}
            />
          </label>
          <span className="dim">
            A supplier price list, notes, or a pattern to follow — the AI
            reads it together with your mission. (Text, PDF or Excel files)
          </span>
        </div>
        {attachments.length > 0 && (
          <div className="attach-chips">
            {attachments.map((a, idx) => (
              <span className="attach-chip" key={idx}>
                📄 {a.name}
                <button
                  className="chip-x"
                  onClick={() => {
                    setAttachments((prev) =>
                      prev.filter((_, i) => i !== idx),
                    );
                    setMissionPlan(null);
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="row-actions">
          <button
            className="primary"
            onClick={understandMission}
            disabled={missionLoading}
          >
            {missionLoading ? "Reading..." : "🤖 Check My Plan"}
          </button>
          {!running ? (
            <button
              className="primary start-btn"
              onClick={runShift}
              disabled={!missionPlan}
            >
              ▶ Start Night Shift
            </button>
          ) : (
            <button className="danger" onClick={stopShift}>
              ⏹ Stop Shift
            </button>
          )}
        </div>
        {missionError && <p className="ai-error">{missionError}</p>}
        {missionPlan && (
          <div className="clean-result">
            <p>
              ✅ <strong>AI understood (LIVE):</strong> {missionPlan.summary}
            </p>
            <p className="dim">
              Focus: {missionPlan.focus} · Max drafts: {missionPlan.maxProducts}{" "}
              · Price cap:{" "}
              {missionPlan.maxPrice
                ? `¥${missionPlan.maxPrice.toLocaleString()}`
                : "none"}{" "}
              · Starts: {missionPlan.startTime} · Your saved Owner Pattern was
              included in this plan
            </p>
            <ul className="task-list">
              {missionPlan.tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        {!missionPlan && !missionError && (
          <p className="dim">
            Write your mission in English, Roman Nepali, or Japanese — check
            the AI's plan first, then start the shift. Start unlocks once the
            plan is confirmed.
          </p>
        )}
      </section>
      )}

      {tab === "log" && (
      <section className="card">
        <h2>📜 What the AI did</h2>
        {workLog.length === 0 && (
          <p className="dim">
            When the shift runs, every step the AI takes appears here — so
            anything wrong can be traced.
          </p>
        )}
        {workLog.map((line, idx) => (
          <div className="log-line" key={idx}>
            <span className="log-tag">{line.tag}</span>
            <span>{line.text}</span>
          </div>
        ))}

        <h3>📋 Master Product List <span className="dim">(SAMPLE data — the AI's research desk)</span></h3>
        <div className="supplier-row">
          {supplierData.suppliers.map((s) => (
            <div key={s.id} className="supplier-chip">
              <strong>{s.name}</strong> · {s.country} · ⭐ {s.rating} ·{" "}
              {s.yearsInBusiness} yrs · {s.ordersCompleted.toLocaleString()}{" "}
              orders{s.verified ? " · ✅ Verified" : " · ❌ Not verified"}
            </div>
          ))}
        </div>
        <div className="product-grid">
          {supplierData.products.map((p) => {
            const flags = flagFor(p);
            const costNum =
              p.cost === null || p.cost === undefined
                ? null
                : Number(String(p.cost).replace(/,/g, ""));
            return (
              <div key={p.id} className="product-card">
                <div className="product-top">
                  <strong>{p.name}</strong>
                  <span className="badge sample">SAMPLE</span>
                </div>
                <p className="dim">
                  {supplierName(p.supplierId)} · {p.category}
                </p>
                <p className="meta">
                  Cost:{" "}
                  <strong>
                    {costNum === null ? "—" : `¥${costNum.toLocaleString()}`}
                  </strong>{" "}
                  · Stock: {p.stock} · Ships: {p.shipDays} days · MOQ: {p.moq}
                </p>
                {flags.map((f) => (
                  <p key={f} className="flag">
                    {f}
                  </p>
                ))}
                {flags.length > 0 && !cleanResults[p.id] && (
                  <button
                    className="clean-btn"
                    onClick={() => cleanWithAI(p)}
                    disabled={cleaningId === p.id}
                  >
                    {cleaningId === p.id ? "Cleaning..." : "🧹 Clean with AI"}
                  </button>
                )}
                {cleanResults[p.id] && !cleanResults[p.id].error && (
                  <div className="clean-result">
                    <p>
                      ✅ <strong>AI cleaned (LIVE):</strong>{" "}
                      {cleanResults[p.id].cleanName} —{" "}
                      {cleanResults[p.id].cost === null
                        ? "price still missing"
                        : `¥${cleanResults[p.id].cost.toLocaleString()}`}
                    </p>
                    <p className="dim">{cleanResults[p.id].descriptionEn}</p>
                    <p className="dim">
                      Issues found:{" "}
                      {cleanResults[p.id].issues.join(" · ") || "none"}
                    </p>
                    <p>
                      <strong>
                        {cleanResults[p.id].action === "ready"
                          ? "🟢 Ready to list"
                          : "🟡 Ask the supplier first"}
                      </strong>
                    </p>
                  </div>
                )}
                {cleanResults[p.id]?.error && (
                  <p className="ai-error">{cleanResults[p.id].error}</p>
                )}
              </div>
            );
          })}
        </div>

        <h3>🌐 Live Supplier Research — CJ Dropshipping <span className="badge live">LIVE</span></h3>
        <p className="dim">
          Real products from a real supplier, fetched live through the CJ
          API. Prices are in USD — the yen figure is an estimate ($1 ≈ ¥155).
        </p>
        <div className="row-actions">
          <input
            className="cj-input"
            value={cjQuery}
            onChange={(e) => setCjQuery(e.target.value)}
            placeholder="Search CJ products — e.g. coffee, lamp, bag"
          />
          <button
            className="primary"
            onClick={searchCjManual}
            disabled={cjLoading}
          >
            {cjLoading ? "Searching..." : "🔍 Search LIVE"}
          </button>
        </div>
        {cjError && <p className="ai-error">{cjError}</p>}
        {cjResults.length > 0 && (
          <div className="product-grid">
            {cjResults.map((p) => {
              const yen = cjPriceYen(p);
              return (
                <div key={p.id} className="product-card">
                  <div className="product-top">
                    <strong>{p.name}</strong>
                    <span className="badge live">LIVE</span>
                  </div>
                  {p.image && <img className="cj-img" src={p.image} alt="" />}
                  <p className="dim">{p.supplier} · via CJ Dropshipping</p>
                  <p className="meta">
                    Price: <strong>${p.priceUsd}</strong>
                    {yen ? ` ≈ ${formatYen(yen)} (est.)` : ""} · Stock:{" "}
                    {p.stock ?? "—"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {cjResults.length > 0 && (
          <p className="dim">
            No clicking needed — during the Night Shift, drafts from these
            live products are prepared automatically and wait for you in CEO
            Approval.
          </p>
        )}

        <h3>🏆 Supplier Score <span className="dim">(data SAMPLE · scoring LIVE)</span></h3>
        <button
          className="primary"
          onClick={scoreSuppliers}
          disabled={scoreLoading}
        >
          {scoreLoading ? "Scoring..." : "🤖 Score My Suppliers"}
        </button>
        {scoreError && <p className="ai-error">{scoreError}</p>}
        {scoreResult && (
          <div>
            {scoreResult.scores.map((s) => (
              <div className="clean-result score-box" key={s.supplier}>
                <p>
                  <strong>{s.supplier}</strong> — Trust score:{" "}
                  <strong>{s.score}/100</strong>
                </p>
                <p className="dim">✅ {s.strengths.join(" · ")}</p>
                <p className="dim">⚠️ {s.risks.join(" · ")}</p>
              </div>
            ))}
            <div className="clean-result score-box">
              <p>
                ☕ <strong>Coffee pick: {scoreResult.coffeeWinner}</strong> —{" "}
                {scoreResult.coffeeReason}
              </p>
              <p className="dim">🤖 {scoreResult.recommendation}</p>
            </div>
          </div>
        )}

        <h3>✨ Test a Draft <span className="dim">(manual — the shift also does this alone)</span></h3>
        <div className="ai-form">
          <input
            value={aiForm.name}
            onChange={(e) => setAiForm({ ...aiForm, name: e.target.value })}
            placeholder="Product name"
          />
          <input
            type="number"
            value={aiForm.cost}
            onChange={(e) => setAiForm({ ...aiForm, cost: e.target.value })}
            placeholder="Cost (yen)"
          />
          <input
            value={aiForm.competitor}
            onChange={(e) =>
              setAiForm({ ...aiForm, competitor: e.target.value })
            }
            placeholder="Competitor prices"
          />
          <button
            className="primary"
            onClick={generateDraft}
            disabled={aiLoading}
          >
            {aiLoading ? "Thinking..." : "✨ Generate Draft"}
          </button>
        </div>
        {aiError && <p className="ai-error">{aiError}</p>}
      </section>
      )}

      {tab === "ceo" && (
      <section className="card">
        <h2>👑 Your morning decisions</h2>
        <p className="dim">
          {shiftDone
            ? "🌅 The night shift is done. "
            : ""}
          {pendingCount} waiting · Estimated profit in queue:{" "}
          {formatYen(totalDraftProfit)} · About 10 minutes of your time.
          Nothing here is published or spent — your tap decides.
        </p>

        <h3>(a) Products</h3>
        {listingItems.length === 0 && (
          <p className="dim">
            No product drafts yet — they appear here after a Night Shift.
            Give tonight's mission in Tab 1 and press Start Night Shift.
          </p>
        )}
        {listingItems.map((item) => (
          <div className="queue-item" key={item.id}>
            <div className="queue-main">
              {item.image && (
                <img
                  className="queue-img"
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                />
              )}
              <div className="queue-title">
                {item.emoji} {item.name}
              </div>
              <div className="queue-details">
                <span>
                  {item.supplier} → {item.platform}
                </span>
                <span>
                  Price: <strong>{formatYen(item.price)}</strong>
                </span>
                <span>
                  Profit: <strong>{formatYen(item.profit)}</strong>
                </span>
                <span>Competitor: {item.competitor}</span>
                <span
                  className={
                    "badge " + (item.signal === "LIVE" ? "live" : "sample")
                  }
                >
                  {item.signal}
                </span>
                <p className="reason">💡 {item.reason}</p>
              </div>
            </div>
            <div className="queue-actions">{renderActions(item)}</div>
          </div>
        ))}

        <h3>(b) Ads — only for approved products</h3>
        {approvedListings.length === 0 && (
          <p className="dim">
            Ad drafts are prepared for every product during the night, but
            they only appear here after you approve the product. Rejected
            products' ads stay hidden.
          </p>
        )}
        {approvedListings.map((item) => {
          const ad = adDrafts[item.id];
          if (!ad) return null;
          return (
            <div className="queue-item" key={"ad-" + item.id}>
              <div className="queue-main">
                <div className="queue-title">📣 {ad.headline}</div>
                <p className="reason">{ad.copy}</p>
                <span className="badge sample">SAMPLE AD</span>
              </div>
              <div className="queue-actions">
                {!ad.status && (
                  <>
                    <button
                      className="approve"
                      onClick={() => decideAd(item.id, "approved")}
                    >
                      ✅ Approve Ad
                    </button>
                    <button
                      className="reject"
                      onClick={() => decideAd(item.id, "rejected")}
                    >
                      ❌ Reject Ad
                    </button>
                  </>
                )}
                {ad.status === "approved" && (
                  <span className="done ok">
                    ✅ Ad approved — ready to post (demo: nothing is posted)
                  </span>
                )}
                {ad.status === "rejected" && (
                  <span className="done no">❌ Ad rejected</span>
                )}
              </div>
            </div>
          );
        })}

        <h3>(c) Customer replies</h3>
        {replyItems.map((item) => (
          <div className="queue-item" key={item.id}>
            <div className="queue-main">
              <div className="queue-title">
                {item.emoji} {item.name}
              </div>
              <p className="reason">{item.detail}</p>
            </div>
            <div className="queue-actions">{renderActions(item)}</div>
          </div>
        ))}

        <h3>🧠 Owner Pattern — what the AI has learned from you</h3>
        <ul className="patterns">
          {patterns.map((p, idx) => (
            <li key={idx}>{p}</li>
          ))}
        </ul>
      </section>
      )}

      <footer className="safety">
        🔒 Demo mode: no real orders, publishing, ads, or spending — everything
        stays a draft until the owner approves it.
      </footer>
    </div>
  );
}

export default App;
