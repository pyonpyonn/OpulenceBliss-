// Admin dashboard — data overview + reset tools.
// Save at: app/admin/page.tsx
// Log in as admin@test.com, then visit localhost:3000/admin

import { createClient } from "@/lib/supabase/server";
import AdminButtons from "./AdminButtons";
import VettingButtons from "./VettingButtons";
import ReviewList, { type Review } from "./ReviewList";

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string
) {
  const { count: c } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return c ?? 0;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = p?.role ?? null;
  }

  if (role !== "admin") {
    return (
      <main style={wrap}>
        <link rel="stylesheet" href={FONTS} />
        <div style={{ ...card, maxWidth: 440, textAlign: "center" }}>
          <p style={eyebrow}>Admin</p>
          <h1 style={{ ...h1, fontSize: 27 }}>Admins only</h1>
          <p style={{ color: "#6e7a70", margin: "0 0 22px" }}>
            {user
              ? "This account doesn't have admin access."
              : "Log in with an admin account to continue."}
          </p>
          <a href="/login" style={btn}>
            Go to log in
          </a>
        </div>
      </main>
    );
  }

  const [bookings, payments, providers, services, areas] = await Promise.all([
    count(supabase, "bookings"),
    count(supabase, "payments"),
    count(supabase, "providers"),
    count(supabase, "packages"),
    count(supabase, "service_areas"),
  ]);

  const { data: provRows } = await supabase
    .from("providers")
    .select(
      "id, display_name, services, vetting_status, joining_fee_paid, rating_avg, rating_count, profiles(email)"
    );

  const pending = (provRows ?? []).filter(
    (p) => p.vetting_status === "pending"
  );

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, reviewer, rating, comment, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <main style={{ ...wrap, display: "block", padding: "0 20px 80px" }}>
      <link rel="stylesheet" href={FONTS} />

      <div style={{ maxWidth: 780, margin: "0 auto", paddingTop: 40 }}>
        <p style={eyebrow}>Admin</p>
        <h1 style={h1}>Control panel</h1>
        <p style={{ color: "#6e7a70", margin: "0 0 32px" }}>
          Signed in as {user?.email}
        </p>

        {/* Counts */}
        <h2 style={sectionTitle}>What&apos;s in the database</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
            marginBottom: 34,
          }}
        >
          {[
            ["Bookings", bookings],
            ["Payments", payments],
            ["Providers", providers],
            ["Services", services],
            ["Areas", areas],
          ].map(([label, n]) => (
            <div key={String(label)} style={{ ...card, padding: "18px 20px" }}>
              <p
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 28,
                  color: "#2f4a3a",
                  margin: "0 0 2px",
                }}
              >
                {n as number}
              </p>
              <span style={{ color: "#6e7a70", fontSize: 13.5 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Vetting queue */}
        <h2 style={sectionTitle}>
          Awaiting approval{pending.length > 0 ? ` (${pending.length})` : ""}
        </h2>
        <div style={{ ...card, padding: "6px 20px", marginBottom: 34 }}>
          {pending.length === 0 ? (
            <p style={{ color: "#6e7a70", padding: "16px 0" }}>
              Nothing waiting — all providers have been reviewed.
            </p>
          ) : (
            pending.map((p) => {
              const email =
                (Array.isArray(p.profiles)
                  ? (p.profiles as { email: string }[])[0]?.email
                  : (p.profiles as { email: string } | null)?.email) ?? "—";
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px 0",
                    borderBottom: "1px solid #f0ebe0",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 15 }}>
                      {p.display_name || email}
                    </strong>
                    <div style={{ color: "#6e7a70", fontSize: 13 }}>
                      {email} · {(p.services ?? []).join(", ") || "no skills"} ·{" "}
                      {p.joining_fee_paid ? "fee paid" : "fee unpaid"}
                    </div>
                  </div>
                  <VettingButtons id={p.id} />
                </div>
              );
            })
          )}
        </div>

        {/* Providers */}
        <h2 style={sectionTitle}>Providers</h2>
        <div style={{ ...card, padding: "6px 20px", marginBottom: 34 }}>
          {(provRows ?? []).length === 0 ? (
            <p style={{ color: "#6e7a70", padding: "16px 0" }}>
              No providers yet.
            </p>
          ) : (
            (provRows ?? []).map((p) => {
              const email =
                (Array.isArray(p.profiles)
                  ? (p.profiles as { email: string }[])[0]?.email
                  : (p.profiles as { email: string } | null)?.email) ?? "—";
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 0",
                    borderBottom: "1px solid #f0ebe0",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 15 }}>{email}</strong>
                    <div style={{ color: "#6e7a70", fontSize: 13 }}>
                      {(p.services ?? []).join(", ") || "no skills set"} ·{" "}
                      {p.vetting_status}
                      {p.rating_avg
                        ? ` · ${Number(p.rating_avg).toFixed(1)}★ (${p.rating_count})`
                        : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: p.joining_fee_paid ? "#e7eee7" : "#f6e7dd",
                      color: p.joining_fee_paid ? "#2f4a3a" : "#8a4b26",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.joining_fee_paid ? "Fee paid · active" : "Fee unpaid"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Reviews */}
        <h2 style={sectionTitle}>Reviews</h2>
        <div style={{ ...card, padding: "6px 20px", marginBottom: 34 }}>
          <ReviewList reviews={(reviewRows ?? []) as Review[]} />
        </div>

        {/* Tools */}
        <h2 style={sectionTitle}>Reset tools</h2>
        <p style={{ color: "#6e7a70", margin: "0 0 16px", fontSize: 14.5 }}>
          Useful between demos. Each one asks you to confirm first.
        </p>
        <AdminButtons />

        <p style={{ marginTop: 30 }}>
          <a href="/" style={{ color: "#5b7a65", fontSize: 14 }}>
            ← Back to site
          </a>
        </p>
      </div>
    </main>
  );
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap";

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fbf7f0",
  color: "#26302a",
  fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
  display: "grid",
  placeItems: "center",
  padding: 24,
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece5d8",
  borderRadius: 16,
  padding: "28px 26px",
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
const btn: React.CSSProperties = {
  display: "inline-block",
  background: "#2f4a3a",
  color: "#fbf7f0",
  padding: "12px 26px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 600,
};
