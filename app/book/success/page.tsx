// Payment success + split proof + saves the booking to Supabase.
// Save at: app/book/success/page.tsx
// Needs in .env.local: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL,
//   SUPABASE_SERVICE_ROLE_KEY

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const gbp = (pence: number) => "£" + (pence / 100).toFixed(2);

// Service-role client — SERVER ONLY. Bypasses RLS for trusted writes.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function Success({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Who's booking? (they're logged in — /book requires login)
  const ssr = await createServerClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();

  let total = 0;
  let platform = 0;
  let provider = 0;
  let name = "";
  let ok = false;
  let saved = false;

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["payment_intent"],
      });
      const pi = session.payment_intent as Stripe.PaymentIntent;
      const m = pi.metadata ?? {};

      ok = pi.status === "requires_capture" || pi.status === "succeeded";
      const captured = pi.status === "succeeded";
      total = pi.amount;
      platform = pi.application_fee_amount ?? 0;
      provider = total - platform;
      name = (m.package as string) || "";

      if (ok) {
        // Idempotent — only record this payment once.
        const { data: existing } = await admin
          .from("payments")
          .select("id")
          .eq("stripe_payment_ref", pi.id)
          .maybeSingle();

        if (existing) {
          saved = true;
        } else {
          const email = session.customer_details?.email ?? null;
          const packageId = (m.package_id as string) || null;
          const postcode = (m.postcode as string) || null;
          const request = (m.request as string) || null;
          const slot = (m.slot as string) || null;

          // ---- Matching: who can actually do this job? ----
          // Must be approved, have PAID the £150 joining fee, offer this
          // service type, and cover this postcode.
          const { data: pkgRow } = await admin
            .from("packages")
            .select("service_type")
            .eq("id", packageId ?? "")
            .maybeSingle();
          const serviceType = pkgRow?.service_type ?? null;

          const out = (postcode ?? "").toUpperCase().replace(/\s+/g, "");
          const district =
            out.length > 4 ? out.slice(0, out.length - 3) : out;

          const { data: allAreas } = await admin
            .from("service_areas")
            .select("id, postcode_prefixes")
            .eq("active", true);
          const areaIds = (allAreas ?? [])
            .filter((a) => (a.postcode_prefixes ?? []).includes(district))
            .map((a) => a.id);

          let candidateIds: string[] = [];
          if (areaIds.length) {
            const { data: links } = await admin
              .from("provider_service_areas")
              .select("provider_id")
              .in("service_area_id", areaIds);
            candidateIds = [...new Set((links ?? []).map((l) => l.provider_id))];
          }

          // Everyone who could do this job — the offer goes to all of them.
          let matched: { id: string; profile_id: string }[] = [];
          if (candidateIds.length) {
            let pq = admin
              .from("providers")
              .select("id, profile_id")
              .in("id", candidateIds)
              .eq("vetting_status", "approved")
              .eq("joining_fee_paid", true);
            if (serviceType) pq = pq.contains("services", [serviceType]);
            const { data } = await pq;
            matched = data ?? [];
          }

          // Booking
          // Offers stay open until 2 hours before the visit.
          const slotTime = slot ? new Date(slot) : new Date();
          const expires = new Date(slotTime.getTime() - 2 * 60 * 60 * 1000);

          const { data: booking } = await admin
            .from("bookings")
            .insert({
              customer_id: user?.id ?? null,
              provider_id: null, // nobody yet — it's on offer
              package_id: packageId,
              scheduled_at: slot ?? new Date().toISOString(),
              status: "offered",
              address: postcode,
              customer_email: user?.email ?? email,
              household_notes: request,
              offer_expires_at: expires.toISOString(),
            })
            .select("id")
            .single();

          // Send the offer to everyone who matches.
          if (booking?.id && matched.length) {
            await admin.from("booking_offers").insert(
              matched.map((m) => ({
                booking_id: booking.id,
                provider_id: m.id,
                status: "open",
              }))
            );
          }

          // Payment (with the split breakdown)
          await admin.from("payments").insert({
            booking_id: booking?.id ?? null,
            gross_amount: total / 100,
            split_breakdown: {
              provider: provider / 100,
              platform_margin: platform / 100,
            },
            stripe_payment_ref: pi.id,
            status: captured ? "succeeded" : "pending",
          });

          // ---- Tell everyone ----
          if (matched.length) {
            await admin.from("notifications").insert(
              matched.map((m) => ({
                user_id: m.profile_id,
                title: "New job offer",
                body: `${name} in ${postcode ?? "your area"} — first to accept gets it.`,
                href: "/worker",
              }))
            );
          }
          if (user?.id) {
            await admin.from("notifications").insert({
              user_id: user.id,
              title: matched.length ? "Booking received" : "Looking for a provider",
              body: matched.length
                ? `${name} — sent to ${matched.length} available provider${
                    matched.length === 1 ? "" : "s"
                  }. We'll confirm shortly.`
                : `${name} — no provider is free then. We'll keep looking and cancel free of charge if we can't fill it.`,
              href: "/account",
            });
          }

          saved = true;
        }
      }
    } catch {
      ok = false;
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fbf7f0",
        color: "#26302a",
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Hanken+Grotesk:wght@400;600&display=swap"
      />
      <div
        style={{
          background: "#fff",
          border: "1px solid #ece5d8",
          borderRadius: 18,
          padding: "40px 36px",
          maxWidth: 460,
          width: "100%",
        }}
      >
        <p
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            fontSize: 12,
            fontWeight: 600,
            color: "#cf854f",
            margin: "0 0 8px",
          }}
        >
          {ok ? "Payment authorised" : "Payment status"}
        </p>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 500,
            fontSize: 30,
            color: "#2f4a3a",
            margin: "0 0 6px",
          }}
        >
          {ok ? "You're booked" : "Couldn't confirm payment"}
        </h1>
        <p style={{ color: "#6e7a70", margin: "0 0 24px" }}>
          {ok
            ? `${name} — your card is held, not charged. You'll only be charged once the visit is complete.`
            : "Check the Stripe test dashboard for details."}
        </p>

        {ok && (
          <dl style={{ margin: 0 }}>
            {[
              ["Total", gbp(total)],
              ["Provider will receive", gbp(provider)],
              ["Platform keeps (margin)", gbp(platform)],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: "1px solid #f0ebe0",
                }}
              >
                <dt style={{ color: "#6e7a70", fontSize: 14 }}>{k}</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {ok && (
          <p
            style={{
              marginTop: 20,
              padding: "12px 14px",
              borderRadius: 10,
              background: saved ? "#e7eee7" : "#f6e7dd",
              color: saved ? "#2f4a3a" : "#8a4b26",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {saved
              ? "✓ Booking saved to Supabase"
              : "Booking not saved — check SUPABASE_SERVICE_ROLE_KEY"}
          </p>
        )}

        <a
          href="/book"
          style={{
            display: "inline-block",
            marginTop: 24,
            color: "#5b7a65",
            fontSize: 14,
          }}
        >
          ← Back to booking
        </a>
      </div>
    </main>
  );
}