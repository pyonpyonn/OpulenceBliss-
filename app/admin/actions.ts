"use server";

// Admin data tools. Save at: app/admin/actions.ts
// Every action checks the caller is an admin first.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (p?.role !== "admin") throw new Error("Admins only");
  return supabase;
}

const ALL = "00000000-0000-0000-0000-000000000000"; // sentinel for "match everything"

export async function approveProvider(id: string) {
  const s = await requireAdmin();
  await s
    .from("providers")
    .update({ vetting_status: "approved" })
    .eq("id", id);

  // Let them know
  const { data: p } = await s
    .from("providers")
    .select("profile_id")
    .eq("id", id)
    .maybeSingle();
  if (p?.profile_id) {
    await s.from("notifications").insert({
      user_id: p.profile_id,
      title: "You're approved",
      body: "Your provider account has been approved. Jobs will start coming through.",
      href: "/worker",
    });
  }
  revalidatePath("/admin");
  revalidatePath("/worker");
}

export async function rejectProvider(id: string) {
  const s = await requireAdmin();
  await s
    .from("providers")
    .update({ vetting_status: "rejected" })
    .eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/worker");
}

export async function deleteReview(id: string) {
  const s = await requireAdmin();
  await s.from("reviews").delete().eq("id", id);
  await recalcRatings(s);
  revalidatePath("/admin");
}

export async function wipeReviews() {
  const s = await requireAdmin();
  await s.from("reviews").delete().neq("id", ALL);
  await recalcRatings(s);
  revalidatePath("/admin");
}

// Reset cached rating figures after deletions.
async function recalcRatings(
  s: Awaited<ReturnType<typeof requireAdmin>>
) {
  await s
    .from("providers")
    .update({ rating_avg: null, rating_count: 0 })
    .neq("id", ALL);
  await s
    .from("profiles")
    .update({ client_rating_avg: null, client_rating_count: 0 })
    .neq("id", ALL);
}

export async function wipeBookings() {
  const s = await requireAdmin();
  // payments reference bookings, so clear them first
  await s.from("payments").delete().neq("id", ALL);
  await s.from("check_ins").delete().neq("id", ALL);
  await s.from("bookings").delete().neq("id", ALL);
  revalidatePath("/admin");
}

export async function wipePayments() {
  const s = await requireAdmin();
  await s.from("payments").delete().neq("id", ALL);
  revalidatePath("/admin");
}

export async function wipeAvailability() {
  const s = await requireAdmin();
  await s.from("provider_availability").delete().neq("id", ALL);
  revalidatePath("/admin");
}

export async function resetJoiningFees() {
  const s = await requireAdmin();
  await s
    .from("providers")
    .update({
      joining_fee_paid: false,
      joining_fee_ref: null,
      joining_fee_at: null,
    })
    .neq("id", ALL);
  revalidatePath("/admin");
}

export async function wipeEverything() {
  const s = await requireAdmin();
  await s.from("payments").delete().neq("id", ALL);
  await s.from("check_ins").delete().neq("id", ALL);
  await s.from("reviews").delete().neq("id", ALL);
  await s.from("bookings").delete().neq("id", ALL);
  await s.from("subscriptions").delete().neq("id", ALL);
  revalidatePath("/admin");
}
