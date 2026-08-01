"use client";

// Opulence Bliss — full booking funnel (prototype)
// Replace your entire app/book/page.tsx with this file.
// Flow: choose package → postcode gate → slot (placeholder) → confirm → Stripe.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  inclusions: string[] | null;
  price: number;
  frequency: string | null;
  service_type: string | null;
  duration_minutes: number | null;
  good_to_know: string[] | null;
};

type Area = { name: string; postcode_prefixes: string[] };

const STEPS = ["Service", "Postcode", "Slot", "Confirm"];

// "SW3 1AA" -> "SW3", "W14 8XY" -> "W14"
function outwardCode(pc: string) {
  const s = pc.toUpperCase().replace(/\s+/g, "");
  if (s.length <= 4) return s;
  return s.slice(0, s.length - 3);
}

function money(n: number) {
  return "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

function duration(mins: number | null) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} min`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fullLabel(iso: string) {
  return `${dayLabel(iso)}, ${timeLabel(iso)}`;
}

export default function BookPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Pkg | null>(null);
  const [postcode, setPostcode] = useState("");
  const [gate, setGate] = useState<null | { ok: boolean; area?: string }>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [slotDay, setSlotDay] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<
    { iso: string; reason: string }[]
  >([]);
  const [role, setRole] = useState<string | null>(null);
  const [promo, setPromo] = useState("");
  const [promoInfo, setPromoInfo] = useState<{
    ok: boolean;
    msg: string;
    discount?: number;
    total?: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: pkgs }, { data: ars }] = await Promise.all([
        supabase
          .from("packages")
          .select("*")
          .eq("active", true)
          .eq("billing_type", "per_visit")
          .order("price"),
        supabase
          .from("service_areas")
          .select("name, postcode_prefixes")
          .eq("active", true),
      ]);
      const list = (pkgs ?? []) as Pkg[];
      setPackages(list);
      setAreas((ars ?? []) as Area[]);

      // Repeat booking / assistant handoff:
      //   /book?service=<id>&pc=<postcode>&slot=<iso>
      const params = new URLSearchParams(window.location.search);
      const wantService = params.get("service");
      const wantPc = params.get("pc");
      const wantSlot = params.get("slot");
      if (wantPc) setPostcode(wantPc);
      if (wantService) {
        const match = list.find((p) => p.id === wantService);
        if (match) {
          setSelected(match);
          if (wantSlot && wantPc) {
            // Everything's known — go straight to confirm.
            setSlot(wantSlot);
            setSlotDay(dayKey(wantSlot));
            setGate({ ok: true });
            setStep(3);
          } else {
            setStep(1);
          }
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("role, postcode")
          .eq("id", user.id)
          .maybeSingle();
        setRole(p?.role ?? null);
        if (p?.postcode) setPostcode(p.postcode);
      }

      setLoading(false);
    })();
  }, []);

  function pick(p: Pkg) {
    setSelected(p);
    setStep(1);
  }

  function checkPostcode() {
    const out = outwardCode(postcode);
    const match = areas.find((a) => a.postcode_prefixes.includes(out));
    setGate(match ? { ok: true, area: match.name } : { ok: false });
  }

  async function goToSlots() {
    setStep(2);
    setSlots(null);
    setSlot(null);
    setSlotDay(null);
    setSuggested([]);
    try {
      const res = await fetch(
        `/api/slots?postcode=${encodeURIComponent(postcode)}&service=${encodeURIComponent(
          selected?.service_type ?? ""
        )}`
      );
      const data = await res.json();
      const list: string[] = data.slots ?? [];
      setSlots(list);
      setSuggested(data.suggested ?? []);
      if (list.length) setSlotDay(dayKey(list[0]));
    } catch {
      setSlots([]);
    }
  }

  async function checkPromo() {
    if (!selected) return;
    setPromoInfo(null);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo, packageId: selected.id }),
      });
      const d = await res.json();
      setPromoInfo(
        d.valid
          ? {
              ok: true,
              msg: `${d.code} applied — £${d.discount.toFixed(2)} off`,
              discount: d.discount,
              total: d.total,
            }
          : { ok: false, msg: d.error ?? "That code isn't valid." }
      );
    } catch {
      setPromoInfo({ ok: false, msg: "Couldn't check that code." });
    }
  }

  async function checkout() {
    if (!selected) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selected.id,
          postcode,
          request,
          slot,
          promoCode: promoInfo?.ok ? promo.trim().toUpperCase() : null,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Could not start checkout");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Checkout failed");
      setPaying(false);
    }
  }

  // A provider shouldn't be shopping for memberships.
  if (role === "provider") {
    return (
      <main
        style={{
          minHeight: "80vh",
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
            padding: "36px 34px",
            maxWidth: 440,
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
            Provider account
          </p>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
              fontSize: 27,
              color: "#2f4a3a",
              margin: "0 0 8px",
            }}
          >
            This is the client booking page
          </h1>
          <p style={{ color: "#6e7a70", margin: "0 0 24px" }}>
            You&apos;re signed in as a provider. Your jobs and working hours are
            in the provider area.
          </p>
          <a
            href="/worker"
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
            Go to my jobs
          </a>
          <p style={{ marginTop: 18 }}>
            <a
              href="/worker/availability"
              style={{ color: "#5b7a65", fontSize: 14 }}
            >
              Set my availability
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="funnel">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&display=swap"
      />

      <header className="top">
        <span className="brand">Opulence Bliss</span>
        <ol className="steps" aria-label="Booking steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={i === step ? "on" : i < step ? "done" : ""}
            >
              <span className="dot">{i < step ? "✓" : i + 1}</span>
              <span className="lbl">{label}</span>
            </li>
          ))}
        </ol>
      </header>

      <main className="stage">
        {/* STEP 0 — choose a package */}
        {step === 0 && (
          <section>
            <p className="eyebrow">Step one</p>
            <h1>Choose your service</h1>
            <p className="lede">
              Vetted cleaners and massage therapists, at your home. Pay per
              visit — no membership, no lock-in.
            </p>

            {loading ? (
              <p className="muted">Loading packages…</p>
            ) : (
              <div className="grid">
                {packages.map((p) => (
                  <article key={p.id} className="card">
                    <div className="card-top">
                      <h2>{p.name}</h2>
                      {p.service_type && (
                        <span className="type">{p.service_type}</span>
                      )}
                    </div>

                    <p className="price">
                      {money(p.price)} <span>per visit</span>
                    </p>

                    {p.duration_minutes && (
                      <p className="dur">⏱ {duration(p.duration_minutes)} at your home</p>
                    )}

                    {p.description && <p className="desc">{p.description}</p>}

                    {p.inclusions && p.inclusions.length > 0 && (
                      <>
                        <p className="sub-head">What&apos;s included</p>
                        <ul>
                          {p.inclusions.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {p.good_to_know && p.good_to_know.length > 0 && (
                      <>
                        <p className="sub-head">Good to know</p>
                        <ul className="know">
                          {p.good_to_know.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    <button className="cta" onClick={() => pick(p)}>
                      Choose this service
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP 1 — postcode gate */}
        {step === 1 && selected && (
          <section className="narrow">
            <p className="eyebrow">Step two</p>
            <h1>Do we cover your home?</h1>
            <p className="lede">
              You chose <strong>{selected.name}</strong>. Enter your postcode to
              check availability.
            </p>

            <div className="pc-row">
              <input
                className="pc"
                placeholder="e.g. SW3 1AA"
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value);
                  setGate(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && checkPostcode()}
                aria-label="Postcode"
              />
              <button className="cta" onClick={checkPostcode}>
                Check availability
              </button>
            </div>

            {gate?.ok && (
              <div className="note ok">
                <strong>Good news — we cover {gate.area}.</strong>
                <button className="cta" onClick={goToSlots}>
                  Continue
                </button>
              </div>
            )}
            {gate && !gate.ok && (
              <div className="note no">
                We&apos;re not in your area just yet. Try another postcode, or
                leave your details and we&apos;ll tell you when we arrive.
              </div>
            )}

            <button className="back" onClick={() => setStep(0)}>
              ← Back to packages
            </button>
          </section>
        )}

        {/* STEP 2 — real slot picker */}
        {step === 2 && (
          <section className="narrow">
            <p className="eyebrow">Step three</p>
            <h1>Choose your slot</h1>
            <p className="lede">
              These are the times a vetted provider is free in your area.
            </p>

            {slots === null && <p className="muted">Finding available times…</p>}

            {slots !== null && slots.length === 0 && (
              <div className="note no">
                No times available in your area just yet. We&apos;ll be in touch
                as soon as a provider opens up.
              </div>
            )}

            {slots !== null && slots.length > 0 && (
              <>
                {suggested.length > 0 && (
                  <>
                    <p className="sug-title">Suggested for you</p>
                    <div className="sug-row">
                      {suggested.map((s) => (
                        <button
                          key={s.iso}
                          className={slot === s.iso ? "sug on" : "sug"}
                          onClick={() => {
                            setSlot(s.iso);
                            setSlotDay(dayKey(s.iso));
                          }}
                        >
                          <strong>{fullLabel(s.iso)}</strong>
                          <small>{s.reason}</small>
                        </button>
                      ))}
                    </div>
                    <p className="sug-or">or pick your own time</p>
                  </>
                )}

                <div className="days">
                  {[...new Set(slots.map(dayKey))].map((k) => {
                    const first = slots.find((s) => dayKey(s) === k)!;
                    return (
                      <button
                        key={k}
                        className={slotDay === k ? "day on" : "day"}
                        onClick={() => {
                          setSlotDay(k);
                          setSlot(null);
                        }}
                      >
                        {dayLabel(first)}
                      </button>
                    );
                  })}
                </div>

                <div className="times">
                  {slots
                    .filter((s) => dayKey(s) === slotDay)
                    .map((s) => (
                      <button
                        key={s}
                        className={slot === s ? "time on" : "time"}
                        onClick={() => setSlot(s)}
                      >
                        {timeLabel(s)}
                      </button>
                    ))}
                </div>

                <button
                  className="cta"
                  onClick={() => setStep(3)}
                  disabled={!slot}
                >
                  {slot ? `Continue with ${fullLabel(slot)}` : "Pick a time"}
                </button>
              </>
            )}

            <button className="back" onClick={() => setStep(1)}>
              ← Back
            </button>
          </section>
        )}

        {/* STEP 3 — confirm + pay */}
        {step === 3 && selected && (
          <section className="narrow">
            <p className="eyebrow">Step four</p>
            <h1>Confirm your booking</h1>

            <dl className="summary">
              <div>
                <dt>Service</dt>
                <dd>{selected.name}</dd>
              </div>
              {selected.duration_minutes && (
                <div>
                  <dt>Duration</dt>
                  <dd>{duration(selected.duration_minutes)}</dd>
                </div>
              )}
              <div>
                <dt>Total</dt>
                <dd>{money(selected.price)}</dd>
              </div>
              <div>
                <dt>Postcode</dt>
                <dd>{postcode.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Schedule</dt>
                <dd>{slot ? fullLabel(slot) : "To be arranged"}</dd>
              </div>
            </dl>

            <label className="req-label">
              Any requests? <span>(optional)</span>
            </label>
            <textarea
              className="req"
              placeholder="e.g. please send the same cleaner each visit, or I prefer mornings"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
            />

            <label className="req-label">
              Promo code <span>(optional)</span>
            </label>
            <div className="pc-row" style={{ marginBottom: 8 }}>
              <input
                className="pc"
                placeholder="e.g. WELCOME10"
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  setPromoInfo(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && checkPromo()}
                aria-label="Promo code"
              />
              <button className="cta" onClick={checkPromo}>
                Apply
              </button>
            </div>
            {promoInfo && (
              <p className={promoInfo.ok ? "promo ok" : "promo no"}>
                {promoInfo.msg}
                {promoInfo.ok && promoInfo.total !== undefined
                  ? ` · you pay £${promoInfo.total.toFixed(2)}`
                  : ""}
              </p>
            )}

            <button className="cta pay" onClick={checkout} disabled={paying}>
              {paying ? "Taking you to secure checkout…" : "Proceed to payment"}
            </button>
            {payError && <div className="note no">{payError}</div>}

            <button className="back" onClick={() => setStep(2)}>
              ← Back
            </button>
          </section>
        )}
      </main>

      <style jsx>{`
        .funnel {
          --cream: #fbf7f0;
          --green: #2f4a3a;
          --green-mid: #5b7a65;
          --green-pale: #e7eee7;
          --apricot: #e7a579;
          --apricot-deep: #cf854f;
          --ink: #26302a;
          --muted: #6e7a70;
          min-height: 100vh;
          background: var(--cream);
          color: var(--ink);
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          padding: 0 20px 80px;
        }
        .top {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 0;
          flex-wrap: wrap;
        }
        .brand {
          font-family: "Fraunces", serif;
          font-size: 22px;
          font-weight: 600;
          color: var(--green);
          letter-spacing: 0.2px;
        }
        .steps {
          display: flex;
          gap: 22px;
          list-style: none;
          margin: 0;
          padding: 0;
          flex-wrap: wrap;
        }
        .steps li {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 14px;
        }
        .steps .dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 1.5px solid #d8d2c6;
          font-size: 13px;
          font-weight: 600;
        }
        .steps li.on {
          color: var(--green);
          font-weight: 600;
        }
        .steps li.on .dot {
          border-color: var(--green);
          background: var(--green);
          color: var(--cream);
        }
        .steps li.done .dot {
          border-color: var(--green-mid);
          background: var(--green-pale);
          color: var(--green);
        }
        .stage {
          max-width: 960px;
          margin: 0 auto;
        }
        .narrow {
          max-width: 560px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: var(--apricot-deep);
          margin: 12px 0 6px;
        }
        h1 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: clamp(30px, 5vw, 44px);
          line-height: 1.08;
          margin: 0 0 10px;
          color: var(--green);
        }
        h2 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 24px;
          margin: 0 0 4px;
          color: var(--green);
        }
        .lede {
          font-size: 17px;
          color: var(--muted);
          margin: 0 0 28px;
          max-width: 46ch;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 20px;
        }
        .card {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 18px;
          padding: 26px 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 2px rgba(47, 74, 58, 0.04);
          transition: transform 0.18s ease, box-shadow 0.18s ease,
            border-color 0.18s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(47, 74, 58, 0.1);
          border-color: var(--apricot);
        }
        .price {
          font-family: "Fraunces", serif;
          font-size: 30px;
          color: var(--ink);
          margin: 0 0 12px;
        }
        .price span {
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 14px;
          color: var(--muted);
        }
        .desc {
          font-size: 14.5px;
          color: var(--muted);
          margin: 0 0 14px;
        }
        .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .type {
          background: var(--green-pale);
          color: var(--green);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
          white-space: nowrap;
          margin-top: 4px;
        }
        .dur {
          font-size: 14px;
          color: var(--green-mid);
          margin: 0 0 14px;
        }
        .sub-head {
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--apricot-deep);
          margin: 0 0 8px;
        }
        .card ul.know li::before {
          content: "•";
          color: var(--green-mid);
        }
        .card ul.know li {
          color: var(--muted);
          font-size: 13.5px;
        }
        .card ul {
          list-style: none;
          padding: 0;
          margin: 0 0 22px;
          display: grid;
          gap: 8px;
        }
        .card li {
          font-size: 14px;
          padding-left: 22px;
          position: relative;
          color: var(--ink);
        }
        .card li::before {
          content: "✿";
          position: absolute;
          left: 0;
          color: var(--apricot);
          font-size: 12px;
          top: 2px;
        }
        .cta {
          margin-top: auto;
          background: var(--green);
          color: var(--cream);
          border: none;
          border-radius: 999px;
          padding: 13px 22px;
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease;
        }
        .cta:hover {
          background: #263d30;
        }
        .cta:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .cta.pay {
          background: var(--apricot-deep);
        }
        .cta.pay:hover {
          background: #ba7440;
        }
        .cta:focus-visible {
          outline: 3px solid var(--apricot);
          outline-offset: 2px;
        }
        .pc-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pc {
          flex: 1;
          min-width: 200px;
          padding: 13px 16px;
          border: 1.5px solid #d8d2c6;
          border-radius: 12px;
          font-size: 16px;
          font-family: inherit;
          background: #fff;
          color: var(--ink);
          text-transform: uppercase;
        }
        .pc:focus-visible {
          outline: none;
          border-color: var(--green);
        }
        .note {
          margin: 20px 0;
          padding: 16px 18px;
          border-radius: 12px;
          font-size: 15px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: flex-start;
        }
        .note.ok {
          background: var(--green-pale);
          color: var(--green);
        }
        .note.no {
          background: #f6e7dd;
          color: #8a4b26;
        }
        .note .cta {
          margin-top: 0;
        }
        .placeholder {
          background: #fff;
          border: 1.5px dashed #d8cfbe;
          border-radius: 14px;
          padding: 34px 24px;
          text-align: center;
          color: var(--muted);
          margin: 8px 0 22px;
        }
        .days {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 6px;
          margin: 4px 0 18px;
        }
        .sug-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--apricot-deep);
          margin: 4px 0 10px;
        }
        .sug-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }
        .sug {
          background: #fff;
          border: 1.5px solid var(--apricot);
          border-radius: 14px;
          padding: 14px 16px;
          text-align: left;
          font: inherit;
          cursor: pointer;
          transition: background 0.16s ease;
        }
        .sug:hover {
          background: #fdf6f0;
        }
        .sug.on {
          background: var(--green-pale);
          border-color: var(--green);
        }
        .sug strong {
          display: block;
          color: var(--green);
          font-size: 15px;
          margin-bottom: 2px;
        }
        .sug small {
          color: var(--muted);
          font-size: 12.5px;
        }
        .sug-or {
          font-size: 13.5px;
          color: var(--muted);
          margin: 0 0 10px;
        }
        .day {
          flex: 0 0 auto;
          background: #fff;
          border: 1.5px solid #ece5d8;
          border-radius: 12px;
          padding: 10px 16px;
          font: inherit;
          font-size: 14px;
          color: var(--ink);
          cursor: pointer;
          white-space: nowrap;
        }
        .day:hover {
          border-color: var(--apricot);
        }
        .day.on {
          background: var(--green);
          border-color: var(--green);
          color: var(--cream);
          font-weight: 600;
        }
        .times {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
          gap: 10px;
          margin-bottom: 24px;
        }
        .time {
          background: #fff;
          border: 1.5px solid #ece5d8;
          border-radius: 12px;
          padding: 12px 8px;
          font: inherit;
          font-size: 15px;
          color: var(--ink);
          cursor: pointer;
        }
        .time:hover {
          border-color: var(--apricot);
        }
        .time.on {
          background: var(--green-pale);
          border-color: var(--green);
          color: var(--green);
          font-weight: 600;
        }
        .summary {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 16px;
          padding: 8px 22px;
          margin: 8px 0 24px;
        }
        .summary > div {
          display: flex;
          justify-content: space-between;
          padding: 15px 0;
          border-bottom: 1px solid #f0ebe0;
        }
        .summary > div:last-child {
          border-bottom: none;
        }
        .summary dt {
          color: var(--muted);
          font-size: 14px;
        }
        .summary dd {
          margin: 0;
          font-weight: 600;
          color: var(--ink);
        }
        .req-label {
          display: block;
          font-size: 14px;
          color: var(--muted);
          margin: 0 0 8px;
        }
        .req-label span {
          color: #a89f90;
        }
        .req {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1.5px solid #d8d2c6;
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          background: #fff;
          color: var(--ink);
          resize: vertical;
          margin-bottom: 20px;
        }
        .req:focus-visible {
          outline: none;
          border-color: var(--green);
        }
        .promo {
          font-size: 14px;
          padding: 10px 12px;
          border-radius: 10px;
          margin: 0 0 18px;
        }
        .promo.ok {
          background: var(--green-pale);
          color: var(--green);
          font-weight: 600;
        }
        .promo.no {
          background: #f6e7dd;
          color: #8a4b26;
        }
        .back {
          display: inline-block;
          margin-top: 22px;
          background: none;
          border: none;
          color: var(--green-mid);
          font-family: inherit;
          font-size: 14px;
          cursor: pointer;
          padding: 6px 0;
        }
        .back:hover {
          color: var(--green);
        }
        .muted {
          color: var(--muted);
        }
        @media (prefers-reduced-motion: reduce) {
          .card {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}