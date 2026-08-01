// Provider dashboard — active job first, then offers, schedule, history.
// Save at: app/worker/page.tsx

import { createClient } from "@/lib/supabase/server";
import { SignedOut } from "@/app/account/page";
import AreaNav from "@/components/AreaNav";
import JobActions from "./JobActions";
import JoinButton from "./JoinButton";
import ActiveJob, { type ActiveJobData } from "./ActiveJob";

type Row = {
  id: string;
  scheduled_at: string;
  status: string;
  address: string | null;
  household_notes: string | null;
  customer_email: string | null;
  offer_expires_at?: string | null;
  packages:
    | { name: string; duration_minutes: number | null }
    | { name: string; duration_minutes: number | null }[]
    | null;
  check_ins:
    | { arrived_at: string | null; left_at: string | null; geofence_pass: boolean | null }
    | { arrived_at: string | null; left_at: string | null; geofence_pass: boolean | null }[]
    | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    .select("id, display_name, joining_fee_paid, vetting_status, rating_avg, rating_count")
    .eq("profile_id", user.id)
    .maybeSingle();

  const active = prov?.joining_fee_paid === true;
  const approved = prov?.vetting_status === "approved";

  const { data: rowsData } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, address, household_notes, customer_email, packages(name, duration_minutes), check_ins(arrived_at, left_at, geofence_pass)"
    )
    .order("scheduled_at", { ascending: true });

  const rows = (rowsData ?? []) as unknown as Row[];

  // Open offers broadcast to this provider (first to accept wins)
  let offers: Row[] = [];
  if (prov?.id) {
    const { data: offerRows } = await supabase
      .from("booking_offers")
      .select(
        "booking_id, bookings(id, scheduled_at, status, address, household_notes, customer_email, offer_expires_at, packages(name, duration_minutes), check_ins(arrived_at, left_at, geofence_pass))"
      )
      .eq("provider_id", prov.id)
      .eq("status", "open");

    offers = (offerRows ?? [])
      .map((o) => one(o.bookings as never) as unknown as Row | null)
      .filter(
        (b): b is Row => !!b && b.status === "offered"
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
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
      (p.split_breakdown as { provider?: number } | null)?.provider ?? 0
    );
    earnMap.set(p.booking_id as string, share);
  }

  const toJob = (r: Row): ActiveJobData => {
    const pkg = one(r.packages);
    const ci = one(r.check_ins);
    return {
      id: r.id,
      status: r.status,
      scheduled_at: r.scheduled_at,
      address: r.address,
      notes: r.household_notes,
      client: r.customer_email,
      service: pkg?.name ?? "Service",
      durationMinutes: pkg?.duration_minutes ?? null,
      earns: earnMap.get(r.id) ?? null,
      arrivedAt: ci?.arrived_at ?? null,
      leftAt: ci?.left_at ?? null,
      geofencePass: ci?.geofence_pass ?? null,
    };
  };

  const running = rows.find((r) => r.status === "in_progress");
  const upcoming = rows.filter((r) => r.status === "scheduled");
  const past = rows
    .filter((r) => ["completed", "cancelled", "declined"].includes(r.status))
    .reverse();

  const todayCount = upcoming.filter(
    (r) => new Date(r.scheduled_at).toDateString() === new Date().toDateString()
  ).length;
  const dueTotal = upcoming.reduce((s, r) => s + (earnMap.get(r.id) ?? 0), 0);

  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 780, margin: "0 auto", paddingTop: 40 }}>
        <p style={eyebrow}>Provider area</p>
        <h1 style={h1}>
          {prov?.display_name ? `Hello, ${prov.display_name.split(" ")[0]}` : "Your jobs"}
        </h1>
        <p style={{ color: "#6e7a70", margin: "0 0 26px" }}>
          {user.email}
          {prov?.rating_avg
            ? ` · ${Number(prov.rating_avg).toFixed(1)}★ (${prov.rating_count})`
            : ""}
        </p>

        <AreaNav area="provider" />

        {/* ---- Gates ---- */}
        {!prov && (
          <Gate
            tag="No provider profile"
            title="You're not registered as a provider yet"
            body="Register to start receiving jobs. It takes a couple of minutes and a one-off £150 joining fee."
          >
            <a href="/provider/join" style={{ ...btn, background: "#cf854f" }}>
              Register as a provider
            </a>
          </Gate>
        )}

        {prov && !active && (
          <Gate
            tag="Account not active"
            title="One step before you can work"
            body="A one-off £150 joining fee activates your account. Paid once — not a subscription. After that you keep your full agreed rate on every job."
          >
            <JoinButton />
          </Gate>
        )}

        {prov && active && !approved && (
          <Gate
            tag={
              prov.vetting_status === "rejected"
                ? "Application declined"
                : "Awaiting approval"
            }
            title={
              prov.vetting_status === "rejected"
                ? "We couldn't approve your account"
                : "We're reviewing your application"
            }
            body={
              prov.vetting_status === "rejected"
                ? "Please get in touch if you think this is a mistake."
                : "Your fee is paid and your details are with our team. Jobs arrive as soon as you're approved. Meanwhile, set your availability and fill in your profile."
            }
          />
        )}

        {/* ---- 1. Happening now ---- */}
        {running && active && (
          <>
            <h2 style={sectionTitle}>Happening now</h2>
            <div style={{ marginBottom: 34 }}>
              <ActiveJob job={toJob(running)} compact />
            </div>
          </>
        )}

        {/* ---- Summary ---- */}
        {active && approved && (
          <div style={statGrid}>
            <Stat label="Jobs today" value={String(todayCount)} />
            <Stat label="New offers" value={String(offers.length)} />
            <Stat label="Coming up" value={String(upcoming.length)} />
            <Stat label="Due to you" value={`£${dueTotal.toFixed(2)}`} />
          </div>
        )}

        {/* ---- 2. New offers ---- */}
        <h2 style={sectionTitle}>
          New offers{offers.length > 0 ? ` (${offers.length})` : ""}
        </h2>
        {offers.length === 0 ? (
          <p style={{ color: "#6e7a70", margin: "0 0 34px" }}>
            Nothing waiting right now.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16, marginBottom: 34 }}>
            {offers.map((r) => {
              const pkg = one(r.packages);
              const earns = earnMap.get(r.id);
              return (
                <article key={r.id} style={{ ...card, borderColor: "#e6c4b0" }}>
                  <div style={rowHead}>
                    <h3 style={cardTitle}>{pkg?.name ?? "Service"}</h3>
                    <span
                      style={{ ...badge, background: "#f6e7dd", color: "#8a4b26" }}
                    >
                      {timeLeft(r.offer_expires_at) ?? "New offer"}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "-6px 0 14px",
                      fontSize: 13,
                      color: "#6e7a70",
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
                    <JobActions id={r.id} status={r.status} />
                  ) : (
                    <p style={{ marginTop: 14, color: "#8a4b26", fontSize: 14 }}>
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
          <p style={{ color: "#6e7a70", margin: "0 0 34px" }}>
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
                      style={{ ...badge, background: "#e7eee7", color: "#2f4a3a" }}
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
                  <p style={{ margin: "12px 0 0" }}>
                    <a
                      href={`/worker/job/${r.id}`}
                      style={{ color: "#2f4a3a", fontWeight: 600, fontSize: 13.5 }}
                    >
                      Open job →
                    </a>
                  </p>
                </article>
              );
            })}
          </div>
        )}

        {/* ---- 4. History ---- */}
        <h2 style={sectionTitle}>Recent history</h2>
        {past.length === 0 ? (
          <p style={{ color: "#6e7a70" }}>Nothing yet.</p>
        ) : (
          <div style={{ ...card, padding: "6px 22px" }}>
            {past.slice(0, 12).map((r) => {
              const pkg = one(r.packages);
              return (
                <div
                  key={r.id}
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
                    <strong style={{ fontSize: 14.5, color: "#2f4a3a" }}>
                      {pkg?.name ?? "Service"}
                    </strong>
                    <div style={{ color: "#6e7a70", fontSize: 13 }}>
                      {when(r.scheduled_at)} · {r.status}
                    </div>
                  </div>
                  <a
                    href={`/worker/job/${r.id}`}
                    style={{ color: "#5b7a65", fontSize: 13.5 }}
                  >
                    Details
                  </a>
                </div>
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
          fontFamily: "'Fraunces', serif",
          fontSize: 25,
          color: "#2f4a3a",
          margin: "0 0 2px",
        }}
      >
        {value}
      </p>
      <span style={{ color: "#6e7a70", fontSize: 13 }}>{label}</span>
    </div>
  );
}

function Gate({
  tag,
  title,
  body,
  children,
}: {
  tag: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #e6c4b0",
        borderRadius: 16,
        padding: "24px 26px",
        marginBottom: 32,
      }}
    >
      <p
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontSize: 11.5,
          fontWeight: 600,
          color: "#cf854f",
          margin: "0 0 8px",
        }}
      >
        {tag}
      </p>
      <h2 style={{ ...sectionTitle, margin: "0 0 8px" }}>{title}</h2>
      <p style={{ color: "#6e7a70", margin: children ? "0 0 18px" : 0, fontSize: 15 }}>
        {body}
      </p>
      {children}
    </div>
  );
}

/* ---------- styles ---------- */

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
  padding: "22px 24px",
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
const notesBox: React.CSSProperties = {
  background: "#fbf7f0",
  borderRadius: 12,
  padding: "12px 14px",
  marginTop: 16,
};
const notesH: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#a89f90",
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
const cardTitle: React.CSSProperties = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 500,
  fontSize: 21,
  color: "#2f4a3a",
  margin: 0,
};
const badge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 999,
  whiteSpace: "nowrap",
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