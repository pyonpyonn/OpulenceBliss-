"use server";

// Worker job actions. Save at: app/worker/actions.ts
// (If your server client lives under utils/, change the import.)

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";

// How close a provider must be to count as "on site".
const GEOFENCE_METRES = 500;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Service role — needed because providers can't read the payments table.
const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Write a notification for someone (service role — bypasses RLS).
async function notify(
  userId: string | null | undefined,
  title: string,
  body: string,
  href: string
) {
  if (!userId) return;
  await admin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    href,
  });
}

// Who's the customer on this booking, and what service?
async function bookingContext(id: string) {
  const { data } = await admin
    .from("bookings")
    .select("customer_id, customer_email, address, scheduled_at, packages(name)")
    .eq("id", id)
    .maybeSingle();
  const p = data?.packages as { name: string } | { name: string }[] | null;
  const name =
    (Array.isArray(p) ? p[0]?.name : p?.name) ?? "your booking";
  return {
    customerId: data?.customer_id ?? null,
    email: data?.customer_email ?? null,
    address: data?.address ?? null,
    scheduledAt: data?.scheduled_at ?? null,
    service: name,
  };
}

// Pull a UK postcode out of whatever's stored in the address.
function extractPostcode(s: string | null) {
  if (!s) return null;
  const up = s.toUpperCase().replace(/\s+/g, " ").trim();
  const full = up.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/);
  if (full) return full[0];
  const out = up.match(/^[A-Z]{1,2}\d[A-Z\d]?$/);
  return out ? out[0] : up;
}

// Turn a UK postcode into coordinates (postcodes.io, free, no key).
// Tries the full postcode, then falls back to the district (outcode).
async function geocode(raw: string | null) {
  const pc = extractPostcode(raw);
  if (!pc) return null;

  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const j = await res.json();
      if (typeof j?.result?.latitude === "number") {
        return { lat: j.result.latitude, lng: j.result.longitude as number };
      }
    }
  } catch {
    /* fall through to outcode */
  }

  // District only, e.g. "SW3"
  const outcode = pc.split(" ")[0];
  try {
    const res = await fetch(
      `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const j = await res.json();
      if (typeof j?.result?.latitude === "number") {
        return { lat: j.result.latitude, lng: j.result.longitude as number };
      }
    }
  } catch {
    /* give up */
  }

  return null;
}

// Straight-line distance in metres.
function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export async function acceptJob(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: me } = await supabase
    .from("providers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!me) return { error: "Not a provider" };

  // Race-safe claim: only works while nobody else has taken it.
  const { data: claimed } = await supabase
    .from("bookings")
    .update({ provider_id: me.id, status: "scheduled" })
    .eq("id", id)
    .is("provider_id", null)
    .eq("status", "offered")
    .select("id");

  if (!claimed?.length) {
    // Someone beat them to it.
    await admin
      .from("booking_offers")
      .update({ status: "lost" })
      .eq("booking_id", id)
      .eq("provider_id", me.id);
    revalidatePath("/worker");
    return { taken: true };
  }

  // Close the offer for everyone else.
  await admin
    .from("booking_offers")
    .update({ status: "accepted" })
    .eq("booking_id", id)
    .eq("provider_id", me.id);
  await admin
    .from("booking_offers")
    .update({ status: "lost" })
    .eq("booking_id", id)
    .neq("provider_id", me.id)
    .eq("status", "open");

  const { customerId, service, email, scheduledAt } = await bookingContext(id);
  await notify(
    customerId,
    "Your provider is confirmed",
    `${service} — a vetted provider has accepted your booking.`,
    "/account"
  );
  await sendEmail({
    to: email,
    subject: "Your booking is confirmed",
    title: "Your provider is confirmed",
    body: `<p>Good news — a vetted provider has accepted your <strong>${service}</strong> booking${
      scheduledAt
        ? ` for ${new Date(scheduledAt).toLocaleString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : ""
    }.</p><p>You'll only be charged once the visit is complete.</p>`,
    cta: { text: "View your booking", url: "/account" },
  });

  revalidatePath("/worker");
  revalidatePath("/account");
  return { ok: true };
}

// Decline just removes THIS provider — the job stays open for the others.
export async function declineJob(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: me } = await supabase
    .from("providers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!me) return;

  await supabase
    .from("booking_offers")
    .update({ status: "declined" })
    .eq("booking_id", id)
    .eq("provider_id", me.id);

  revalidatePath("/worker");
}

