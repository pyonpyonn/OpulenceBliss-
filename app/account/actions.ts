"use server";

// Client booking actions: cancel, reschedule, rate.
// Save at: app/account/actions.ts

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import {
  claimMoneyOperation,
  getRescheduleWindow,
  rescheduleBookingState,
  systemFinaliseMoneyOperation,
  systemTransitionPayment,
  transitionBooking,
} from "@/lib/bookingState";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function notifyProvider(bookingId: string, title: string, body: string) {
  const { data: b } = await admin
    .from("bookings")
    .select("provider_id")
    .eq("id", bookingId)
    .maybeSingle();
  let providerId = b?.provider_id ?? null;
  if (!providerId) {
    const { data: offer } = await admin
      .from("booking_offers")
      .select("provider_id")
      .eq("booking_id", bookingId)
      .in("status", ["accepted", "open"])
      .limit(1)
      .maybeSingle();
    providerId = offer?.provider_id ?? null;
  }
  if (!providerId) return;

  const { data: p } = await admin
    .from("providers")
    .select("profile_id")
    .eq("id", providerId)
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
export async function cancelBooking(id: string, reason?: string) {
  const supabase = await createClient();
  const cleanReason = reason?.trim().slice(0, 240) || null;
  await transitionBooking(supabase, id, "cancelled", {
    reason: cleanReason
      ? `Customer cancelled: ${cleanReason}`
      : "Customer cancelled the booking",
    meta: cleanReason ? { cancellation_reason: cleanReason } : {},
  });

  // Release the authorisation hold so the customer's money is freed.
  const { data: pays } = await admin
    .from("payments")
    .select("id, stripe_payment_ref, status, gross_amount")
    .eq("booking_id", id)
    .limit(1);

  const pay = pays?.[0];
  if (pay?.stripe_payment_ref) {
    const refunding = pay.status === "succeeded";
    const operationKey = refunding
      ? `refund:booking:${id}:full`
      : `release:booking:${id}`;
    try {
      if (refunding) {
        await systemTransitionPayment(admin, pay.id, "refund_pending", {
          reason: "Customer cancelled the booking",
        });
      } else {
        await systemTransitionPayment(admin, pay.id, "cancelling");
      }

      const op = await claimMoneyOperation(admin, {
        operationKey,
        operationType: refunding ? "refund" : "release",
        bookingId: id,
        amount: Number(pay.gross_amount ?? 0),
      });

      if (op.should_run) {
        const stripeObject = refunding
          ? await stripe.refunds.create(
              {
                payment_intent: pay.stripe_payment_ref,
                metadata: { operation_key: operationKey, booking_id: id },
              },
              { idempotencyKey: operationKey },
            )
          : await stripe.paymentIntents.cancel(
              pay.stripe_payment_ref,
              {},
              { idempotencyKey: operationKey },
            );

        await systemFinaliseMoneyOperation(admin, op.id, "succeeded", {
          stripeObjectId: stripeObject.id,
        });

        await systemTransitionPayment(
          admin,
          pay.id,
          refunding ? "refunded" : "cancelled",
        );
      } else if (op.status === "succeeded") {
        await systemTransitionPayment(
          admin,
          pay.id,
          refunding ? "refunded" : "cancelled",
        );
      } else if (op.status === "ambiguous") {
        throw new Error("Stripe outcome is ambiguous; reconciliation required");
      }
    } catch (e) {
      const reason =
        e instanceof Error ? e.message : "Stripe cancellation failed";
      const target = refunding ? "succeeded" : "authorised";
      await systemTransitionPayment(admin, pay.id, target, { reason }).catch(
        () => undefined,
      );
      await admin.rpc("open_review_case", {
        p_booking_id: id,
        p_category: "payment_failure",
        p_priority: "high",
        p_blocks_payment: true,
        p_blocks_payout: true,
        p_notes: reason,
        p_created_by: null,
      });
    }
  }

  await notifyProvider(
    id,
    "Booking cancelled",
    "The customer cancelled this visit. It's been removed from your schedule.",
  );

  revalidatePath("/account");
  revalidatePath(`/account/visit/${id}`);
  revalidatePath("/worker");
  return {
    ok: true,
    message:
      pay?.status === "succeeded"
        ? "Booking cancelled. Your refund has been started."
        : "Booking cancelled. Your card hold is being released.",
  };
}

export async function loadRescheduleWindow(id: string) {
  const supabase = await createClient();
  try {
    return {
      ok: true as const,
      window: await getRescheduleWindow(supabase, id),
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "The reschedule window could not be checked.",
    };
  }
}

// Reschedule — move the visit to a new slot.
export async function rescheduleBooking(id: string, newSlot: string) {
  if (!newSlot) return { ok: false, message: "Choose a new time." };
  const supabase = await createClient();

  try {
    await rescheduleBookingState(supabase, id, newSlot, {
      reason: "Customer rescheduled the booking",
      meta: { source: "account" },
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "This visit could not be moved.",
    };
  }

  const when = new Date(newSlot).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  await notifyProvider(
    id,
    "Booking time changed",
    `The customer moved this visit to ${when}. If you can no longer attend, withdraw from the job so it can be re-offered.`,
  );

  revalidatePath("/account");
  revalidatePath("/worker");
  return { ok: true, message: `Visit moved to ${when}.` };
}

// Rate a completed visit.
export async function rateBooking(id: string, rating: number, comment: string) {
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
    comment?.trim() ? comment.trim().slice(0, 120) : "Thanks for your work.",
  );

  revalidatePath("/account");
}
