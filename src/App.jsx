import { useEffect, useState } from "react";
import "./App.css";

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

  const reportReady = visibleLogs >= nightLogs.length;
  const approvedProfit = queue
    .filter((i) => i.status === "approved")
    .reduce((sum, i) => sum + (i.profit || 0), 0);
  const loanPercent = (approvedProfit / loanGoal) * 100;
  const totalDraftProfit = initialQueue
    .filter((i) => i.type === "listing")
    .reduce((sum, i) => sum + i.profit, 0);

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

      <div className="grid">
        <section className="card console">
          <h2>🌙 Night Shift Log</h2>
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

        <section className="card loan">
          <h2>🎯 Loan Meter</h2>
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
      </div>

      <section className="card report">
        <h2>🌅 Morning Report</h2>
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
        <h2>👑 CEO Approval Queue</h2>
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

      <footer className="safety">
        🔒 Demo mode: no real orders, publishing, ads, or spending — everything
        stays a draft until the owner approves it.
      </footer>
    </div>
  );
}

export default App;