// Arrived at the customer's home — work starts.
// Optionally verified against the booking's postcode by GPS.
export async function checkInJob(
  id: string,
  lat?: number | null,
  lng?: number | null,
  force = false
) {
  const supabase = await createClient();
  const ctx = await bookingContext(id);

  // Geofence check: is the provider actually near the address?
  let pass: boolean | null = null;
  let distance: number | null = null;
  let reason = "";
  const pc = extractPostcode(ctx.address);

  if (typeof lat !== "number" || typeof lng !== "number") {
    reason =
      "Location not shared, so we can't confirm you're at the address. Allow location access in your browser and try again.";
  } else {
    const target = await geocode(ctx.address);
    if (!target) {
      reason = `Couldn't look up the booking address (${
        pc ?? "none saved"
      }), so your location can't be confirmed.`;
    } else {
      distance = metresBetween({ lat, lng }, target);
      pass = distance <= GEOFENCE_METRES;
      reason = pass
        ? `Location confirmed — you're ${distance}m from ${pc}.`
        : `You're about ${distance}m from ${pc} — too far to check in (limit ${GEOFENCE_METRES}m).`;
    }
  }

  // Only check in if we could positively confirm the location.
  if (pass !== true && !force) {
    return { blocked: true, pass, distance, reason };
  }

  await supabase
    .from("bookings")
    .update({ status: "in_progress" })
    .eq("id", id);

  await supabase.from("check_ins").insert({
    booking_id: id,
    arrived_at: new Date().toISOString(),
    gps_lat: typeof lat === "number" ? lat : null,
    gps_lng: typeof lng === "number" ? lng : null,
    geofence_pass: pass,
  });

  await notify(
    ctx.customerId,
    "Your provider has arrived",
    `${ctx.service} — they've checked in and started work.`,
    "/account"
  );
  await sendEmail({
    to: ctx.email,
    subject: "Your provider has arrived",
    title: "They're here",
    body: `<p>Your provider has checked in and started your <strong>${ctx.service}</strong>.</p>`,
    cta: { text: "View your booking", url: "/account" },
  });

  revalidatePath("/worker");
  revalidatePath("/account");
  return { blocked: false, pass, distance, reason };
}

// Job finished — complete it AND capture the held payment.
export async function checkOutJob(id: string) {
  const supabase = await createClient();

  await supabase.from("bookings").update({ status: "completed" }).eq("id", id);

  await supabase
    .from("check_ins")
    .update({ left_at: new Date().toISOString() })
    .eq("booking_id", id)
    .is("left_at", null);

  // This is the moment the customer is actually charged.
  const { data: pays } = await admin
    .from("payments")
    .select("id, stripe_payment_ref, status, split_breakdown")
    .eq("booking_id", id)
    .limit(1);

  const pay = pays?.[0];
  let earned = 0;
  if (pay?.stripe_payment_ref && pay.status !== "succeeded") {
    earned = Number(
      (pay.split_breakdown as { provider?: number } | null)?.provider ?? 0
    );
    try {
      await stripe.paymentIntents.capture(pay.stripe_payment_ref);
      await admin
        .from("payments")
        .update({ status: "succeeded" })
        .eq("id", pay.id);
    } catch {
      // Already captured, or capture failed — leave the record as-is.
    }
  }

  const { customerId, service, email } = await bookingContext(id);
  await notify(
    customerId,
    "Visit completed",
    `${service} — all done. Your card has now been charged.`,
    "/account"
  );
  await sendEmail({
    to: email,
    subject: "Your visit is complete",
    title: "All done",
    body: `<p>Your <strong>${service}</strong> is complete and your card has now been charged.</p>
           <p>If you have a moment, we'd love a quick rating for your provider.</p>`,
    cta: { text: "Rate your visit", url: "/account" },
  });

  revalidatePath("/worker");
  revalidatePath("/account");
  return { earned };
}
export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  revalidatePath("/notifications");
}

// Provider rates the client after a completed visit.
export async function rateClient(
  id: string,
  rating: number,
  comment: string
) {
  const supabase = await createClient();
  const clean = Math.min(5, Math.max(1, Math.round(rating)));

  const { error } = await supabase.from("reviews").insert({
    booking_id: id,
    reviewer: "provider",
    rating: clean,
    comment: comment?.trim() ? comment.trim() : null,
  });

  if (!error) {
    const ctx = await bookingContext(id);
    await notify(
      ctx.customerId,
      `Your provider rated you ${clean} stars`,
      comment?.trim() ? comment.trim().slice(0, 120) : "Thanks for having them.",
      "/account"
    );
  }

  revalidatePath("/worker");
  return { error: error?.message ?? null };
}