"use client";

// SETUP: mkdir -p "app/subscribe" && code "app/subscribe/page.tsx"
//
// Monthly memberships — the 3-month recurring contract.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Plan = {
  id: string;
  name: string;
  description: string | null;
  inclusions: string[] | null;
  good_to_know: string[] | null;
  price: number;
  visits_per_month: number | null;
};

type Area = { name: string; postcode_prefixes: string[] };

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

function outward(pc: string) {
  const s = pc.toUpperCase().replace(/\s+/g, "");
  return s.length <= 4 ? s : s.slice(0, s.length - 3);
}

const money = (n: number) => "£" + Number(n).toFixed(0);

function PlanIcon({ index }: { index: number }) {
  const icon = index % 4;

  if (icon === 0) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5v8A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M9 12.5c1.1-1.6 4.9-1.6 6 0-.1 2.2-1.5 3.6-3 4.5-1.5-.9-2.9-2.3-3-4.5Z" />
      </svg>
    );
  }

  if (icon === 1) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9L12 16.5 6.8 19.3l1-5.9-4.3-4.2 5.9-.9z" />
      </svg>
    );
  }

  if (icon === 2) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.2c1.4 1.7 2.1 3.2 2.1 4.4A2.1 2.1 0 0 1 12 10.8a2.1 2.1 0 0 1-2.1-2.2c0-1.2.7-2.7 2.1-4.4Z" />
        <path d="M7.2 8.2c2.2.4 3.6 1.1 4.3 2.1.7 1 .4 2.3-.6 3s-2.3.5-3-.5c-.7-1-1-2.5-.7-4.6Z" />
        <path d="M16.8 8.2c-2.2.4-3.6 1.1-4.3 2.1-.7 1-.4 2.3.6 3s2.3.5 3-.5c.7-1 1-2.5.7-4.6Z" />
        <path d="M5.5 17.2h13M8 20h8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 9 4-5h8l4 5-8 11z" />
      <path d="m4 9 8 11 8-11M8 4l4 5 4-5M4 9h16" />
    </svg>
  );
}

