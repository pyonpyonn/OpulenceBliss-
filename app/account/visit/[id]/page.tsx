// One visit, in full — the client's live view.
// Save at: app/account/visit/[id]/page.tsx

import { createClient } from "@/lib/supabase/server";
import { SignedOut } from "../../page";
import CurrentVisit, { type Visit } from "../../CurrentVisit";
import { BookingTools, RateBooking, TipBooking } from "../../BookingTools";
import MessageThread from "@/components/MessageThread";
import { getVisitStatus } from "@/lib/visitStatus";
import ReportNoShow from "../../ReportNoShow";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignedOut area="client" />;

  const { data: row } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, status, address, household_notes, package_id, provider_id, offer_expires_at, packages(name, duration_minutes, price), providers(display_name, rating_avg, rating_count, bio), check_ins(arrived_at, left_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    return (
      <main style={wrap}>
        <link rel="stylesheet" href={FONTS} />
        <div style={{ maxWidth: 620, margin: "0 auto", paddingTop: 60 }}>
          <h1 style={h1}>Visit not found</h1>
          <p style={{ color: "#6e7a70" }}>
            This booking may have been cancelled.
          </p>
          <p style={{ marginTop: 20 }}>
            <a href="/account" style={link}>
              ← My bookings
            </a>
          </p>
        </div>
      </main>
    );
  }

  const status = await getVisitStatus(supabase, row.id);

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("booking_id", id)
    .eq("reviewer", "client")
    .maybeSingle();

  const { data: pays } = await supabase
    .from("payments")
    .select("gross_amount, status, kind")
    .eq("booking_id", id);

  const jobPay = (pays ?? []).find((p) => p.kind !== "tip");
  const tipTotal = (pays ?? [])
    .filter((p) => p.kind === "tip")
    .reduce((s, p) => s + Number(p.gross_amount ?? 0), 0);

  const pkg = one(row.packages as never) as {
    name: string;
    duration_minutes: number | null;
    price: number;
  } | null;
  const prv = one(row.providers as never) as {
    display_name: string | null;
    rating_avg: number | null;
    rating_count: number | null;
    bio: string | null;
  } | null;
  const ci = one(row.check_ins as never) as {
    arrived_at: string | null;
    left_at: string | null;
  } | null;

  const paymentAmount = Number(jobPay?.gross_amount ?? pkg?.price ?? 0);
  const paymentLabel = status?.money.label
    ? `${status.money.label}${
        paymentAmount > 0 ? ` · £${paymentAmount.toFixed(2)}` : ""
      }`
    : paymentAmount > 0
      ? `£${paymentAmount.toFixed(2)}`
      : "Included";

  const visit: Visit = {
    id: row.id,
    status: row.status,
    scheduled_at: row.scheduled_at,
    address: row.address,
    service: pkg?.name ?? "Service",
    durationMinutes: pkg?.duration_minutes ?? null,
    providerName: prv?.display_name ?? null,
    providerRating: prv?.rating_avg ?? null,
    providerRatingCount: prv?.rating_count ?? 0,
    providerBio: prv?.bio ?? null,
    householdNotes: row.household_notes,
    paymentLabel,
    tipTotal,
    arrivedAt: ci?.arrived_at ?? null,
    finishedAt: ci?.left_at ?? null,
  };

  const changeable =
    status?.actions.some(
      (action) => action.kind === "cancel" || action.kind === "reschedule",
    ) ?? false;
  const canRate =
    status?.actions.some((action) => action.kind === "rate") ?? false;
  const canTip =
    status?.actions.some((action) => action.kind === "tip") ?? false;
  return (
    <main style={wrap}>
      <link rel="stylesheet" href={FONTS} />
      <div style={{ maxWidth: 1120, margin: "0 auto", paddingTop: 40 }}>
        <p style={{ margin: "0 0 20px" }}>
          <a href="/account" style={link}>
            ← My bookings
          </a>
        </p>

        <div className="visit-workspace">
          <div className="visit-details">
            <CurrentVisit visit={visit} hideLink detailStatus={status}>
              <ReportNoShow
                bookingId={row.id}
                scheduledAt={row.scheduled_at}
                status={row.status}
                hasArrived={!!ci?.arrived_at}
              />

              {changeable && (
                <div style={inlineSection}>
                  <strong style={inlineTitle}>Manage this booking</strong>
                  <BookingTools id={row.id} postcode={row.address} />
                </div>
              )}

              {(canRate || canTip || reviewRows) && (
                <div style={inlineSection}>
                  <strong style={inlineTitle}>Your review</strong>
                  {(canRate || reviewRows) && (
                    <RateBooking id={row.id} existing={reviewRows ?? null} />
                  )}
                  {canTip && <TipBooking id={row.id} />}
                  <p style={{ margin: "12px 0 0" }}>
                    <a
                      href={`/book?service=${row.package_id ?? ""}&pc=${
                        row.address ?? ""
                      }`}
                      style={{
                        color: "#6D28D9",
                        fontWeight: 800,
                        fontSize: 13.5,
                      }}
                    >
                      Book this again →
                    </a>
                  </p>
                </div>
              )}
            </CurrentVisit>
          </div>

          {row.provider_id && (
            <aside className="visit-chat">
              <MessageThread
                bookingId={row.id}
                viewerRole="customer"
                closed={
                  row.status === "cancelled" ||
                  new Date(row.scheduled_at).getTime() <
                    Date.now() - 7 * 24 * 60 * 60 * 1000
                }
              />
            </aside>
          )}
        </div>
      </div>

      <style>{`
        .visit-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(310px, 370px);
          align-items: start;
          gap: 24px;
        }
        .visit-details {
          min-width: 0;
        }
        .visit-chat {
          min-width: 0;
          position: sticky;
          top: 24px;
        }
        @media (max-width: 1100px) {
          .visit-workspace {
            grid-template-columns: minmax(0, 1fr);
          }
          .visit-chat {
            position: static;
          }
        }
      `}</style>
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
const h1: React.CSSProperties = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 500,
  fontSize: 34,
  color: "#2f4a3a",
  margin: "0 0 8px",
};
const link: React.CSSProperties = { color: "#5b7a65", fontSize: 14 };
const inlineSection: React.CSSProperties = {
  background: "#F7F8F9",
  borderRadius: 14,
  padding: "14px 15px",
  marginTop: 10,
};
const inlineTitle: React.CSSProperties = {
  display: "block",
  color: "#16202A",
  fontSize: 15,
  fontWeight: 900,
};
