// Provider dashboard — active job first, then offers, schedule, history.
// Save at: app/worker/page.tsx

import { createClient } from "@/lib/supabase/server";
import { SignedOut } from "@/app/account/page";
import VisitHistoryCard from "@/components/VisitHistoryCard";
import JobActions from "./JobActions";

type Row = {
  id: string;
  scheduled_at: string;
  status: string;
  address: string | null;
  household_notes: string | null;
  customer_email: string | null;
  offer_expires_at?: string | null;
  provider_payout?: number | null;
  packages:
    | { name: string; duration_minutes: number | null }
    | { name: string; duration_minutes: number | null }[]
    | null;
  check_ins:
    | {
        arrived_at: string | null;
        left_at: string | null;
        geofence_pass: boolean | null;
      }
    | {
        arrived_at: string | null;
        left_at: string | null;
        geofence_pass: boolean | null;
      }[]
    | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function clock(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function elapsed(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  if (!start || !end) return null;
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

function timeLeft(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expiring";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.floor(hrs / 24)}d left`;
}

export default async function WorkerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignedOut area="provider" />;

  const { data: prov } = await supabase
    .from("providers")
    .select(
      "id, display_name, joining_fee_paid, vetting_status, rating_avg, rating_count",
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  const active = prov?.joining_fee_paid === true;
  const approved = prov?.vetting_status === "approved";

  const { data: rowsData } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, address, household_notes, customer_email, provider_payout, packages(name, duration_minutes), check_ins(arrived_at, left_at, geofence_pass)",
    )
    .order("scheduled_at", { ascending: true });

  const rows = (rowsData ?? []) as unknown as Row[];

  // Open offers broadcast to this provider (first to accept wins)
  let offers: Row[] = [];
  if (prov?.id) {
    const { data: offerRows } = await supabase
      .from("booking_offers")
      .select(
        "booking_id, bookings(id, scheduled_at, status, address, household_notes, customer_email, offer_expires_at, provider_payout, packages(name, duration_minutes), check_ins(arrived_at, left_at, geofence_pass))",
      )
      .eq("provider_id", prov.id)
      .eq("status", "open");

    offers = (offerRows ?? [])
      .map((o) => one(o.bookings as never) as unknown as Row | null)
      .filter((b): b is Row => !!b && b.status === "offered")
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      );
  }

  // Earnings per booking, so the card can show what each job pays
  const { data: paysData } = await supabase
    .from("payments")
    .select("booking_id, split_breakdown, kind");
  const earnMap = new Map<string, number>();
  for (const p of paysData ?? []) {
    if (p.kind === "tip" || !p.booking_id) continue;
    const share = Number(
      (p.split_breakdown as { provider?: number } | null)?.provider ?? 0,
    );
    earnMap.set(p.booking_id as string, share);
  }
  // Membership visits carry their payout on the booking itself.
  for (const r of [...rows, ...offers]) {
    const own = (r as unknown as { provider_payout?: number | null })
      .provider_payout;
    if (own !== null && own !== undefined) {
      earnMap.set(r.id, Number(own));
    }
  }

  const running = rows.find((r) => r.status === "in_progress");
  const upcoming = rows.filter((r) => r.status === "scheduled");
  const past = rows
    .filter((r) => ["completed", "cancelled", "declined"].includes(r.status))
    .reverse();

  // What clients said about finished work
  const pastIds = rows.filter((r) => r.status === "completed").map((r) => r.id);
  const clientReviewMap = new Map<
    string,
    { rating: number; comment: string | null }
  >();
  const providerReviewMap = new Map<
    string,
    { rating: number; comment: string | null }
  >();
  if (pastIds.length) {
    const { data: revs } = await supabase
      .from("reviews")
      .select("booking_id, reviewer, rating, comment")
      .in("booking_id", pastIds);
    for (const r of revs ?? []) {
      const target =
        r.reviewer === "provider" ? providerReviewMap : clientReviewMap;
      target.set(r.booking_id as string, {
        rating: r.rating as number,
        comment: (r.comment as string | null) ?? null,
      });
    }
  }

  const todayCount = upcoming.filter(
    (r) =>
      new Date(r.scheduled_at).toDateString() === new Date().toDateString(),
  ).length;
  const dueTotal = upcoming.reduce((s, r) => s + (earnMap.get(r.id) ?? 0), 0);

  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 780 }}>
        <h1 style={h1}>Jobs</h1>

        {/* ---- Summary, straight at the top ---- */}
        {active && approved && (
          <div style={statGrid}>
            <Stat label="Jobs today" value={String(todayCount)} />
            <Stat label="New offers" value={String(offers.length)} />
            <Stat label="Coming up" value={String(upcoming.length)} />
            <Stat label="Due to you" value={`£${dueTotal.toFixed(2)}`} />
          </div>
        )}

        {/* ---- In progress: short view only ---- */}
        {running && active && (
          <a href={`/worker/current`} style={liveStrip}>
            <span style={liveDot} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={liveTitle}>
                {one(running.packages)?.name ?? "Service"} — in progress
              </strong>
              <span style={liveMeta}>
                {running.customer_email ?? "Client"}
                {running.address ? ` · ${running.address}` : ""}
              </span>
            </span>
            <span style={liveGo}>Open →</span>
          </a>
        )}

        {/* ---- 2. New offers ---- */}
        <h2 style={sectionTitle}>
          New offers{offers.length > 0 ? ` (${offers.length})` : ""}
        </h2>
        {offers.length === 0 ? (
          <p style={{ color: "#7A828C", margin: "0 0 34px" }}>
            Nothing waiting right now.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16, marginBottom: 34 }}>
            {offers.map((r) => {
              const pkg = one(r.packages);
              const earns = earnMap.get(r.id);
              return (
                <article key={r.id} style={{ ...card, borderColor: "#F3CBD4" }}>
                  <div style={rowHead}>
                    <h3 style={cardTitle}>{pkg?.name ?? "Service"}</h3>
                    <span
                      style={{
                        ...badge,
                        background: "#FFE6EA",
                        color: "#B0384F",
                      }}
                    >
                      {timeLeft(r.offer_expires_at) ?? "New offer"}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "-6px 0 14px",
                      fontSize: 13,
                      color: "#7A828C",
                    }}
                  >
                    Offered to several providers — first to accept gets it.
                  </p>
                  <Facts
                    client={r.customer_email}
                    address={r.address}
                    time={when(r.scheduled_at)}
                    earns={earns}
                    notes={r.household_notes}
                  />
                  {active ? (
                    <JobActions
                      id={r.id}
                      status={r.status}
                      scheduledAt={r.scheduled_at}
                    />
                  ) : (
                    <p
                      style={{ marginTop: 14, color: "#B0384F", fontSize: 14 }}
                    >
                      Pay the joining fee above to accept this job.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* ---- 3. Coming up ---- */}
        <h2 style={sectionTitle}>Coming up</h2>
        {upcoming.length === 0 ? (
          <p style={{ color: "#7A828C", margin: "0 0 34px" }}>
            Nothing scheduled. Check your availability is up to date.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14, marginBottom: 34 }}>
            {upcoming.map((r) => {
              const pkg = one(r.packages);
              return (
                <article key={r.id} style={card}>
                  <div style={rowHead}>
                    <h3 style={cardTitle}>{pkg?.name ?? "Service"}</h3>
                    <span
                      style={{
                        ...badge,
                        background: "#F4ECFE",
                        color: "#16202A",
                      }}
                    >
                      Confirmed
                    </span>
                  </div>
                  <Facts
                    client={r.customer_email}
                    address={r.address}
                    time={when(r.scheduled_at)}
                    earns={earnMap.get(r.id)}
                    notes={r.household_notes}
                  />
                  {active && (
                    <JobActions
                      id={r.id}
                      status={r.status}
                      scheduledAt={r.scheduled_at}
                    />
                  )}
                  <p style={{ margin: "14px 0 0" }}>
                    <a
                      href={`/worker/job/${r.id}`}
                      style={{
                        color: "#6D28D9",
                        fontSize: 13.5,
                        fontWeight: 800,
                      }}
                    >
                      Open full job &amp; messages →
                    </a>
                  </p>
                </article>
              );
            })}
          </div>
        )}

        {/* ---- 4. History ---- */}
        <h2 style={sectionTitle}>Past work</h2>
        {past.length === 0 ? (
          <p style={{ color: "#7A828C" }}>Nothing yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {past.slice(0, 12).map((r) => {
              const pkg = one(r.packages);
              const ci = one(r.check_ins);
              const clientReview = clientReviewMap.get(r.id);
              const providerReview = providerReviewMap.get(r.id);
              const actualDuration = elapsed(ci?.arrived_at, ci?.left_at);
              const completed = r.status === "completed";
              return (
                <VisitHistoryCard
                  key={r.id}
                  title={pkg?.name ?? "Service"}
                  when={when(r.scheduled_at)}
                  status={
                    completed
                      ? "Completed"
                      : r.status === "cancelled"
                        ? "Cancelled"
                        : "Declined"
                  }
                  statusTone={completed ? "good" : "neutral"}
                  rating={
                    completed
                      ? {
                          label: "Client's rating of your work",
                          rating: clientReview?.rating ?? null,
                          comment: clientReview?.comment ?? null,
                          pending: "Waiting for the client’s rating",
                        }
                      : null
                  }
                  secondaryRating={
                    completed
                      ? {
                          label: "Your rating of the client",
                          rating: providerReview?.rating ?? null,
                          comment: providerReview?.comment ?? null,
                          pending: "You still need to rate this client",
                        }
                      : null
                  }
                  facts={[
                    { label: "Client", value: r.customer_email ?? "—" },
                    { label: "Address", value: r.address ?? "—" },
                    {
                      label: "Duration",
                      value:
                        actualDuration ??
                        (pkg?.duration_minutes
                          ? `${pkg.duration_minutes} minutes planned`
                          : "—"),
                    },
                    {
                      label: "Check-in / checkout",
                      value: ci?.arrived_at
                        ? `${clock(ci.arrived_at)} – ${clock(ci.left_at)}`
                        : "No check-in recorded",
                    },
                    {
                      label: "You earned",
                      value: earnMap.has(r.id)
                        ? `£${(earnMap.get(r.id) ?? 0).toFixed(2)}`
                        : "—",
                    },
                    {
                      label: "Location",
                      value:
                        ci?.geofence_pass === true
                          ? "Verified at check-in"
                          : ci?.geofence_pass === false
                            ? "Check-in was flagged"
                            : "Not recorded",
                    },
                  ]}
                >
                  {r.household_notes && (
                    <p
                      style={{
                        color: "#4B5563",
                        fontSize: 13.5,
                        margin: "0 0 12px",
                      }}
                    >
                      <strong>Client notes:</strong> {r.household_notes}
                    </p>
                  )}
                  {completed && !providerReview && (
                    <JobActions
                      id={r.id}
                      status={r.status}
                      scheduledAt={r.scheduled_at}
                      existingRating={null}
                    />
                  )}
                  <p style={{ margin: "12px 0 0" }}>
                    <a
                      href={`/worker/job/${r.id}`}
                      style={{
                        color: "#6D28D9",
                        fontSize: 13.5,
                        fontWeight: 800,
                      }}
                    >
                      Open full job details →
                    </a>
                  </p>
                </VisitHistoryCard>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------- small pieces ---------- */

function Facts({
  client,
  address,
  time,
  earns,
  notes,
}: {
  client: string | null;
  address: string | null;
  time: string;
  earns?: number;
  notes: string | null;
}) {
  return (
    <>
      <dl style={factGrid}>
        <Fact label="Client" value={client ?? "—"} />
        <Fact label="Address" value={address ?? "—"} />
        <Fact label="When" value={time} />
        <Fact
          label="You earn"
          value={earns !== undefined ? `£${earns.toFixed(2)}` : "—"}
        />
      </dl>
      {notes && (
        <div style={notesBox}>
          <p style={notesH}>Client&apos;s notes</p>
          <p style={{ margin: 0, fontSize: 14 }}>{notes}</p>
        </div>
      )}
    </>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, padding: "18px 20px" }}>
      <p
        style={{
          fontFamily: "'Nunito', system-ui, sans-serif",
          fontSize: 25,
          color: "#16202A",
          margin: "0 0 2px",
        }}
      >
        {value}
      </p>
      <span style={{ color: "#7A828C", fontSize: 13 }}>{label}</span>
    </div>
  );
}

/* ---------- styles ---------- */

const FONTS =
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap";
const wrap: React.CSSProperties = {
  background: "transparent",
  color: "#16202A",
  fontFamily: "'Nunito', system-ui, sans-serif",
  padding: 0,
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #EDEFF1",
  borderRadius: 16,
  padding: "22px 24px",
};
const liveStrip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: "#F7F3FF",
  border: "2px solid #E3D6FB",
  borderRadius: 16,
  padding: "14px 16px",
  marginBottom: 30,
  textDecoration: "none",
  color: "#16202A",
};
const liveDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#6D28D9",
  flexShrink: 0,
};
const liveTitle: React.CSSProperties = {
  display: "block",
  fontSize: 15.5,
  fontWeight: 900,
};
const liveMeta: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#7A828C",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const liveGo: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 900,
  color: "#6D28D9",
  whiteSpace: "nowrap",
};
const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 34,
};
const rowHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};
const factGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 14,
  margin: 0,
};
const dt: React.CSSProperties = {
  color: "#A9AFB7",
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 3,
};
const dd: React.CSSProperties = {
  margin: 0,
  color: "#16202A",
  fontSize: 14.5,
  fontWeight: 900,
};
const notesBox: React.CSSProperties = {
  background: "transparent",
  borderRadius: 12,
  padding: "12px 14px",
  marginTop: 16,
};
const notesH: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#A9AFB7",
};
const h1: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: 900,
  fontSize: 38,
  color: "#16202A",
  margin: "0 0 6px",
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: 900,
  fontSize: 22,
  color: "#16202A",
  margin: "0 0 14px",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontWeight: 900,
  fontSize: 21,
  color: "#16202A",
  margin: 0,
};
const badge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};
