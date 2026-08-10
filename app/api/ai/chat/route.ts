// AI support agent — knowledge base + read-only tools.
// Save at: app/api/ai/chat/route.ts
//
// The agent can look things up (coverage, services, free slots, your bookings,
// your spend). It deliberately CANNOT book, cancel, charge or change anything.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * A Supabase client acting AS the signed-in user, built from the token the
 * browser sends. Row-level security still applies, so this can only ever see
 * that person's own data.
 */
function asUser(token: string | null) {
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768;
const CHAT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

/* ------------------------------------------------------------------ */
/* Tools the model may call                                            */
/* ------------------------------------------------------------------ */

const SHARED_TOOLS = [
  {
    name: "check_coverage",
    description:
      "Check whether Opulence Bliss covers a UK postcode. Use whenever someone mentions a postcode or asks if you come to their area.",
    parameters: {
      type: "OBJECT",
      properties: {
        postcode: {
          type: "STRING",
          description: "UK postcode or district, e.g. 'SW3 1AA' or 'IG11'",
        },
      },
      required: ["postcode"],
    },
  },
  {
    name: "list_services",
    description:
      "List current services and memberships with prices. Use for any question about what's offered or what things cost.",
    parameters: { type: "OBJECT", properties: {} },
  },
];

const CLIENT_TOOLS = [
  {
    name: "find_slots",
    description:
      "Find real available appointment times for a postcode. Use when someone asks what's free, or names a day or time they want.",
    parameters: {
      type: "OBJECT",
      properties: {
        postcode: { type: "STRING", description: "UK postcode" },
        service_type: {
          type: "STRING",
          description: "Either 'cleaning' or 'massage'",
        },
        date: {
          type: "STRING",
          description:
            "Optional ISO date (YYYY-MM-DD) to narrow to one day. Work it out from today's date if the person says something like 'in 3 days' or 'Friday'.",
        },
      },
      required: ["postcode"],
    },
  },
  {
    name: "prepare_booking",
    description:
      "Build a prefilled booking link once you know the service, postcode and chosen time. This does NOT book anything — it takes the customer to the confirm-and-pay screen with everything filled in. Use it as the final step whenever someone has settled on a service and a time.",
    parameters: {
      type: "OBJECT",
      properties: {
        service_name: {
          type: "STRING",
          description:
            "Exact service name, e.g. 'Bliss Massage · 60 min' or 'Essential Clean'",
        },
        postcode: { type: "STRING", description: "UK postcode" },
        slot: {
          type: "STRING",
          description:
            "The chosen slot as a full ISO timestamp, exactly as returned by find_slots",
        },
      },
      required: ["service_name", "postcode", "slot"],
    },
  },
  {
    name: "my_membership",
    description:
      "Check whether the signed-in customer has a monthly membership, and if so which plan, its status, how far through the term they are and when the next payment is due. Use for 'do I have a subscription', 'when am I next billed', 'what plan am I on'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "my_bookings",
    description:
      "Get the signed-in customer's own recent bookings and their status. Use for 'when is my next visit', 'has my provider been confirmed', 'what did I book'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "my_spend",
    description:
      "Get how much the signed-in customer has spent in total and how many visits they've had.",
    parameters: { type: "OBJECT", properties: {} },
  },
];

const PROVIDER_TOOLS = [
  {
    name: "my_jobs",
    description:
      "Get the signed-in provider's own jobs — open offers, what's confirmed, anything in progress. Use for 'what work have I got', 'what's my next job', 'do I have any offers'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "my_earnings",
    description:
      "Get the signed-in provider's earnings — paid so far, pending, tips and their rating. Use for 'how much have I earned', 'when do I get paid', 'what's my rating'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "my_availability",
    description:
      "Get the signed-in provider's working days and hours, and whether their account is active for work.",
    parameters: { type: "OBJECT", properties: {} },
  },
];

function toolsFor(role: string) {
  return [
    {
      functionDeclarations: [
        ...SHARED_TOOLS,
        ...(role === "provider" ? PROVIDER_TOOLS : CLIENT_TOOLS),
      ],
    },
  ];
}

function district(pc: string) {
  const s = (pc || "").toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  const full = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)\d[A-Z]{2}$/);
  if (full) return full[1];
  return s.length > 4 ? s.slice(0, s.length - 3) : s;
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  origin: string,
  ssr: ReturnType<typeof asUser>
) {
  try {
    if (name === "check_coverage") {
      const d = district(String(args.postcode ?? ""));
      const { data } = await admin
        .from("service_areas")
        .select("name, postcode_prefixes")
        .eq("active", true);
      const hit = (data ?? []).find((a) =>
        (a.postcode_prefixes ?? []).includes(d)
      );
      return hit
        ? { covered: true, area: hit.name, district: d }
        : {
            covered: false,
            district: d,
            areas_we_cover: (data ?? []).map((a) => a.name),
          };
    }

    if (name === "list_services") {
      const { data } = await admin
        .from("packages")
        .select("name, price, duration_minutes, service_type, description")
        .eq("active", true)
        .order("price");
      return { services: data ?? [] };
    }

    if (name === "find_slots") {
      const pc = String(args.postcode ?? "");
      const svc = String(args.service_type ?? "");
      const res = await fetch(
        `${origin}/api/slots?postcode=${encodeURIComponent(
          pc
        )}&service=${encodeURIComponent(svc)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      let slots: string[] = data.slots ?? [];
      if (args.date) {
        const want = String(args.date);
        slots = slots.filter((s) => s.slice(0, 10) === want);
      }
      return {
        covered: data.covered ?? false,
        count: slots.length,
        slots: slots.slice(0, 10),
        note: slots.length
          ? "Times are shown in UK time."
          : "No availability for that. Suggest another day.",
      };
    }

    if (name === "prepare_booking") {
      const wanted = String(args.service_name ?? "").toLowerCase().trim();
      const { data: pkgs } = await admin
        .from("packages")
        .select("id, name, price, duration_minutes")
        .eq("active", true);

      const match =
        (pkgs ?? []).find((p) => p.name.toLowerCase() === wanted) ??
        (pkgs ?? []).find((p) =>
          p.name.toLowerCase().includes(wanted.slice(0, 12))
        );

      if (!match) {
        return {
          ok: false,
          error: "No service by that name. Call list_services first.",
        };
      }

      const pc = String(args.postcode ?? "");
      const slot = String(args.slot ?? "");
      const url = `/book?service=${match.id}&pc=${encodeURIComponent(
        pc
      )}&slot=${encodeURIComponent(slot)}`;

      return {
        ok: true,
        url,
        service: match.name,
        price_gbp: Number(match.price),
        duration_minutes: match.duration_minutes,
        when: slot,
        note: "Give them this exact url. Nothing is booked until they confirm and pay there.",
      };
    }

    // ---- user-scoped: RLS makes sure they only see their own ----
    if (
      name === "my_bookings" ||
      name === "my_spend" ||
      name === "my_membership" ||
      name === "my_jobs" ||
      name === "my_earnings" ||
      name === "my_availability"
    ) {
      if (!ssr) {
        return { signed_in: false, message: "Ask them to log in at /login." };
      }
      const {
        data: { user },
      } = await ssr.auth.getUser();
      if (!user) {
        return { signed_in: false, message: "Ask them to log in at /login." };
      }

      if (name === "my_membership") {
        const { data: sub } = await ssr
          .from("subscriptions")
          .select(
            "status, start_date, contract_length_months, cycles_billed, current_period_end, preferred_weekday, preferred_hour, paused_until, packages(name, price, visits_per_month)"
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!sub) {
          return {
            signed_in: true,
            has_membership: false,
            message:
              "No membership. They pay per visit. Memberships are at /subscribe.",
          };
        }

        const p = sub.packages as
          | { name: string; price: number; visits_per_month: number | null }
          | { name: string; price: number; visits_per_month: number | null }[]
          | null;
        const pk = Array.isArray(p) ? p[0] : p;
        const days = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        return {
          signed_in: true,
          has_membership: true,
          plan: pk?.name ?? "Membership",
          monthly_price_gbp: Number(pk?.price ?? 0),
          visits_per_month: pk?.visits_per_month ?? null,
          status: sub.paused_until ? "paused" : sub.status,
          months_billed: sub.cycles_billed,
          contract_months: sub.contract_length_months,
          next_payment: sub.current_period_end,
          schedule:
            sub.preferred_weekday !== null
              ? `${days[sub.preferred_weekday]}s at ${String(
                  sub.preferred_hour ?? 10
                ).padStart(2, "0")}:00`
              : null,
          started: sub.start_date,
          manage_at: "/account/membership",
        };
      }

      if (name === "my_bookings") {
        const { data } = await ssr
          .from("bookings")
          .select("scheduled_at, status, address, packages(name)")
          .order("scheduled_at", { ascending: false })
          .limit(6);
        return {
          signed_in: true,
          bookings: (data ?? []).map((b) => {
            const p = b.packages as
              | { name: string }
              | { name: string }[]
              | null;
            return {
              service: (Array.isArray(p) ? p[0]?.name : p?.name) ?? "Service",
              when: b.scheduled_at,
              status: b.status,
              postcode: b.address,
            };
          }),
        };
      }

      if (name === "my_jobs") {
        const { data } = await ssr
          .from("bookings")
          .select("scheduled_at, status, address, packages(name)")
          .order("scheduled_at", { ascending: true })
          .limit(10);

        const { data: offers } = await ssr
          .from("booking_offers")
          .select("status")
          .eq("status", "open");

        return {
          signed_in: true,
          open_offers: (offers ?? []).length,
          jobs: (data ?? []).map((b) => {
            const p = b.packages as
              | { name: string }
              | { name: string }[]
              | null;
            return {
              service: (Array.isArray(p) ? p[0]?.name : p?.name) ?? "Service",
              when: b.scheduled_at,
              status: b.status,
              postcode: b.address,
            };
          }),
          see_offers_at: "/worker",
        };
      }

      if (name === "my_earnings") {
        const { data: prov } = await ssr
          .from("providers")
          .select("rating_avg, rating_count, joining_fee_paid, vetting_status")
          .eq("profile_id", user.id)
          .maybeSingle();

        const { data } = await ssr
          .from("payments")
          .select("split_breakdown, status, kind");

        const share = (p: { split_breakdown: unknown }) =>
          Number(
            (p.split_breakdown as { provider?: number } | null)?.provider ?? 0
          );
        const rows = data ?? [];
        const paid = rows.filter(
          (p) => p.status === "succeeded" && p.kind !== "tip"
        );
        const pending = rows.filter((p) => p.status === "pending");
        const tips = rows.filter(
          (p) => p.kind === "tip" && p.status === "succeeded"
        );

        return {
          signed_in: true,
          account_active: prov?.joining_fee_paid === true,
          approved: prov?.vetting_status === "approved",
          paid_gbp: Number(paid.reduce((s, p) => s + share(p), 0).toFixed(2)),
          pending_gbp: Number(
            pending.reduce((s, p) => s + share(p), 0).toFixed(2)
          ),
          tips_gbp: Number(tips.reduce((s, p) => s + share(p), 0).toFixed(2)),
          visits_completed: paid.length,
          rating: prov?.rating_avg ? Number(prov.rating_avg) : null,
          rating_count: prov?.rating_count ?? 0,
          detail_at: "/worker/earnings",
          note: "Paid automatically after checking out of each visit.",
        };
      }

      if (name === "my_availability") {
        const { data: prov } = await ssr
          .from("providers")
          .select("id, joining_fee_paid, vetting_status, services")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (!prov) return { signed_in: true, is_provider: false };

        const { data: avail } = await ssr
          .from("provider_availability")
          .select("weekday, start_time, end_time")
          .eq("provider_id", prov.id);

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return {
          signed_in: true,
          is_provider: true,
          account_active: prov.joining_fee_paid,
          approved: prov.vetting_status === "approved",
          skills: prov.services ?? [],
          hours: (avail ?? []).map(
            (a) =>
              `${days[a.weekday]} ${String(a.start_time).slice(0, 5)}–${String(
                a.end_time
              ).slice(0, 5)}`
          ),
          change_at: "/worker/availability",
        };
      }

      // my_spend
      const { data } = await ssr
        .from("payments")
        .select("gross_amount, status, kind")
        .eq("status", "succeeded");
      const visits = (data ?? []).filter((p) => p.kind !== "tip");
      const total = (data ?? []).reduce(
        (s, p) => s + Number(p.gross_amount ?? 0),
        0
      );
      return {
        signed_in: true,
        visits_paid: visits.length,
        total_spent_gbp: Number(total.toFixed(2)),
      };
    }

    return { error: "Unknown tool" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Tool failed" };
  }
}

/* ------------------------------------------------------------------ */

async function embed(text: string) {
  const res = await fetch(
    `${API}/${EMBED_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIMS,
      }),
    }
  );
  if (!res.ok) throw new Error(`Embedding failed: ${await res.text()}`);
  const json = await res.json();
  return json?.embedding?.values as number[];
}

