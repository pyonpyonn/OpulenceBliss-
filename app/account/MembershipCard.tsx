// SETUP: mkdir -p "app/account" && code "app/account/MembershipCard.tsx"
//
// Membership summary — plan, term progress, next payment, schedule.

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type Membership = {
  id: string;
  planName: string;
  price: number;
  status: string;
  startDate: string | null;
  contractMonths: number;
  cyclesBilled: number;
  nextBill: string | null;
  weekday: number | null;
  hour: number | null;
  postcode: string | null;
  visitsThisCycle: number;
  visitsPerMonth: number | null;
  pausedUntil: string | null;
};

const TONE: Record<string, { bg: string; fg: string; text: string }> = {
  active: { bg: "#e7eee7", fg: "#2f4a3a", text: "Active" },
  past_due: { bg: "#f6e7dd", fg: "#8a4b26", text: "Payment failed" },
  paused: { bg: "#f6f1e8", fg: "#8a6a3b", text: "Paused" },
  cancelled: { bg: "#efe7e7", fg: "#7a3b3b", text: "Cancelled" },
};

function dateLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const d = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  return d > 0 ? d : 0;
}

export default function MembershipCard({
  m,
  compact,
}: {
  m: Membership;
  compact?: boolean;
}) {
  const tone = TONE[m.status] ?? TONE.active;
  const monthsDone = Math.min(m.cyclesBilled, m.contractMonths);
  const pct = Math.min(100, (monthsDone / m.contractMonths) * 100);
  const left = daysUntil(m.nextBill);
  const termComplete = m.cyclesBilled >= m.contractMonths;

  return (
    <section style={card}>
      <div style={head}>
        <div>
          <p style={eyebrow}>Your membership</p>
          <h2 style={title}>{m.planName}</h2>
          <p style={sub}>
            £{Number(m.price).toFixed(0)} a month
            {m.visitsPerMonth ? ` · ${m.visitsPerMonth} visits` : ""}
          </p>
        </div>
        <span style={{ ...badge, background: tone.bg, color: tone.fg }}>
          {tone.text}
        </span>
      </div>

      {/* Term progress */}
      <div style={{ marginTop: 22 }}>
        <div style={progressHead}>
          <span>
            Month {monthsDone} of {m.contractMonths}
          </span>
          <span>
            {termComplete
              ? "Minimum term complete"
              : `${m.contractMonths - monthsDone} to go`}
          </span>
        </div>
        <div style={bar}>
          <span style={{ ...barFill, width: `${pct}%` }} />
        </div>
      </div>

      {/* Facts */}
      <dl style={grid}>
        <Fact
          label="Next payment"
          value={
            m.status === "cancelled"
              ? "No further payments"
              : `${dateLabel(m.nextBill)}${
                  left !== null ? ` · in ${left} day${left === 1 ? "" : "s"}` : ""
                }`
          }
        />
        <Fact
          label="Your schedule"
          value={
            m.weekday !== null && m.hour !== null
              ? `${DAYS[m.weekday]}s at ${String(m.hour).padStart(2, "0")}:00`
              : "Being arranged"
          }
        />
        <Fact label="Visits booked this cycle" value={String(m.visitsThisCycle)} />
        <Fact label="Started" value={dateLabel(m.startDate)} />
      </dl>

      {m.pausedUntil && (
        <p style={note}>
          Paused until {dateLabel(m.pausedUntil)} — no visits will be scheduled
          before then.
        </p>
      )}

      {m.status === "past_due" && (
        <p style={{ ...note, background: "#f6e7dd", color: "#8a4b26" }}>
          Your last payment didn&apos;t go through, so we&apos;ve held your
          visits. Update your card to start them again.
        </p>
      )}

      {compact && (
        <p style={{ margin: "20px 0 0", paddingTop: 16, borderTop: "1px solid #f0ebe0" }}>
          <a href="/account/membership" style={linkStrong}>
            Manage membership →
          </a>
        </p>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={dt}>{label}</dt>
      <dd style={dd}>{value}</dd>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece5d8",
  borderRadius: 20,
  padding: "26px 28px",
  marginBottom: 26,
};
const head: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};
const eyebrow: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#cf854f",
  margin: "0 0 6px",
};
const title: React.CSSProperties = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 500,
  fontSize: 26,
  color: "#2f4a3a",
  margin: "0 0 4px",
};
const sub: React.CSSProperties = {
  color: "#6e7a70",
  fontSize: 14.5,
  margin: 0,
};
const badge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "6px 14px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};
const progressHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13,
  color: "#6e7a70",
  marginBottom: 7,
};
const bar: React.CSSProperties = {
  height: 8,
  background: "#f0ebe0",
  borderRadius: 999,
  overflow: "hidden",
};
const barFill: React.CSSProperties = {
  display: "block",
  height: "100%",
  background: "#7fa08c",
  borderRadius: 999,
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 16,
  margin: "24px 0 0",
  paddingTop: 20,
  borderTop: "1px solid #f0ebe0",
};
const dt: React.CSSProperties = {
  color: "#a89f90",
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 3,
};
const dd: React.CSSProperties = {
  margin: 0,
  color: "#26302a",
  fontSize: 14.5,
  fontWeight: 500,
};
const note: React.CSSProperties = {
  background: "#f6f1e8",
  color: "#8a6a3b",
  padding: "12px 14px",
  borderRadius: 10,
  fontSize: 14,
  margin: "18px 0 0",
};
const linkStrong: React.CSSProperties = {
  color: "#2f4a3a",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
};