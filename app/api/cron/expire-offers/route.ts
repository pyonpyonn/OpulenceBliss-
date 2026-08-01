// Expire unclaimed offers. Save at: app/api/cron/expire-offers/route.ts
//
// Run this every 10–15 minutes from n8n (or any scheduler):
//   GET http://localhost:3000/api/cron/expire-offers?key=YOUR_SECRET
//
// Add to .env.local:  CRON_SECRET=some-long-random-string

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Still on offer, past the deadline, nobody claimed it.
  const { data: stale } = await admin
    .from("bookings")
    .select("id, customer_id, customer_email, scheduled_at, packages(name)")
    .eq("status", "offered")
    .is("provider_id", null)
    .lt("offer_expires_at", now)
    .limit(50);

  const expired: string[] = [];

  for (const b of stale ?? []) {
    const pkg = b.packages as { name: string } | { name: string }[] | null;
    const service =
      (Array.isArray(pkg) ? pkg[0]?.name : pkg?.name) ?? "your booking";

    // 1. Cancel the booking
    await admin.from("bookings").update({ status: "cancelled" }).eq("id", b.id);

    // 2. Close the outstanding offers
    await admin
      .from("booking_offers")
      .update({ status: "expired" })
      .eq("booking_id", b.id)
      .eq("status", "open");

    // 3. Release the card hold — they were never charged
    const { data: pays } = await admin
      .from("payments")
      .select("id, stripe_payment_ref, status")
      .eq("booking_id", b.id)
      .limit(1);

    const pay = pays?.[0];
    if (pay?.stripe_payment_ref && pay.status === "pending") {
      try {
        await stripe.paymentIntents.cancel(pay.stripe_payment_ref);
        await admin
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", pay.id);
      } catch {
        // Already released or captured — leave it.
      }
    }

    // 4. Tell the client
    if (b.customer_id) {
      await admin.from("notifications").insert({
        user_id: b.customer_id,
        title: "We couldn't fill your booking",
        body: `${service} — no provider was free for that time, so we've cancelled it. Nothing was charged.`,
        href: "/book",
      });
    }
    await sendEmail({
      to: b.customer_email,
      subject: "We couldn't fill your booking",
      title: "No provider available",
      body: `<p>We're sorry — no provider was free for your <strong>${service}</strong>, so we've cancelled the booking.</p>
             <p><strong>You haven't been charged</strong> — the hold on your card has been released.</p>
             <p>Try another time and we'll find someone.</p>`,
      cta: { text: "Book another time", url: "/book" },
    });

    expired.push(b.id);
  }

  return NextResponse.json({ checked: stale?.length ?? 0, expired });
}