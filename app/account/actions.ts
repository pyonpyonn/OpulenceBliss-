"use server";

// Client booking actions: cancel, reschedule, rate.
// Save at: app/account/actions.ts

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import Stripe from "stripe";
import { revalidatePath } from "next/cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function notifyProvider(bookingId: string, title: string, body: string) {
  const { data: b } = await admin
    .from("bookings")
    .select("provider_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b?.provider_id) return;

  const { data: p } = await admin
    .from("providers")
    .select("profile_id")
    .eq("id", b.provider_id)
    .maybeSingle();
  if (!p?.profile_id) return;

  await admin.from("notifications").insert({
    user_id: p.profile_id,
    title,
    body,
    href: "/worker",
  });
}

// Cancel — releases the held payment (nothing was charged yet).
export async function cancelBooking(id: string) {
  const supabase = await createClient();

  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);

  // Release the authorisation hold so the customer's money is freed.
  const { data: pays } = await admin
    .from("payments")
    .select("id, stripe_payment_ref, status")
    .eq("booking_id", id)
    .limit(1);

  const pay = pays?.[0];
  if (pay?.stripe_payment_ref) {
    try {
      if (pay.status === "succeeded") {
        // Already charged — refund instead.
        await stripe.refunds.create({ payment_intent: pay.stripe_payment_ref });
      } else {
        await stripe.paymentIntents.cancel(pay.stripe_payment_ref);
      }
      await admin
        .from("payments")
        .update({ status: "refunded" })
        .eq("id", pay.id);
    } catch {
      // Nothing to release, or Stripe refused — leave the record alone.
    }
  }

  await notifyProvider(
    id,
    "Booking cancelled",
    "The customer cancelled this visit. It's been removed from your schedule."
  );

  revalidatePath("/account");
  revalidatePath("/worker");
}

// Reschedule — move the visit to a new slot.
export async function rescheduleBooking(id: string, newSlot: string) {
  if (!newSlot) return;
  const supabase = await createClient();

  await supabase
    .from("bookings")
    .update({ scheduled_at: newSlot, status: "offered" })
    .eq("id", id);

  const when = new Date(newSlot).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  await notifyProvider(
    id,
    "Booking time changed",
    `The customer moved this visit to ${when}. Please accept or decline.`
  );

  revalidatePath("/account");
  revalidatePath("/worker");
}

// Rate a completed visit.
export async function rateBooking(
  id: string,
  rating: number,
  comment: string
) {
  const supabase = await createClient();
  const clean = Math.min(5, Math.max(1, Math.round(rating)));

  await supabase.from("reviews").insert({
    booking_id: id,
    rating: clean,
    comment: comment?.trim() ? comment.trim() : null,
  });

  await notifyProvider(
    id,
    `You received a ${clean}-star review`,
    comment?.trim() ? comment.trim().slice(0, 120) : "Thanks for your work."
  );

  revalidatePath("/account");
}