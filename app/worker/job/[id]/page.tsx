// One job, in full. Save at: app/worker/job/[id]/page.tsx

import { createClient } from "@/lib/supabase/server";
import { SignedOut } from "@/app/account/page";
import ActiveJob, { type ActiveJobData } from "../../ActiveJob";
import MessageThread from "@/components/MessageThread";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignedOut area="provider" />;

  // RLS: only the assigned provider (or an admin) can read this.
  const { data: row } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, address, household_notes, customer_email, provider_id, packages(name, duration_minutes), check_ins(arrived_at, left_at, geofence_pass, gps_lat, gps_lng)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    return (
      <main style={wrap}>
        <link rel="stylesheet" href={FONTS} />
        <div style={{ maxWidth: 620, margin: "0 auto", paddingTop: 60 }}>
          <h1 style={h1}>Job not found</h1>
          <p style={{ color: "#7A828C" }}>
            This job may have been reassigned or cancelled.
          </p>
          <p style={{ marginTop: 20 }}>
            <a href="/worker" style={{ color: "#FF5A36" }}>
              ← Back to my jobs
            </a>
          </p>
        </div>
      </main>
    );
  }

  const { data: pays } = await supabase
    .from("payments")
    .select("split_breakdown, status, kind")
    .eq("booking_id", id);

  const jobPay = (pays ?? []).find((p) => p.kind !== "tip");
  const tips = (pays ?? [])
    .filter((p) => p.kind === "tip")
    .reduce(
      (s, p) =>
        s + Number((p.split_breakdown as { provider?: number } | null)?.provider ?? 0),
      0
    );

  const pkg = one(row.packages as never);
  const ci = one(row.check_ins as never) as {
    arrived_at: string | null;
    left_at: string | null;
    geofence_pass: boolean | null;
    gps_lat: number | null;
    gps_lng: number | null;
  } | null;

  const job: ActiveJobData = {
    id: row.id,
    status: row.status,
    scheduled_at: row.scheduled_at,
    address: row.address,
    notes: row.household_notes,
    client: row.customer_email,
    service: (pkg as { name: string } | null)?.name ?? "Service",
    durationMinutes:
      (pkg as { duration_minutes: number | null } | null)?.duration_minutes ??
      null,
    earns: Number(
      (jobPay?.split_breakdown as { provider?: number } | null)?.provider ?? 0
    ),
    arrivedAt: ci?.arrived_at ?? null,
    leftAt: ci?.left_at ?? null,
    geofencePass: ci?.geofence_pass ?? null,
  };

  const time = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 720, margin: "0 auto", paddingTop: 40 }}>
        <p style={{ margin: "0 0 20px" }}>
          <a href="/worker" style={{ color: "#FF5A36", fontSize: 14 }}>
            ← My jobs
          </a>
        </p>

        <ActiveJob job={job} />

        {row.provider_id && (
          <div style={{ marginTop: 22 }}>
            <MessageThread
              bookingId={job.id}
              viewerRole="provider"
              closed={
                row.status === "cancelled" ||
                new Date(row.scheduled_at).getTime() <
                  Date.now() - 7 * 24 * 60 * 60 * 1000
              }
            />
          </div>
        )}

        {/* Audit trail */}
        {(ci?.arrived_at || ci?.left_at) && (
          <section style={{ ...card, marginTop: 22 }}>
            <h2 style={sectionTitle}>Check-in record</h2>
            <dl style={grid}>
              <Row label="Arrived" value={time(ci?.arrived_at ?? null)} />
              <Row label="Left" value={time(ci?.left_at ?? null)} />
              <Row
                label="Location check"
                value={
                  ci?.geofence_pass === true
                    ? "Confirmed at address"
                    : ci?.geofence_pass === false
                    ? "Flagged — away from address"
                    : "Not verified"
                }
              />
              <Row
                label="Coordinates"
                value={
                  ci?.gps_lat
                    ? `${Number(ci.gps_lat).toFixed(4)}, ${Number(
                        ci.gps_lng
                      ).toFixed(4)}`
                    : "—"
                }
              />
            </dl>
          </section>
        )}

        {/* Money */}
        <section style={{ ...card, marginTop: 22 }}>
          <h2 style={sectionTitle}>Payment</h2>
          <dl style={grid}>
            <Row label="Your share" value={`£${job.earns?.toFixed(2) ?? "0.00"}`} />
            <Row label="Tips" value={`£${tips.toFixed(2)}`} />
            <Row
              label="Status"
              value={
                jobPay?.status === "succeeded"
                  ? "Paid to you"
                  : jobPay?.status === "refunded"
                  ? "Cancelled"
                  : "Held until you check out"
              }
            />
          </dl>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          color: "#A9AFB7",
          fontSize: 11.5,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 3,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: 14.5, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap";
const wrap: React.CSSProperties = {
  background: "transparent",
  color: "#26302a",
  fontFamily: "'Nunito', system-ui, sans-serif",
  padding: 0,
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece5d8",
  borderRadius: 16,
  padding: "22px 24px",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 16,
  margin: 0,
};
const h1: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: 900,
  fontSize: 34,
  color: "#16202A",
  margin: "0 0 8px",
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: 900,
  fontSize: 20,
  color: "#16202A",
  margin: "0 0 14px",
};
