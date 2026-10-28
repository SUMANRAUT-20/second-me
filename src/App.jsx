import { useEffect, useState } from "react";
import "./App.css";
import supplierData from "./suppliers.json";

const nightLogs = [
  {
    time: "23:12",
    text: "Shift started — supplier data synced (Supplier A: clean data, Supplier B: messy data)",
  },
  {
    time: "23:40",
    text: 'Live Research: short-video interest in coffee is rising — many "where to buy?" comments [SAMPLE]',
  },
  {
    time: "01:05",
    text: "Competitor check: coffee prices range from ¥2,700 to ¥3,200",
  },
  {
    time: "02:30",
    text: "Listing draft ready: Okinawa Brown Sugar Coffee Beans — ¥2,480 (below competitors, still profitable)",
  },
  { time: "04:10", text: "Customer reply draft prepared" },
  {
    time: "05:50",
    text: "Bookkeeping done — estimated profit added to the Approval Queue",
  },
  {
    time: "06:45",
    text: "Self-check: 1 product is missing stock data — flagged with a warning, no crash",
  },
  {
    time: "07:00",
    text: "Morning Report is ready — waiting for the owner to decide 🌅",
  },
];

const initialQueue = [
  {
    id: 1,
    type: "listing",
    emoji: "☕",
    name: "Okinawa Brown Sugar Coffee Beans",
    supplier: "Supplier A",
    platform: "Shopify",
    price: 2480,
    profit: 1240,
    competitor: "¥2,700 – ¥3,200",
    signal: "SAMPLE",
    reason:
      "Short-video interest is rising; priced below competitors while keeping ¥1,240 profit.",
  },
  {
    id: 2,
    type: "listing",
    emoji: "👜",
    name: "Nepali Dhaka Tote Bag",
    supplier: "Supplier B",
    platform: "Mercari",
    price: 3980,
    profit: 1840,
    competitor: "¥4,500 – ¥5,200",
    signal: "SAMPLE",
    reason:
      "More people are searching for handmade items; the supplier data was messy, so the AI cleaned it first.",
  },
  {
    id: 3,
    type: "listing",
    emoji: "💡",
    name: "Bamboo Desk Lamp",
    supplier: "Supplier A",
    platform: "Shopify",
    price: 4580,
    profit: 1520,
    competitor: "¥4,990 – ¥5,600",
    signal: "SAMPLE",
    reason:
      "Strong demand in desk-setup videos; priced below competitors with a healthy profit.",
  },
  {
    id: 4,
    type: "reply",
    emoji: "💬",
    name: "Customer Reply Draft",
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

function formatYen(n) {
  return "¥" + n.toLocaleString("en-US");
}

function App() {
  const [running, setRunning] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState(0);
  const [queue, setQueue] = useState(initialQueue);
  const [rejectingId, setRejectingId] = useState(null);
  const [patterns, setPatterns] = useState([
    "Prioritize coffee and handmade products",
    "Be careful with products priced over ¥5,000",
    "Avoid suppliers with slow shipping",
  ]);

  useEffect(() => {
    if (!running) return;
    if (visibleLogs >= nightLogs.length) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setVisibleLogs((v) => v + 1), 850);
    return () => clearTimeout(t);
  }, [running, visibleLogs]);
  const [aiForm, setAiForm] = useState({
    name: "Okinawa Brown Sugar Coffee Beans 200g",
    cost: 1200,
    competitor: "2700-3200 yen",
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiActions, setAiActions] = useState({
    draft: 0,
    clean: 0,
    mission: 0,
    score: 0,
  });

  async function generateDraft() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("http://localhost:8787/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "AI error");
      setQueue((q) => [
        {
          id: Date.now(),
          type: "listing",
          emoji: "🤖",
          name: data.draft.title,
          supplier: "Live AI Draft",
          platform: "Shopify",
          price: data.draft.price,
          profit: data.draft.price - Number(aiForm.cost),
          competitor: aiForm.competitor,
          signal: "LIVE",
          reason: data.draft.reason,
        },
        ...q,
      ]);
      setAiActions((a) => ({ ...a, draft: a.draft + 1 }));
    } catch (e) {
      setAiError(
        'Could not reach the AI server. Is "node server.mjs" running?',
      );
    }
    setAiLoading(false);
  }
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
  const [cleanResults, setCleanResults] = useState({});
  const [cleaningId, setCleaningId] = useState(null);

  async function cleanWithAI(product) {
    setCleaningId(product.id);
    try {
      const res = await fetch("http://localhost:8787/api/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "AI error");
      setCleanResults((prev) => ({ ...prev, [product.id]: data.cleaned }));
      setAiActions((a) => ({ ...a, clean: a.clean + 1 }));
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
  const [missionText, setMissionText] = useState(
    "Tonight, focus on coffee products only. Make up to 5 drafts, keep prices under ¥3,000, start at 23:00.",
  );
  const [missionPlan, setMissionPlan] = useState(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState("");

  async function understandMission() {
    setMissionLoading(true);
    setMissionError("");
    setMissionPlan(null);
    try {
      const res = await fetch("http://localhost:8787/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: missionText }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "AI error");
      setMissionPlan(data.plan);
      setAiActions((a) => ({ ...a, mission: a.mission + 1 }));
    } catch (e) {
      setMissionError(
        'Could not reach the AI server. Is "node server.mjs" running?',
      );
    }
    setMissionLoading(false);
  }
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");

  async function scoreSuppliers() {
    setScoreLoading(true);
    setScoreError("");
    setScoreResult(null);
    try {
      const res = await fetch("http://localhost:8787/api/supplier-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppliers: supplierData.suppliers }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "AI error");
      setScoreResult(data.result);
      setAiActions((a) => ({ ...a, score: a.score + 1 }));
    } catch (e) {
      setScoreError(
        'Could not reach the AI server. Is "node server.mjs" running?',
      );
    }
    setScoreLoading(false);
  }
  const reportReady = visibleLogs >= nightLogs.length;
  const approvedProfit = queue
    .filter((i) => i.status === "approved")
    .reduce((sum, i) => sum + (i.profit || 0), 0);
  const loanPercent = (approvedProfit / loanGoal) * 100;
  const totalDraftProfit = initialQueue
    .filter((i) => i.type === "listing")
    .reduce((sum, i) => sum + i.profit, 0);
  const aiActionCount =
    aiActions.draft + aiActions.clean + aiActions.mission + aiActions.score;
  const aiCostEst = aiActionCount * 5;

  function startShift() {
    setVisibleLogs(0);
    setRunning(true);
  }

  function approve(id) {
    setQueue((q) =>
      q.map((i) => (i.id === id ? { ...i, status: "approved" } : i)),
    );
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🌙 Second Me</div>
        <div className="badges">
          <span className="badge demo">DEMO MODE — ¥0</span>
          <span className="badge credit">$150 Credit Active</span>
        </div>
      </header>

      <section className="hero card">
        <h1>While I sleep, my dream keeps working.</h1>
        <p>
          Second Me is an AI night-shift worker for a micro-business: it
          researches products, checks competitors, fixes prices and drafts
          listings overnight — the owner only makes CEO decisions in the
          morning.
        </p>
        <div className="mission">
          <strong>Tonight&apos;s mission:</strong> “Focus only on coffee and
          handmade items, up to 5 listings, prices under ¥5,000.”
          <span className="mission-note">
            {" "}
            (written by the owner in plain words — the AI confirmed this plan)
          </span>
        </div>
        <div className="hero-actions">
          {!running && !reportReady && (
            <button className="primary" onClick={startShift}>
              ▶ Start Night Shift
            </button>
          )}
          {running && (
            <button className="danger" onClick={() => setRunning(false)}>
              ⏹ Stop Shift
            </button>
          )}
          {reportReady && (
            <button className="primary" onClick={startShift}>
              ↻ Run Again
            </button>
          )}
          <span className="status">
            {running
              ? "🌙 Night Shift is running…"
              : reportReady
                ? "🌅 Morning Report is ready"
                : "Ready to start the shift"}
          </span>
        </div>
      </section>

      <section className="card flow-strip">
        <div className="flow-step">
          <span className="flow-num">1</span>
          <div>
            <strong>Give a Mission</strong>
            <p>Tell the AI what to find</p>
          </div>
        </div>
        <div className="flow-arrow">›</div>
        <div className="flow-step">
          <span className="flow-num">2</span>
          <div>
            <strong>AI Researches</strong>
            <p>Finds products and suppliers</p>
          </div>
        </div>
        <div className="flow-arrow">›</div>
        <div className="flow-step">
          <span className="flow-num">3</span>
          <div>
            <strong>Prepares Drafts</strong>
            <p>Creates listings and prices</p>
          </div>
        </div>
        <div className="flow-arrow">›</div>
        <div className="flow-step">
          <span className="flow-num">4</span>
          <div>
            <strong>You Approve</strong>
            <p>Review and select</p>
          </div>
        </div>
        <div className="flow-arrow">›</div>
        <div className="flow-step">
          <span className="flow-num">5</span>
          <div>
            <strong>Track Results</strong>
            <p>Sales, profit and loan progress</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Step 1 · 🌙 Mission Check</h2>
        <p className="dim">
          Write tonight's mission in your own words — English or Roman Nepali.
          Second Me reads it and shows its plan before the shift starts.
        </p>
        <textarea
          className="mission-input"
          rows={3}
          value={missionText}
          onChange={(e) => setMissionText(e.target.value)}
        />
        <div>
          <button
            className="primary"
            onClick={understandMission}
            disabled={missionLoading}
          >
            {missionLoading ? "Reading..." : "🤖 Understand My Mission"}
          </button>
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
              · Starts: {missionPlan.startTime}
            </p>
            <ul className="task-list">
              {missionPlan.tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Step 2 · 📋 Master Product List</h2>
        <p className="dim">
          One clean list from every supplier. Messy data gets flagged — the
          system never breaks. Data: SAMPLE
        </p>
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
      </section>

      <section className="card">
        <h2>Step 2 · 🏆 Supplier Score</h2>
        <p className="dim">
          Second Me compares your suppliers — trust score, strengths, risks —
          and picks the better coffee deal. Supplier data: SAMPLE · AI scoring:
          LIVE.
        </p>
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
      </section>

      <section className="card console">
        <h2>Step 3 · 🌙 Night Shift Log</h2>
        {visibleLogs === 0 && (
          <p className="dim">
            When the shift starts, the overnight work appears here line by
            line.
          </p>
        )}
        {nightLogs.slice(0, visibleLogs).map((log, idx) => (
          <div className="log-line" key={idx}>
            <span className="log-time">{log.time}</span>
            <span>{log.text}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Step 3 · 🤖 Live AI Draft</h2>
        <p className="dim">
          Real Muse Spark, right now — type a product and let Second Me draft
          it. The draft lands at the top of your Approval Queue.
        </p>
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

      <section className="card report">
        <h2>Step 4 · 🌅 Morning Report</h2>
        <div className="stats">
          <div className="stat">
            <div className="stat-num">
              {visibleLogs}/{nightLogs.length}
            </div>
            <div className="stat-label">Overnight tasks</div>
          </div>
          <div className="stat">
            <div className="stat-num">{queue.length}</div>
            <div className="stat-label">Drafts ready</div>
          </div>
          <div className="stat">
            <div className="stat-num">{formatYen(totalDraftProfit)}</div>
            <div className="stat-label">Estimated profit</div>
          </div>
          <div className="stat">
            <div className="stat-num">~10 min</div>
            <div className="stat-label">Owner time needed</div>
          </div>
        </div>
      </section>

      <section className="card queue">
        <h2>Step 4 · 👑 CEO Approval Queue</h2>
        {queue.map((item) => (
          <div className="queue-item" key={item.id}>
            <div className="queue-main">
              <div className="queue-title">
                {item.emoji} {item.name}
              </div>
              {item.type === "listing" ? (
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
                  <span className="badge sample">{item.signal}</span>
                  <p className="reason">💡 {item.reason}</p>
                </div>
              ) : (
                <p className="reason">{item.detail}</p>
              )}
            </div>
            <div className="queue-actions">
              {!item.status && rejectingId !== item.id && (
                <>
                  <button className="approve" onClick={() => approve(item.id)}>
                    ✅ Approve
                  </button>
                  <button
                    className="reject"
                    onClick={() => setRejectingId(item.id)}
                  >
                    ❌ Reject
                  </button>
                </>
              )}
              {!item.status && rejectingId === item.id && (
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
              )}
              {item.status === "approved" && (
                <span className="done ok">
                  ✅ Approved
                  {item.type === "listing"
                    ? " — profit added to the Loan Meter"
                    : " — reply ready to send"}
                </span>
              )}
              {item.status === "rejected" && (
                <span className="done no">
                  ❌ Rejected — {item.reason} (saved to Owner Pattern)
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>🤖 AI Cost Controls</h2>
        <p className="dim">
          Every AI call in this session, counted live. Real per-call cost is
          tiny (the first call used 677 tokens) — exact billing lives in the
          Meta dashboard; figures here are honest estimates at ¥5 per AI
          action.
        </p>
        <div className="cost-total">
          {formatYen(aiCostEst)}{" "}
          <span className="dim">/ ¥500 session budget (est.)</span>
        </div>
        <div className="bar">
          <div
            className="bar-fill"
            style={{ width: Math.min(100, (aiCostEst / 500) * 100) + "%" }}
          />
        </div>
        <p className="dim">
          Drafts: {aiActions.draft} ({formatYen(aiActions.draft * 5)}) ·
          Cleaning: {aiActions.clean} ({formatYen(aiActions.clean * 5)}) ·
          Missions: {aiActions.mission} ({formatYen(aiActions.mission * 5)}) ·
          Supplier scores: {aiActions.score} ({formatYen(aiActions.score * 5)})
          {" "}— {aiActionCount} AI actions this session
        </p>
        <p className="dim">
          Runs on the $150 hackathon credit. In the full version the shift
          auto-stops at the budget cap.
        </p>
      </section>

      <section className="card loan">
        <h2>Step 5 · 🎯 Loan Meter</h2>
        <p className="dim">
          Family home loan — NPR 30 lakh (≈ {formatYen(loanGoal)})
        </p>
        <div className="loan-amount">{formatYen(approvedProfit)}</div>
        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width: Math.max(approvedProfit > 0 ? 2 : 0, loanPercent) + "%",
            }}
          />
        </div>
        <p className="dim">
          {loanPercent.toFixed(2)}% — profit from approved listings collects
          here.
        </p>
        <h3>🧠 Owner Pattern</h3>
        <ul className="patterns">
          {patterns.map((p, idx) => (
            <li key={idx}>{p}</li>
          ))}
        </ul>
      </section>

      <footer className="safety">
        🔒 Demo mode: no real orders, publishing, ads, or spending — everything
        stays a draft until the owner approves it.
      </footer>
    </div>
  );
}

export default App;
