// Available slots for a postcode.
// Save at: app/api/slots/route.ts
// Try: localhost:3000/api/slots?postcode=SW3%201AA

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAYS_AHEAD = 14;
const SLOT_HOURS = 2; // each visit is a 2-hour block

function outwardCode(pc: string) {
  const s = (pc || "").toUpperCase().replace(/\s+/g, "");
  if (s.length <= 4) return s;
  return s.slice(0, s.length - 3);
}

export async function GET(req: NextRequest) {
  try {
    const postcode = req.nextUrl.searchParams.get("postcode") ?? "";
    const service = req.nextUrl.searchParams.get("service") ?? "";
    const out = outwardCode(postcode);
    if (!out) {
      return NextResponse.json({ error: "Missing postcode" }, { status: 400 });
    }

    // 1. Which areas cover this postcode?
    const { data: areas } = await admin
      .from("service_areas")
      .select("id, name, postcode_prefixes")
      .eq("active", true);

    const areaIds = (areas ?? [])
      .filter((a) => (a.postcode_prefixes ?? []).includes(out))
      .map((a) => a.id);

    if (areaIds.length === 0) {
      return NextResponse.json({ covered: false, slots: [], suggested: [] });
    }

    // 2. Approved providers covering those areas
    const { data: links } = await admin
      .from("provider_service_areas")
      .select("provider_id")
      .in("service_area_id", areaIds);

    const providerIds = [...new Set((links ?? []).map((l) => l.provider_id))];
    if (providerIds.length === 0) {
      return NextResponse.json({ covered: true, slots: [], suggested: [] });
    }

    let q = admin
      .from("providers")
      .select("id")
      .in("id", providerIds)
      .eq("vetting_status", "approved")
      .eq("joining_fee_paid", true); // must have paid the £150 to receive work

    if (service) q = q.contains("services", [service]);

    const { data: provs } = await q;

    const approved = (provs ?? []).map((p) => p.id);
    if (approved.length === 0) {
      return NextResponse.json({ covered: true, slots: [], suggested: [] });
    }

    // 3. Their weekly availability
    const { data: avail } = await admin
      .from("provider_availability")
      .select("provider_id, weekday, start_time, end_time")
      .in("provider_id", approved);

    if (!avail || avail.length === 0) {
      return NextResponse.json({ covered: true, slots: [], suggested: [] });
    }

    // 4. Bookings already taken (so we don't double-book)
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + DAYS_AHEAD + 1);

    const { data: taken } = await admin
      .from("bookings")
      .select("provider_id, scheduled_at, status")
      .gte("scheduled_at", from.toISOString())
      .lte("scheduled_at", to.toISOString())
      .in("status", ["offered", "scheduled", "in_progress"]);

    const busy = new Set(
      (taken ?? []).map(
        (b) => `${b.provider_id}|${new Date(b.scheduled_at).getTime()}`
      )
    );

    // 5. Build slots (counting how many providers are free at each time)
    const now = Date.now();
    const slotMap = new Map<number, { iso: string; count: number }>();

    for (let d = 0; d <= DAYS_AHEAD; d++) {
      const day = new Date();
      day.setDate(day.getDate() + d);
      const weekday = day.getDay();

      for (const a of avail) {
        if (a.weekday !== weekday) continue;

        const startH = parseInt(String(a.start_time).slice(0, 2), 10);
        const endH = parseInt(String(a.end_time).slice(0, 2), 10);

        for (let h = startH; h + SLOT_HOURS <= endH; h += SLOT_HOURS) {
          const slot = new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            h,
            0,
            0,
            0
          );
          const t = slot.getTime();
          if (t < now + 2 * 60 * 60 * 1000) continue; // 2h minimum notice
          if (busy.has(`${a.provider_id}|${t}`)) continue;

          const found = slotMap.get(t);
          if (found) found.count += 1;
          else slotMap.set(t, { iso: slot.toISOString(), count: 1 });
        }
      }
    }

    const ordered = [...slotMap.entries()].sort((x, y) => x[0] - y[0]);
    const slots = ordered.map(([, v]) => v.iso);

    // 6. Suggested times — soonest, best-staffed, and a calm mid-week morning.
    const suggested: { iso: string; reason: string }[] = [];
    const push = (iso: string, reason: string) => {
      if (iso && !suggested.some((s) => s.iso === iso) && suggested.length < 3) {
        suggested.push({ iso, reason });
      }
    };

    if (ordered.length) {
      push(ordered[0][1].iso, "Earliest available");

      const best = [...ordered].sort(
        (x, y) => y[1].count - x[1].count || x[0] - y[0]
      )[0];
      if (best && best[1].count > 1) {
        push(best[1].iso, "Most providers free");
      }

      const morning = ordered.find(([t]) => {
        const d = new Date(t);
        const wd = d.getDay();
        return wd >= 1 && wd <= 5 && d.getHours() >= 9 && d.getHours() <= 11;
      });
      if (morning) push(morning[1].iso, "Quiet weekday morning");
    }

    return NextResponse.json({ covered: true, slots, suggested });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load slots";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}