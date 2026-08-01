// The provider's live job — one focused screen for whoever's on the job.
// Save at: app/worker/current/page.tsx

import { createClient } from "@/lib/supabase/server";
import { SignedOut } from "@/app/account/page";
import AreaNav from "@/components/AreaNav";
import ActiveJob, { type ActiveJobData } from "../ActiveJob";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function CurrentJobPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignedOut area="provider" />;

  const { data: prov } = await supabase
    .from("providers")
    .select("id, joining_fee_paid, vetting_status")
    .eq("profile_id", user.id)
    .maybeSingle();

  // In progress first; otherwise the next confirmed job.
  const { data: rows } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, address, household_notes, customer_email, packages(name, duration_minutes), check_ins(arrived_at, left_at, geofence_pass)"
    )
    .in("status", ["in_progress", "scheduled"])
    .order("scheduled_at", { ascending: true });

  const list = rows ?? [];
  const row =
    list.find((r) => r.status === "in_progress") ?? list[0] ?? null;

  const { data: pays } = row
    ? await supabase
        .from("payments")
        .select("split_breakdown, kind")
        .eq("booking_id", row.id)
    : { data: null };

  const jobPay = (pays ?? []).find((p) => p.kind !== "tip");

  const job: ActiveJobData | null = row
    ? {
        id: row.id,
        status: row.status,
        scheduled_at: row.scheduled_at,
        address: row.address,
        notes: row.household_notes,
        client: row.customer_email,
        service:
          (one(row.packages as never) as { name: string } | null)?.name ??
          "Service",
        durationMinutes:
          (one(row.packages as never) as {
            duration_minutes: number | null;
          } | null)?.duration_minutes ?? null,
        earns: Number(
          (jobPay?.split_breakdown as { provider?: number } | null)?.provider ??
            0
        ),
        arrivedAt:
          (one(row.check_ins as never) as { arrived_at: string | null } | null)
            ?.arrived_at ?? null,
        leftAt:
          (one(row.check_ins as never) as { left_at: string | null } | null)
            ?.left_at ?? null,
        geofencePass:
          (one(row.check_ins as never) as {
            geofence_pass: boolean | null;
          } | null)?.geofence_pass ?? null,
      }
    : null;

  const blocked =
    !prov || !prov.joining_fee_paid || prov.vetting_status !== "approved";

  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 720, margin: "0 auto", paddingTop: 40 }}>
        <p style={eyebrow}>Provider area</p>
        <h1 style={h1}>Current job</h1>
        <p style={{ color: "#6e7a70", margin: "0 0 26px" }}>
          Everything you need while you&apos;re working.
        </p>

        <AreaNav area="provider" />

        {blocked ? (
          <div style={empty}>
            <p style={{ margin: "0 0 16px" }}>
              Your account isn&apos;t active for work yet.
            </p>
            <a href="/worker" style={btn}>
              Go to my jobs
            </a>
          </div>
        ) : !job ? (
          <div style={empty}>
            <p style={{ margin: "0 0 8px", fontSize: 16, color: "#2f4a3a" }}>
              Nothing on right now.
            </p>
            <p style={{ margin: "0 0 18px", color: "#6e7a70", fontSize: 14.5 }}>
              When you accept a job it&apos;ll appear here, ready to check in.
            </p>
            <a href="/worker" style={btn}>
              See new offers
            </a>
          </div>
        ) : (
          <>
            <ActiveJob job={job} />
            <p style={{ marginTop: 18, display: "flex", gap: 18 }}>
              <a href={`/worker/job/${job.id}`} style={link}>
                Full job record
              </a>
              <a href="/worker" style={link}>
                All my jobs
              </a>
            </p>
          </>
        )}
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
  padding: "0 20px 80px",
};
const empty: React.CSSProperties = {
  background: "#fff",
  border: "1.5px dashed #d8cfbe",
  borderRadius: 16,
  padding: "40px 26px",
  textAlign: "center",
  color: "#6e7a70",
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
const btn: React.CSSProperties = {
  display: "inline-block",
  background: "#2f4a3a",
  color: "#fbf7f0",
  padding: "12px 26px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 600,
};
const link: React.CSSProperties = { color: "#5b7a65", fontSize: 14 };
