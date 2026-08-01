// Client dashboard — current visit, upcoming, history.
// Save at: app/account/page.tsx

import { createClient } from "@/lib/supabase/server";
import AreaNav from "@/components/AreaNav";
import MembershipCard, { type Membership } from "./MembershipCard";
import CurrentVisit, { type Visit } from "./CurrentVisit";
import { BookingTools, RateBooking, TipBooking } from "./BookingTools";

type Row = {
  id: string;
  scheduled_at: string;
  status: string;
  address: string | null;
  package_id: string | null;
  packages:
    | { name: string; duration_minutes: number | null }
    | { name: string; duration_minutes: number | null }[]
    | null;
  providers:
    | { display_name: string | null; rating_avg: number | null }
    | { display_name: string | null; rating_avg: number | null }[]
    | null;
  check_ins:
    | { arrived_at: string | null }
    | { arrived_at: string | null }[]
    | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

const LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  offered: { text: "Matching your provider", bg: "#f6e7dd", fg: "#8a4b26" },
  declined: { text: "Finding someone else", bg: "#f6e7dd", fg: "#8a4b26" },
  scheduled: { text: "Confirmed", bg: "#e7eee7", fg: "#2f4a3a" },
  in_progress: { text: "In progress", bg: "#dbe7f0", fg: "#28506e" },
  completed: { text: "Completed", bg: "#e7eee7", fg: "#2f4a3a" },
  cancelled: { text: "Cancelled", bg: "#efe7e7", fg: "#7a3b3b" },
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const { subscribed } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignedOut area="client" />;

  const { data: me } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role === "admin") return <WrongArea role="admin" />;
  if (me?.role === "provider") return <WrongArea role="provider" />;

  const { data: rowsData } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, address, package_id, packages(name, duration_minutes), providers(display_name, rating_avg), check_ins(arrived_at)"
    )
    .order("scheduled_at", { ascending: false });

  const rows = (rowsData ?? []) as unknown as Row[];

  // Membership, if they have one
  const { data: sub } = await supabase
    .from("subscriptions")
    .select(
      "id, status, start_date, contract_length_months, cycles_billed, current_period_end, preferred_weekday, preferred_hour, postcode, paused_until, packages(name, price, visits_per_month)"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let membership: Membership | null = null;
  if (sub) {
    const mp = one(sub.packages as never) as {
      name: string;
      price: number;
      visits_per_month: number | null;
    } | null;
    membership = {
      id: sub.id,
      planName: mp?.name ?? "Membership",
      price: Number(mp?.price ?? 0),
      status: sub.paused_until ? "paused" : sub.status,
      startDate: sub.start_date,
      contractMonths: sub.contract_length_months ?? 3,
      cyclesBilled: sub.cycles_billed ?? 0,
      nextBill: sub.current_period_end,
      weekday: sub.preferred_weekday,
      hour: sub.preferred_hour,
      postcode: sub.postcode,
      visitsThisCycle: rows.filter(
        (r) =>
          ["offered", "declined", "scheduled", "in_progress"].includes(r.status)
      ).length,
      visitsPerMonth: mp?.visits_per_month ?? null,
      pausedUntil: sub.paused_until,
    };
  }

  const { data: reviewData } = await supabase
    .from("reviews")
    .select("booking_id, rating, comment, reviewer")
    .eq("reviewer", "client");
  const reviews = new Map(
    (reviewData ?? []).map((r) => [
      r.booking_id as string,
      { rating: r.rating as number, comment: r.comment as string | null },
    ])
  );

  // Which one is "current"? In progress wins, then soonest upcoming.
  const active = rows.find((r) => r.status === "in_progress");
  const upcoming = rows
    .filter((r) => ["offered", "declined", "scheduled"].includes(r.status))
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  const history = rows.filter((r) =>
    ["completed", "cancelled"].includes(r.status)
  );

  const featured = active ?? upcoming[0] ?? history[0] ?? null;

  const toVisit = (r: Row): Visit => {
    const pkg = one(r.packages);
    const prv = one(r.providers);
    const ci = one(r.check_ins);
    return {
      id: r.id,
      status: r.status,
      scheduled_at: r.scheduled_at,
      address: r.address,
      service: pkg?.name ?? "Service",
      durationMinutes: pkg?.duration_minutes ?? null,
      providerName: prv?.display_name ?? null,
      providerRating: prv?.rating_avg ?? null,
      arrivedAt: ci?.arrived_at ?? null,
    };
  };

  const rest = upcoming.filter((r) => r.id !== featured?.id);

  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 40 }}>
        <p style={eyebrow}>Your account</p>
        <h1 style={h1}>
          {me?.full_name ? `Welcome back, ${me.full_name.split(" ")[0]}` : "Welcome back"}
        </h1>
        <p style={{ color: "#6e7a70", margin: "0 0 26px" }}>{user.email}</p>

        <AreaNav area="client" />

        {subscribed && (
          <div
            style={{
              background: "#e7eee7",
              border: "1.5px solid #7fa08c",
              borderRadius: 14,
              padding: "18px 20px",
              marginBottom: 22,
            }}
          >
            <strong style={{ color: "#2f4a3a", fontSize: 16 }}>
              Your membership is active
            </strong>
            <p style={{ margin: "4px 0 0", color: "#4a544c", fontSize: 14.5 }}>
              Your first payment has gone through and this month&apos;s visits
              are being matched with providers now.
            </p>
          </div>
        )}

        {membership && <MembershipCard m={membership} compact />}

        {!membership && (
          <div
            style={{
              ...card,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 26,
            }}
          >
            <div>
              <strong style={{ color: "#2f4a3a", fontSize: 15.5 }}>
                Want your visits handled automatically?
              </strong>
              <p style={{ margin: "3px 0 0", color: "#6e7a70", fontSize: 14 }}>
                A membership schedules them for you and keeps the same team.
              </p>
            </div>
            <a href="/subscribe" style={{ ...btn, whiteSpace: "nowrap" }}>
              See memberships
            </a>
          </div>
        )}

        {featured ? (
          <CurrentVisit visit={toVisit(featured)} />
        ) : (
          <div style={{ ...card, textAlign: "center", padding: "38px 26px" }}>
            <h2 style={{ ...sectionTitle, margin: "0 0 8px" }}>
              No visits booked
            </h2>
            <p style={{ color: "#6e7a70", margin: "0 0 20px" }}>
              Pay per visit — no membership, no lock-in.
            </p>
            <a href="/book" style={btn}>
              Book a service
            </a>
          </div>
        )}

        {/* Upcoming */}
        {rest.length > 0 && (
          <>
            <h2 style={sectionTitle}>Also coming up</h2>
            <div style={{ display: "grid", gap: 14, marginBottom: 34 }}>
              {rest.map((b) => {
                const pkg = one(b.packages);
                const st = LABEL[b.status] ?? LABEL.scheduled;
                return (
                  <article key={b.id} style={card}>
                    <div style={rowHead}>
                      <h3 style={cardTitle}>{pkg?.name ?? "Service"}</h3>
                      <span style={{ ...badge, background: st.bg, color: st.fg }}>
                        {st.text}
                      </span>
                    </div>
                    <p style={meta}>
                      {when(b.scheduled_at)}
                      {b.address ? ` · ${b.address}` : ""}
                    </p>
                    <BookingTools id={b.id} postcode={b.address} />
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* Featured upcoming still needs its controls */}
        {featured && ["offered", "declined", "scheduled"].includes(featured.status) && (
          <div style={{ ...card, marginBottom: 34 }}>
            <h3 style={{ ...cardTitle, marginBottom: 4 }}>Need to change it?</h3>
            <p style={{ ...meta, marginBottom: 0 }}>
              Free to cancel — your card hasn&apos;t been charged.
            </p>
            <BookingTools id={featured.id} postcode={featured.address} />
          </div>
        )}

        {/* History */}
        <h2 style={sectionTitle}>Past visits</h2>
        {history.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#6e7a70" }}>
            Nothing yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {history.map((b) => {
              const pkg = one(b.packages);
              const prv = one(b.providers);
              const st = LABEL[b.status] ?? LABEL.completed;
              return (
                <article key={b.id} style={card}>
                  <div style={rowHead}>
                    <h3 style={cardTitle}>{pkg?.name ?? "Service"}</h3>
                    <span style={{ ...badge, background: st.bg, color: st.fg }}>
                      {st.text}
                    </span>
                  </div>
                  <p style={meta}>
                    {when(b.scheduled_at)}
                    {prv?.display_name ? ` · ${prv.display_name}` : ""}
                  </p>

                  {b.status === "completed" && (
                    <>
                      <RateBooking id={b.id} existing={reviews.get(b.id)} />
                      <TipBooking id={b.id} />
                      <p style={{ margin: "12px 0 0" }}>
                        <a
                          href={`/book?service=${b.package_id ?? ""}&pc=${
                            b.address ?? ""
                          }`}
                          style={{
                            color: "#2f4a3a",
                            fontWeight: 600,
                            fontSize: 13.5,
                          }}
                        >
                          Book this again →
                        </a>
                      </p>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------- Shared notices (imported by other pages) ---------- */

export function SignedOut({ area }: { area: "client" | "provider" }) {
  const isClient = area === "client";
  return (
    <Notice
      eyebrowText={isClient ? "Client area" : "Provider area"}
      title="Please log in"
      body={
        isClient
          ? "Log in to see your visits and bookings."
          : "Log in to see the jobs assigned to you."
      }
      href="/login"
      cta="Go to log in"
    />
  );
}

export function WrongArea({ role }: { role: "admin" | "provider" }) {
  const isAdmin = role === "admin";
  return (
    <Notice
      eyebrowText={isAdmin ? "Admin account" : "Provider account"}
      title="This is the client area"
      body={
        isAdmin
          ? "You're signed in as an admin. Your tools are in the control panel."
          : "You're signed in as a provider. Your jobs are in the provider area."
      }
      href={isAdmin ? "/admin" : "/worker"}
      cta={isAdmin ? "Go to control panel" : "Go to my jobs"}
    />
  );
}

function Notice({
  eyebrowText,
  title,
  body,
  href,
  cta,
}: {
  eyebrowText: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <main style={{ ...wrap, display: "grid", placeItems: "center" }}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ ...card, maxWidth: 440, textAlign: "center" }}>
        <p style={eyebrow}>{eyebrowText}</p>
        <h1 style={{ ...h1, fontSize: 27 }}>{title}</h1>
        <p style={{ color: "#6e7a70", margin: "0 0 24px" }}>{body}</p>
        <a href={href} style={btn}>
          {cta}
        </a>
        <p style={{ marginTop: 20 }}>
          <a href="/" style={{ color: "#5b7a65", fontSize: 14 }}>
            ← Back to site
          </a>
        </p>
      </div>
    </main>
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
const rowHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 8,
};
const meta: React.CSSProperties = {
  margin: "0 0 4px",
  color: "#6e7a70",
  fontSize: 14,
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