function systemPrompt(context: string, role: string) {
  const now = new Date();
  const who =
    role === "provider"
      ? `You are talking to a PROVIDER — a cleaner or massage therapist who works through the platform. Answer from their side: their jobs, earnings, availability, how and when they get paid, the £150 joining fee, approval. Never try to sell them a customer booking or a membership. Their pages are /worker (jobs), /worker/current (live job), /worker/earnings, /worker/availability, /worker/profile.`
      : role === "admin"
      ? `You are talking to an ADMIN of the platform. Be brief and factual. Their tools are at /admin.`
      : role === "client"
      ? `You are talking to a signed-in CUSTOMER. You can look up their own bookings, membership and spend.`
      : `You are talking to a VISITOR who isn't signed in. You can answer general questions, but for anything about their own account tell them to log in at /login. If they want to work for us, point them to /provider/join.`;

  return `You are the support assistant for Opulence Bliss, a premium home cleaning and in-home massage marketplace in London.

${who}

Today is ${now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })}. The current time is ${now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })} UK time. Work out relative dates like "in 3 days" or "Friday" from this.

You have tools for looking things up — use them rather than guessing. If someone asks about their own account, call the relevant tool instead of assuming.

There are two ways customers pay: a single visit at /book, or a monthly membership at /subscribe with a three-month minimum term. Both exist — never say one of them isn't offered.

You CANNOT make, change, cancel or pay for a booking. When a customer has settled on a service and a time, call prepare_booking and give them the exact url it returns — that takes them to a confirm-and-pay screen with everything filled in. Always say plainly that nothing is booked until they confirm and pay there.

Rules:
- Write links as plain paths only, e.g. /book?service=abc&pc=SW3%201AA&slot=... — never use markdown link syntax with square brackets, and never write http:// or a domain.
- Rely on the CONTEXT below and your tool results. Never invent prices, policies or availability.
- If you don't know, say so and suggest contacting the Opulence Bliss team.
- Warm, brief, practical. Two or three sentences is usually plenty. Plain text, no markdown, no asterisks.
- Give times as friendly UK times, e.g. "Monday 3 August at 3:00pm".
- End with a useful next step and the relevant page path. Never invent a page.
- British English, pounds sterling.
- Never ask for card details, passwords or full street addresses.
- For emergencies, injury, damage or disputes, tell them to contact the team directly.

CONTEXT:
${context}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "The assistant isn't configured yet." },
        { status: 500 }
      );
    }

    const { message, history } = await req.json();
    const question = String(message ?? "").trim().slice(0, 500);
    if (!question) {
      return NextResponse.json({ error: "Ask me something!" }, { status: 400 });
    }

    // Retrieve relevant knowledge
    let context = "No relevant information found.";
    try {
      const vector = await embed(question);
      const { data: matches } = await admin.rpc("match_ai_docs", {
        query_embedding: vector,
        match_count: 5,
      });
      if (matches?.length) {
        context = matches
          .map(
            (m: { title: string; content: string }) =>
              `[${m.title}] ${m.content}`
          )
          .join("\n\n");
      }
    } catch (e) {
      console.error("Retrieval failed:", e);
    }

    // Who are we talking to? Prefer the token the browser sent; fall back to
    // cookies if it's missing.
    const bearer =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;

    let ssr = asUser(bearer);
    if (!ssr) {
      try {
        ssr = (await createServerClient()) as unknown as ReturnType<
          typeof asUser
        >;
      } catch {
        ssr = null;
      }
    }

    let role = "guest";
    if (ssr) {
      try {
        const {
          data: { user },
        } = await ssr.auth.getUser();
        if (user) {
          const { data: me } = await ssr
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          role = me?.role ?? "client";
        }
      } catch {
        /* stay a guest */
      }
    }

    const past = Array.isArray(history) ? history.slice(-6) : [];
    const contents: unknown[] = [
      ...past.map((m: { role: string; text: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.text).slice(0, 500) }],
      })),
      { role: "user", parts: [{ text: question }] },
    ];

    const body = () => ({
      systemInstruction: { parts: [{ text: systemPrompt(context, role) }] },
      contents,
      tools: toolsFor(role),
      generationConfig: { maxOutputTokens: 500 },
    });

    // Tool loop — at most three rounds.
    for (let round = 0; round < 3; round++) {
      const res = await fetch(
        `${API}/${CHAT_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body()),
        }
      );

      if (!res.ok) {
        console.error("Gemini error:", await res.text());
        return NextResponse.json(
          { error: "The assistant is unavailable right now." },
          { status: 502 }
        );
      }

      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const calls = parts.filter(
        (p: { functionCall?: unknown }) => p.functionCall
      );

      if (calls.length === 0) {
        const reply = parts
          .map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();
        return NextResponse.json({
          reply:
            reply ||
            "Sorry, I couldn't work that one out. Please contact the Opulence Bliss team.",
        });
      }

      // Run whatever it asked for, then let it answer.
      contents.push({ role: "model", parts });

      const responses: unknown[] = [];
      for (const c of calls) {
        const fc = c.functionCall as {
          name: string;
          args?: Record<string, unknown>;
          id?: string;
        };
        const result = await runTool(
          fc.name,
          fc.args ?? {},
          req.nextUrl.origin,
          ssr
        );
        responses.push({
          functionResponse: {
            ...(fc.id ? { id: fc.id } : {}),
            name: fc.name,
            response: { result },
          },
        });
      }
      contents.push({ role: "user", parts: responses });
    }

    return NextResponse.json({
      reply:
        "I couldn't quite pin that down. Try /book to see live availability, or ask me something more specific.",
    });
  } catch (e) {
    console.error("Chat error:", e);
    return NextResponse.json(
      { error: "Sorry, something went wrong. Try again in a moment." },
      { status: 500 }
    );
  }
}
