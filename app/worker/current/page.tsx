// The provider's live job — one focused screen for whoever's on the job.
// Save at: app/worker/current/page.tsx

import { createClient } from "@/lib/supabase/server";
import { SignedOut } from "@/app/account/page";
import ActiveJob, { type ActiveJobData } from "../ActiveJob";
import MessageThread from "@/components/MessageThread";
import CustomerSummaryCard from "@/components/CustomerSummaryCard";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
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

  // A "current job" is simply one you've checked into. The check-in rules
  // (same day, from 30 minutes before) are enforced at check-in, so anything
  // in progress here is legitimately in progress.

  // Only a job you've actually checked into counts as "current".
  const { data: rows } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, address, household_notes, customer_id, customer_email, provider_payout, subscription_id, packages(name, duration_minutes, price), check_ins(arrived_at, left_at, geofence_pass, gps_lat, gps_lng)",
    )
    .eq("status", "in_progress")
    .order("scheduled_at", { ascending: true })
    .limit(1);

  const row = (rows ?? [])[0] ?? null;

  const { data: customerRows } = row
    ? await supabase.rpc("booking_customer_summary", {
        p_booking_id: row.id,
      })
    : { data: null };
  const customer = one(customerRows as never) as {
    full_name: string | null;
    client_rating_avg: number | null;
    client_rating_count: number | null;
  } | null;

  const { data: pays } = row
    ? await supabase
        .from("payments")
        .select("split_breakdown, kind, status, gross_amount")
        .eq("booking_id", row.id)
    : { data: null };

  const jobPay = (pays ?? []).find((p) => p.kind !== "tip");
  const tipTotal = (pays ?? [])
    .filter((p) => p.kind === "tip")
    .reduce((t, p) => t + Number(p.gross_amount ?? 0), 0);

  const ci = row
    ? (one(row.check_ins as never) as {
        arrived_at: string | null;
        left_at: string | null;
        geofence_pass: boolean | null;
        gps_lat: number | null;
        gps_lng: number | null;
      } | null)
    : null;

  const time = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

  const job: ActiveJobData | null = row
    ? {
        id: row.id,
        status: row.status,
        scheduled_at: row.scheduled_at,
        address: row.address,
        notes: row.household_notes,
        client: customer?.full_name ?? row.customer_email,
        clientRating:
          customer?.client_rating_avg === null ||
          customer?.client_rating_avg === undefined
            ? null
            : Number(customer.client_rating_avg),
        clientRatingCount: customer?.client_rating_count ?? 0,
        service:
          (one(row.packages as never) as { name: string } | null)?.name ??
          "Service",
        durationMinutes:
          (
            one(row.packages as never) as {
              duration_minutes: number | null;
            } | null
          )?.duration_minutes ?? null,
        earns: Number(
          (jobPay?.split_breakdown as { provider?: number } | null)?.provider ??
            0,
        ),
        arrivedAt:
          (one(row.check_ins as never) as { arrived_at: string | null } | null)
            ?.arrived_at ?? null,
        leftAt:
          (one(row.check_ins as never) as { left_at: string | null } | null)
            ?.left_at ?? null,
        geofencePass:
          (
            one(row.check_ins as never) as {
              geofence_pass: boolean | null;
            } | null
          )?.geofence_pass ?? null,
      }
    : null;

  const blocked =
    !prov || !prov.joining_fee_paid || prov.vetting_status !== "approved";

  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 1120 }}>
        <h1 style={h1}>Current job</h1>
        <p style={{ color: "#7A828C", margin: "0 0 24px", fontWeight: 600 }}>
          Everything you need while you&apos;re on site.
        </p>

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
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 17,
                fontWeight: 900,
                color: "#16202A",
              }}
            >
              No job in progress
            </p>
            <p
              style={{
                margin: "0 0 18px",
                color: "#7A828C",
                fontSize: 14.5,
                fontWeight: 600,
              }}
            >
              Check in from My jobs when you arrive at the customer&apos;s home,
              and the full job details will appear here.
            </p>
            <a href="/worker" style={btn}>
              Go to my jobs
            </a>
          </div>
        ) : (
          <div className="current-job-workspace">
            <div className="current-job-details">
              <ActiveJob job={job} />

              <div style={{ marginTop: 20 }}>
                <CustomerSummaryCard
                  name={customer?.full_name ?? null}
                  email={row.customer_email}
                  rating={
                    customer?.client_rating_avg === null ||
                    customer?.client_rating_avg === undefined
                      ? null
                      : Number(customer.client_rating_avg)
                  }
                  ratingCount={customer?.client_rating_count ?? 0}
                />
              </div>

              {/* ---- check-in record ---- */}
              <section style={{ ...card, marginTop: 20 }}>
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
                            ci.gps_lng,
                          ).toFixed(4)}`
                        : "—"
                    }
                  />
                </dl>
              </section>

              {/* ---- the client's notes in full ---- */}
              {row.household_notes && (
                <section style={{ ...card, marginTop: 20 }}>
                  <h2 style={sectionTitle}>What the client asked for</h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: 1.6,
                      color: "#3A424B",
                    }}
                  >
                    {row.household_notes}
                  </p>
                </section>
              )}

              {/* ---- money ---- */}
              <section style={{ ...card, marginTop: 20 }}>
                <h2 style={sectionTitle}>Payment</h2>
                <dl style={grid}>
                  <Row
                    label="You earn"
                    value={`£${(job.earns ?? 0).toFixed(2)}`}
                  />
                  <Row label="Tips so far" value={`£${tipTotal.toFixed(2)}`} />
                  <Row
                    label="How you're paid"
                    value={
                      row.subscription_id
                        ? "Transferred when you check out"
                        : "Released when you check out"
                    }
                  />
                  <Row
                    label="Status"
                    value={
                      jobPay?.status === "succeeded"
                        ? "Paid to you"
                        : "Waiting on check-out"
                    }
                  />
                </dl>
              </section>
              <p style={{ marginTop: 20 }}>
                <a href="/worker" style={link}>
                  ← All my jobs
                </a>
              </p>
            </div>

            <aside className="current-job-chat">
              <MessageThread bookingId={job.id} viewerRole="provider" />
            </aside>
          </div>
        )}
      </div>

      <style>{`
        .current-job-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(310px, 370px);
          align-items: start;
          gap: 24px;
        }
        .current-job-details {
          min-width: 0;
        }
        .current-job-chat {
          min-width: 0;
          position: sticky;
          top: 24px;
        }
        @media (max-width: 1100px) {
          .current-job-workspace {
            grid-template-columns: minmax(0, 1fr);
          }
          .current-job-chat {
            position: static;
          }
        }
      `}</style>
    </main>
  );
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap";
const wrap: React.CSSProperties = {
  background: "transparent",
  color: "#16202A",
  fontFamily: "'Nunito', system-ui, sans-serif",
  padding: 0,
};
const empty: React.CSSProperties = {
  background: "#fff",
  border: "1.5px dashed #E5E7EA",
  borderRadius: 16,
  padding: "40px 26px",
  textAlign: "center",
  color: "#7A828C",
};
const h1: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: 900,
  fontSize: 38,
  color: "#16202A",
  margin: "0 0 6px",
};
const btn: React.CSSProperties = {
  display: "inline-block",
  background: "#16202A",
  color: "#F7F8F9",
  padding: "12px 26px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 600,
};
const link: React.CSSProperties = { color: "#6D28D9", fontSize: 14 };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          color: "#A9AFB7",
          fontSize: 11.5,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 3,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{value}</dd>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "2px solid #EDEFF1",
  borderRadius: 20,
  padding: "20px 22px",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 16,
  margin: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#16202A",
  margin: "0 0 14px",
};