export default function SubscribePage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [postcode, setPostcode] = useState("");
  const [gate, setGate] = useState<null | { ok: boolean; area?: string }>(null);
  const [weekday, setWeekday] = useState(2);
  const [hour, setHour] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase
          .from("packages")
          .select(
            "id, name, description, inclusions, good_to_know, price, visits_per_month"
          )
          .eq("active", true)
          .eq("billing_type", "monthly")
          .order("price"),
        supabase
          .from("service_areas")
          .select("name, postcode_prefixes")
          .eq("active", true),
      ]);
      setPlans(p ?? []);
      setAreas(a ?? []);
    })();
  }, []);

  function check() {
    const out = outward(postcode);
    const hit = areas.find((x) => x.postcode_prefixes.includes(out));
    setGate(hit ? { ok: true, area: hit.name } : { ok: false });
  }

  async function subscribe() {
    if (!chosen || !gate?.ok) return;
    setBusy(true);
    setErr(null);

    // First visit: next occurrence of the chosen weekday at the chosen hour.
    const first = new Date();
    first.setDate(first.getDate() + 2); // at least 48h out
    while (first.getDay() !== weekday) first.setDate(first.getDate() + 1);
    first.setHours(hour, 0, 0, 0);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: chosen.id,
          postcode: postcode.toUpperCase(),
          slot: first.toISOString(),
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || "Couldn't start subscription");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"
      />

      <div className="inner">
        <header className="membership-head">
          <p className="eyebrow">Memberships</p>
          <h1>Regular care, handled</h1>
          <p className="lede">
            A three-month membership with your visits scheduled automatically.
            <br />
            Billed monthly, same trusted team each time.
          </p>
        </header>

        {/* Plans */}
        <div className="grid">
          {plans.length === 0 ? (
            <p className="muted">Loading memberships…</p>
          ) : (
            plans.map((p, i) => {
              const selected = chosen?.id === p.id;
              const notes =
                p.good_to_know && p.good_to_know.length > 0
                  ? p.good_to_know
                  : ["3-month minimum term, billed monthly"];

              return (
                <article
                  key={p.id}
                  className={[
                    "plan",
                    `tone-${i % 4}`,
                    i === 1 ? "featured" : "",
                    selected ? "on" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {i === 1 && <span className="pill">Most chosen</span>}

                  <div className="plan-icon">
                    <PlanIcon index={i} />
                  </div>

                  <h2>{p.name}</h2>
                  <p className="price">
                    {money(p.price)} <span>/ month</span>
                  </p>
                  <p className="visits">
                    {p.visits_per_month ?? 2} visits a month
                  </p>

                  <div className="divider" />

                  {p.inclusions && (
                    <ul className="features">
                      {p.inclusions.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  )}

                  <div className="good-box">
                    <p className="sub-head">Good to know</p>
                    <ul className="know">
                      {notes.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    className={i === 1 || selected ? "choose primary" : "choose"}
                    onClick={() => setChosen(p)}
                    aria-pressed={selected}
                  >
                    {selected ? "Selected ✓" : "Choose plan →"}
                  </button>
                </article>
              );
            })
          )}
        </div>

        {/* Set up */}
        {chosen && (
          <section className="setup">
            <p className="setup-kicker">Your membership</p>
            <h2>Set up your {chosen.name} membership</h2>

            <label>Your postcode</label>
            <div className="row">
              <input
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value);
                  setGate(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && check()}
                placeholder="SW3 1AA"
              />
              <button className="ghost" onClick={check}>
                Check
              </button>
            </div>
            {gate?.ok && <p className="ok">We cover {gate.area}.</p>}
            {gate && !gate.ok && (
              <p className="no">
                We&apos;re not in your area yet — try another postcode.
              </p>
            )}

            <label>Preferred day</label>
            <div className="chips">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  className={weekday === i ? "chip on" : "chip"}
                  onClick={() => setWeekday(i)}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>

            <label>Preferred time</label>
            <div className="chips">
              {HOURS.map((h) => (
                <button
                  key={h}
                  className={hour === h ? "chip on" : "chip"}
                  onClick={() => setHour(h)}
                >
                  {String(h).padStart(2, "0")}:00
                </button>
              ))}
            </div>

            <div className="summary">
              <div>
                <dt>Plan</dt>
                <dd>{chosen.name}</dd>
              </div>
              <div>
                <dt>Monthly</dt>
                <dd>{money(chosen.price)}</dd>
              </div>
              <div>
                <dt>Term</dt>
                <dd>3 months minimum</dd>
              </div>
              <div>
                <dt>Visits</dt>
                <dd>
                  {chosen.visits_per_month ?? 2} a month, {DAYS[weekday]}s at{" "}
                  {String(hour).padStart(2, "0")}:00
                </dd>
              </div>
            </div>

            <button
              className="go"
              onClick={subscribe}
              disabled={busy || !gate?.ok}
            >
              {busy
                ? "Taking you to secure checkout…"
                : `Start membership — ${money(chosen.price)}/month`}
            </button>
            <p className="small">
              Billed monthly for a minimum of three months. Your first payment is
              taken today, and your visits are scheduled straight away.
            </p>
            {err && <p className="no">{err}</p>}
          </section>
        )}

        <p className="alt">
          <span className="alt-sparkle">✦</span>
          <span>
            Just want a one-off visit? <a href="/book">Book a single service →</a>
          </span>
        </p>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background:
            radial-gradient(circle at 0% 2%, rgba(255, 193, 165, 0.18), transparent 29%),
            radial-gradient(circle at 100% 2%, rgba(205, 157, 255, 0.2), transparent 31%),
            #fff;
          color: #16202a;
          font-family: "Nunito", system-ui, sans-serif;
          padding: 0 20px 86px;
        }
        .inner {
          max-width: 1210px;
          margin: 0 auto;
          padding-top: 48px;
        }
        .membership-head {
          text-align: center;
          margin: 0 auto 38px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 12px;
          font-weight: 800;
          color: #ec4899;
          margin: 0 0 10px;
        }
        h1 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(34px, 5vw, 48px);
          line-height: 1.05;
          color: #16202a;
          margin: 0 0 18px;
        }
        .lede {
          color: #7a828c;
          font-size: 17px;
          margin: 0;
          line-height: 1.55;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          align-items: stretch;
        }
        .plan {
          --accent: #ec4899;
          --accent-soft: #fff1f7;
          --accent-line: #ffd1e4;
          position: relative;
          min-width: 0;
          background: rgba(255, 255, 255, 0.9);
          border: 1.5px solid #eceef2;
          border-radius: 18px;
          padding: 26px 24px 20px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 16px 38px rgba(27, 32, 42, 0.035);
          transition: transform 0.18s ease, border-color 0.18s ease,
            box-shadow 0.18s ease;
        }
        .plan:hover {
          transform: translateY(-3px);
          border-color: var(--accent-line);
          box-shadow: 0 18px 42px rgba(27, 32, 42, 0.07);
        }
        .plan.featured {
          border-color: #f09cc7;
        }
        .plan.on {
          border-color: var(--accent);
          box-shadow: 0 18px 42px color-mix(in srgb, var(--accent) 12%, transparent);
        }
        .tone-0 {
          --accent: #f43f82;
          --accent-soft: #fff0f6;
          --accent-line: #ffd0e0;
        }
        .tone-1 {
          --accent: #e83e9a;
          --accent-soft: #fff0f8;
          --accent-line: #f7b7d7;
        }
        .tone-2 {
          --accent: #8b5cf6;
          --accent-soft: #f6f0ff;
          --accent-line: #dfd0ff;
        }
        .tone-3 {
          --accent: #ff6846;
          --accent-soft: #fff3ed;
          --accent-line: #ffd8c8;
        }
        .pill {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(100deg, #ff8745, #ec4899 50%, #7c3aed);
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 999px;
          white-space: nowrap;
          box-shadow: 0 6px 14px rgba(124, 58, 237, 0.16);
        }
        .plan-icon {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: var(--accent-soft);
          color: var(--accent);
          margin-bottom: 16px;
        }
        .plan-icon :global(svg) {
          width: 27px;
          height: 27px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        h2 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: 20px;
          color: #16202a;
          margin: 0 0 7px;
        }
        .price {
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 31px;
          line-height: 1.2;
          margin: 0 0 4px;
          color: #16202a;
        }
        .price span {
          font-family: "Nunito", sans-serif;
          font-size: 13px;
          color: #8a919a;
        }
        .visits {
          font-size: 13px;
          font-weight: 800;
          color: var(--accent);
          margin: 0;
        }
        .divider {
          height: 1px;
          background: #eceef2;
          margin: 20px 0 18px;
        }
        .features,
        .know {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
        }
        .features {
          gap: 11px;
          margin-bottom: 20px;
        }
        .features li {
          position: relative;
          padding-left: 26px;
          color: #303843;
          font-size: 13px;
          line-height: 1.45;
        }
        .features li::before {
          content: "✓";
          position: absolute;
          left: 0;
          top: 0;
          width: 17px;
          height: 17px;
          display: grid;
          place-items: center;
          border: 1px solid var(--accent-line);
          border-radius: 50%;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 10px;
          font-weight: 900;
        }
        .good-box {
          margin-top: auto;
          margin-bottom: 18px;
          padding: 14px 14px 13px;
          border: 1px solid var(--accent-line);
          border-radius: 12px;
          background: color-mix(in srgb, var(--accent-soft) 56%, #fff);
        }
        .sub-head {
          font-size: 10.5px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin: 0 0 9px;
        }
        .know {
          gap: 7px;
        }
        .know li {
          position: relative;
          padding-left: 14px;
          color: #4e5660;
          font-size: 11.5px;
          line-height: 1.45;
        }
        .know li::before {
          content: "•";
          position: absolute;
          left: 1px;
          color: var(--accent);
          font-weight: 900;
        }
        .choose {
          width: 100%;
          min-height: 42px;
          border: 1px solid var(--accent-line);
          border-radius: 11px;
          background: var(--accent-soft);
          color: var(--accent);
          font: inherit;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .choose:hover {
          transform: translateY(-1px);
          filter: brightness(0.99);
        }
        .choose.primary {
          border-color: transparent;
          background: linear-gradient(100deg, #ff6938, #ef3f87 48%, #7c3aed);
          color: #fff;
          box-shadow: 0 8px 20px rgba(124, 58, 237, 0.13);
        }
        .setup {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #eceef2;
          border-radius: 20px;
          padding: 30px 28px;
          margin: 34px auto 0;
          max-width: 680px;
          box-shadow: 0 18px 42px rgba(27, 32, 42, 0.05);
        }
        .setup-kicker {
          margin: 0 0 6px;
          color: #ec4899;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10.5px;
          font-weight: 900;
        }
        .setup h2 {
          font-size: 25px;
          margin-bottom: 20px;
        }
        label {
          display: block;
          font-size: 13.5px;
          color: #7a828c;
          margin: 18px 0 8px;
        }
        .row {
          display: flex;
          gap: 10px;
        }
        input {
          flex: 1;
          min-width: 0;
          padding: 12px 14px;
          border: 1.5px solid #e5e7ea;
          border-radius: 12px;
          font: inherit;
          font-size: 15.5px;
          text-transform: uppercase;
          color: #16202a;
          background: #fff;
        }
        input:focus-visible {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.09);
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .chip {
          background: #fff;
          border: 1.5px solid #edeff1;
          border-radius: 999px;
          padding: 8px 14px;
          font: inherit;
          font-size: 13.5px;
          color: #16202a;
          cursor: pointer;
        }
        .chip.on {
          background: linear-gradient(100deg, #ff6938, #ef3f87 48%, #7c3aed);
          border-color: transparent;
          color: #fff;
          font-weight: 800;
        }
        .ghost {
          background: #fff;
          border: 1.5px solid #16202a;
          color: #16202a;
          border-radius: 12px;
          padding: 12px 18px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .ok,
        .no {
          font-size: 14px;
          padding: 10px 12px;
          border-radius: 10px;
          margin: 10px 0 0;
        }
        .ok {
          background: #f4ecfe;
          color: #16202a;
          font-weight: 700;
        }
        .no {
          background: #ffe6ea;
          color: #b0384f;
        }
        .summary {
          background: #fbf9fd;
          border: 1px solid #f0ebf5;
          border-radius: 14px;
          padding: 6px 18px;
          margin: 24px 0 20px;
        }
        .summary > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #edeff1;
        }
        .summary > div:last-child {
          border-bottom: none;
        }
        .summary dt {
          color: #7a828c;
          font-size: 13.5px;
        }
        .summary dd {
          margin: 0;
          font-weight: 700;
          font-size: 14.5px;
          text-align: right;
        }
        .go {
          width: 100%;
          background: linear-gradient(100deg, #ff6938, #ef3f87 48%, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 15px;
          font: inherit;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .go:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .small {
          font-size: 12.5px;
          color: #7a828c;
          text-align: center;
          margin: 12px 0 0;
        }
        .alt {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 34px 0 0;
          color: #8a919a;
          font-size: 15px;
        }
        .alt-sparkle {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 11px;
          background: #fff1f6;
          color: #ec4899;
          font-size: 18px;
        }
        .alt a {
          color: #16202a;
          font-weight: 900;
          text-decoration: none;
        }
        .alt a:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .muted {
          color: #7a828c;
        }

        @media (max-width: 1080px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 620px) {
          .wrap {
            padding-left: 14px;
            padding-right: 14px;
          }
          .inner {
            padding-top: 34px;
          }
          .membership-head {
            text-align: left;
            margin-bottom: 28px;
          }
          .lede br {
            display: none;
          }
          .grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .plan {
            padding: 24px 20px 18px;
          }
          .setup {
            padding: 24px 18px;
          }
          .row {
            flex-direction: column;
          }
          .alt {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
