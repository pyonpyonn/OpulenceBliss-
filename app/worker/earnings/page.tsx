// Provider earnings — what you've made and what's coming.
// Save at: app/worker/earnings/page.tsx

import { createClient } from "@/lib/supabase/server";
import { SignedOut } from "@/app/account/page";

const gbp = (n: number) =>
  "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 });

type Bk = {
  scheduled_at: string;
  status: string;
  packages: { name: string } | { name: string }[] | null;
};

type Pay = {
  id: string;
  gross_amount: number;
  split_breakdown: { provider?: number } | null;
  status: string;
  kind: string | null;
  created_at: string;
  bookings: Bk | Bk[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function svc(p: Pay) {
  const b = one<Bk>(p.bookings);
  const pk = one<{ name: string }>(b?.packages ?? null);
  return pk?.name ?? "Service";
}

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignedOut area="provider" />;

  const { data: prov } = await supabase
    .from("providers")
    .select("id, rating_avg, rating_count, joining_fee_paid")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: paysData } = await supabase
    .from("payments")
    .select(
      "id, gross_amount, split_breakdown, status, kind, created_at, bookings(scheduled_at, status, packages(name))"
    )
    .order("created_at", { ascending: false });

  const pays = (paysData ?? []) as unknown as Pay[];
  const share = (p: Pay) => Number(p.split_breakdown?.provider ?? 0);

  const jobs = pays.filter((p) => p.kind !== "tip");
  const tips = pays.filter((p) => p.kind === "tip" && p.status === "succeeded");

  const paid = jobs.filter((p) => p.status === "succeeded");
  const held = jobs.filter((p) => p.status === "pending");

  const earned = paid.reduce((s, p) => s + share(p), 0);
  const pendingTotal = held.reduce((s, p) => s + share(p), 0);
  const tipTotal = tips.reduce((s, p) => s + share(p), 0);

  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 700, margin: "0 auto", paddingTop: 40 }}>
        <p style={eyebrow}>Provider area</p>
        <h1 style={h1}>Your earnings</h1>
        <p style={{ color: "#6e7a70", margin: "0 0 30px" }}>
          You keep your agreed share of every completed visit, paid automatically.
        </p>

        <div style={statGrid}>
          <Stat label="Paid to you" value={gbp(earned + tipTotal)} big />
          <Stat label="Awaiting completion" value={gbp(pendingTotal)} />
          <Stat label="Tips received" value={gbp(tipTotal)} />
          <Stat label="Visits completed" value={String(paid.length)} />
          <Stat
            label="Your rating"
            value={
              prov?.rating_avg
                ? `${Number(prov.rating_avg).toFixed(1)} ★ (${prov.rating_count})`
                : "No ratings yet"
            }
          />
        </div>

        <h2 style={sectionTitle}>Job by job</h2>
        {pays.length === 0 ? (
          <div style={empty}>
            No earnings yet. Once you complete a visit it&apos;ll appear here.
          </div>
        ) : (
          <div style={{ ...card, padding: "6px 22px" }}>
            {pays.map((p) => (
              <div key={p.id} style={row}>
                <div>
                  <strong style={{ fontSize: 15, color: "#2f4a3a" }}>
                    {p.kind === "tip" ? `Tip · ${svc(p)}` : svc(p)}
                  </strong>
                  <div style={{ color: "#6e7a70", fontSize: 13 }}>
                    {one<Bk>(p.bookings)?.scheduled_at
                      ? new Date(
                          one<Bk>(p.bookings)!.scheduled_at
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}{" "}
                    · customer paid {gbp(p.gross_amount)}
                  </div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <strong style={{ fontSize: 16 }}>{gbp(share(p))}</strong>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: p.status === "succeeded" ? "#2f4a3a" : "#8a4b26",
                    }}
                  >
                    {p.status === "succeeded"
                      ? "Paid"
                      : p.status === "refunded"
                      ? "Cancelled"
                      : "Pending"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ marginTop: 28, display: "flex", gap: 18 }}>
          <a href="/worker" style={link}>
            ← My jobs
          </a>
          <a href="/worker/profile" style={link}>
            My profile
          </a>
          <a href="/worker/availability" style={link}>
            My availability
          </a>
        </p>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div style={{ ...card, padding: "20px 22px" }}>
      <p
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: big ? 30 : 22,
          color: "#2f4a3a",
          margin: "0 0 3px",
        }}
      >
        {value}
      </p>
      <span style={{ color: "#6e7a70", fontSize: 13.5 }}>{label}</span>
    </div>
  );
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap";
const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fbf7f0",
  color: "#26302a",
  fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
  padding: "0 20px 80px",
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece5d8",
  borderRadius: 16,
};
const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  marginBottom: 34,
};
const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: "15px 0",
  borderBottom: "1px solid #f0ebe0",
};
const eyebrow: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontSize: 12,
  fontWeight: 600,
  color: "#cf854f",
  margin: "0 0 6px",
};
const h1: React.CSSProperties = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 500,
  fontSize: 38,
  color: "#2f4a3a",
  margin: "0 0 6px",
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 500,
  fontSize: 22,
  color: "#2f4a3a",
  margin: "0 0 14px",
};
const empty: React.CSSProperties = {
  background: "#fff",
  border: "1.5px dashed #d8cfbe",
  borderRadius: 14,
  padding: "28px 24px",
  textAlign: "center",
  color: "#6e7a70",
};
const link: React.CSSProperties = { color: "#5b7a65", fontSize: 14 };