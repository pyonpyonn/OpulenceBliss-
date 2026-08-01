// Tip confirmation. Save at: app/account/tip/success/page.tsx

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function TipSuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let ok = false;
  let amount = 0;

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["payment_intent"],
      });
      const pi = session.payment_intent as Stripe.PaymentIntent;
      const bookingId = pi.metadata?.booking_id;
      amount = pi.amount;

      if (
        (pi.status === "succeeded" || session.payment_status === "paid") &&
        bookingId
      ) {
        const { data: existing } = await admin
          .from("payments")
          .select("id")
          .eq("stripe_payment_ref", pi.id)
          .maybeSingle();

        if (!existing) {
          await admin.from("payments").insert({
            booking_id: bookingId,
            kind: "tip",
            gross_amount: amount / 100,
            split_breakdown: { provider: amount / 100 },
            stripe_payment_ref: pi.id,
            status: "succeeded",
          });

          // Tell the provider
          const { data: b } = await admin
            .from("bookings")
            .select("provider_id")
            .eq("id", bookingId)
            .maybeSingle();
          if (b?.provider_id) {
            const { data: p } = await admin
              .from("providers")
              .select("profile_id")
              .eq("id", b.provider_id)
              .maybeSingle();
            if (p?.profile_id) {
              await admin.from("notifications").insert({
                user_id: p.profile_id,
                title: `You received a £${(amount / 100).toFixed(2)} tip`,
                body: "A client added a tip for your work. It's all yours.",
                href: "/worker/earnings",
              });
            }
          }
        }
        ok = true;
      }
    } catch {
      ok = false;
    }
  }

  return (
    <main
      style={{
        minHeight: "70vh",
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
          padding: "38px 34px",
          maxWidth: 420,
          textAlign: "center",
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
          Thank you
        </p>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 500,
            fontSize: 28,
            color: "#2f4a3a",
            margin: "0 0 8px",
          }}
        >
          {ok ? "Tip sent" : "Couldn't confirm the tip"}
        </h1>
        <p style={{ color: "#6e7a70", margin: "0 0 24px" }}>
          {ok
            ? `£${(amount / 100).toFixed(
                2
              )} has gone straight to your provider — we don't take a penny of it.`
            : "Check the Stripe test dashboard, or try again from your bookings."}
        </p>
        <a
          href="/account"
          style={{
            display: "inline-block",
            background: "#2f4a3a",
            color: "#fbf7f0",
            padding: "12px 26px",
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Back to my bookings
        </a>
      </div>
    </main>
  );
}