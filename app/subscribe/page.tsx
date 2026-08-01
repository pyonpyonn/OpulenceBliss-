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
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap"
      />

      <div className="inner">
        <a className="brand" href="/">
          Opulence&nbsp;Bliss
        </a>
        <p className="eyebrow">Memberships</p>
        <h1>Regular care, handled</h1>
        <p className="lede">
          A three-month membership with your visits scheduled automatically.
          Billed monthly, same trusted team each time.
        </p>

        {/* Plans */}
        <div className="grid">
          {plans.length === 0 ? (
            <p className="muted">Loading memberships…</p>
          ) : (
            plans.map((p, i) => (
              <article
                key={p.id}
                className={
                  chosen?.id === p.id
                    ? "plan on"
                    : i === 1
                    ? "plan featured"
                    : "plan"
                }
                onClick={() => setChosen(p)}
              >
                {i === 1 && chosen?.id !== p.id && (
                  <span className="pill">Most chosen</span>
                )}
                <h2>{p.name}</h2>
                <p className="price">
                  {money(p.price)} <span>/ month</span>
                </p>
                <p className="visits">
                  {p.visits_per_month ?? 2} visits a month
                </p>
                {p.description && <p className="desc">{p.description}</p>}
                {p.inclusions && (
                  <ul>
                    {p.inclusions.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
                {p.good_to_know && (
                  <>
                    <p className="sub-head">Good to know</p>
                    <ul className="know">
                      {p.good_to_know.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </>
                )}
                <span className="choose">
                  {chosen?.id === p.id ? "Selected ✓" : "Select"}
                </span>
              </article>
            ))
          )}
        </div>

        {/* Set up */}
        {chosen && (
          <section className="setup">
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
          Just want a one-off visit? <a href="/book">Book a single service →</a>
        </p>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #fbf7f0;
          color: #26302a;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          padding: 0 20px 80px;
        }
        .inner {
          max-width: 1040px;
          margin: 0 auto;
          padding-top: 40px;
        }
        .brand {
          font-family: "Fraunces", serif;
          font-size: 19px;
          font-weight: 600;
          color: #2f4a3a;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 26px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: #cf854f;
          margin: 0 0 8px;
        }
        h1 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: clamp(32px, 5vw, 46px);
          color: #2f4a3a;
          margin: 0 0 12px;
        }
        .lede {
          color: #6e7a70;
          font-size: 17px;
          max-width: 52ch;
          margin: 0 0 34px;
          line-height: 1.6;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 18px;
        }
        .plan {
          position: relative;
          background: #fff;
          border: 1.5px solid #ece5d8;
          border-radius: 18px;
          padding: 26px 24px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          transition: border-color 0.16s ease, transform 0.16s ease;
        }
        .plan:hover {
          border-color: #cf854f;
          transform: translateY(-2px);
        }
        .plan.featured {
          border-color: #e7a579;
        }
        .plan.on {
          border-color: #2f4a3a;
          box-shadow: 0 12px 32px rgba(47, 74, 58, 0.12);
        }
        .pill {
          position: absolute;
          top: -11px;
          left: 22px;
          background: #cf854f;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 999px;
        }
        h2 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 22px;
          color: #2f4a3a;
          margin: 0 0 6px;
        }
        .price {
          font-family: "Fraunces", serif;
          font-size: 28px;
          margin: 0 0 2px;
        }
        .price span {
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 13.5px;
          color: #6e7a70;
        }
        .visits {
          font-size: 13.5px;
          color: #5b7a65;
          margin: 0 0 12px;
        }
        .desc {
          font-size: 14.5px;
          color: #6e7a70;
          margin: 0 0 14px;
        }
        .sub-head {
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #cf854f;
          margin: 14px 0 8px;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0 0 8px;
          display: grid;
          gap: 7px;
        }
        li {
          font-size: 14px;
          padding-left: 18px;
          position: relative;
        }
        li::before {
          content: "·";
          position: absolute;
          left: 5px;
          color: #cf854f;
          font-weight: 700;
        }
        ul.know li {
          color: #6e7a70;
          font-size: 13px;
        }
        .choose {
          margin-top: auto;
          padding-top: 16px;
          font-size: 14px;
          font-weight: 600;
          color: #2f4a3a;
        }
        .setup {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 20px;
          padding: 30px 28px;
          margin-top: 30px;
          max-width: 620px;
        }
        .setup h2 {
          font-size: 24px;
          margin-bottom: 20px;
        }
        label {
          display: block;
          font-size: 13.5px;
          color: #6e7a70;
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
          border: 1.5px solid #d8d2c6;
          border-radius: 12px;
          font: inherit;
          font-size: 15.5px;
          text-transform: uppercase;
          color: #26302a;
        }
        input:focus-visible {
          outline: none;
          border-color: #2f4a3a;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .chip {
          background: #fbf7f0;
          border: 1.5px solid #ece5d8;
          border-radius: 999px;
          padding: 8px 14px;
          font: inherit;
          font-size: 13.5px;
          color: #26302a;
          cursor: pointer;
        }
        .chip.on {
          background: #2f4a3a;
          border-color: #2f4a3a;
          color: #fbf7f0;
          font-weight: 600;
        }
        .ghost {
          background: none;
          border: 1.5px solid #2f4a3a;
          color: #2f4a3a;
          border-radius: 12px;
          padding: 12px 18px;
          font: inherit;
          font-weight: 600;
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
          background: #e7eee7;
          color: #2f4a3a;
          font-weight: 600;
        }
        .no {
          background: #f6e7dd;
          color: #8a4b26;
        }
        .summary {
          background: #fbf7f0;
          border-radius: 14px;
          padding: 6px 18px;
          margin: 24px 0 20px;
        }
        .summary > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #ece5d8;
        }
        .summary > div:last-child {
          border-bottom: none;
        }
        .summary dt {
          color: #6e7a70;
          font-size: 13.5px;
        }
        .summary dd {
          margin: 0;
          font-weight: 600;
          font-size: 14.5px;
          text-align: right;
        }
        .go {
          width: 100%;
          background: #2f4a3a;
          color: #fbf7f0;
          border: none;
          border-radius: 999px;
          padding: 15px;
          font: inherit;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .go:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .small {
          font-size: 12.5px;
          color: #6e7a70;
          text-align: center;
          margin: 12px 0 0;
        }
        .alt {
          margin-top: 34px;
          color: #6e7a70;
          font-size: 15px;
        }
        .alt a {
          color: #2f4a3a;
          font-weight: 600;
        }
        .muted {
          color: #6e7a70;
        }
      `}</style>
    </main>
  );
}