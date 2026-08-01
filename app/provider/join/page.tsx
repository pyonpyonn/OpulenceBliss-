"use client";

// Become a provider — sign up, then pay the one-off £150 joining fee.
// Save at: app/provider/join/page.tsx  →  localhost:3000/provider/join

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Area = { id: string; name: string; postcode_prefixes: string[] };

const SKILLS = [
  { key: "cleaning", label: "Home cleaning" },
  { key: "massage", label: "Massage therapy" },
];

export default function ProviderJoinPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("service_areas")
        .select("id, name, postcode_prefixes")
        .eq("active", true);
      setAreas(data ?? []);
    })();
  }, []);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function submit() {
    setBusy(true);
    setErr(null);

    try {
      // 1. Create the provider account
      setStep("Creating your account…");
      const res = await fetch("/api/provider-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email: email.trim(),
          password,
          phone,
          skills,
          areaIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sign-up failed");

      // 2. Sign them in
      setStep("Signing you in…");
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) throw new Error(signInErr.message);

      // 3. Straight to the £150 payment
      setStep("Taking you to secure checkout…");
      const pay = await fetch("/api/provider-join", { method: "POST" });
      const payData = await pay.json();
      if (payData.url) {
        window.location.href = payData.url;
        return;
      }
      // Paid already, or payment couldn't start — send them to their dashboard
      window.location.href = "/worker";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setStep("");
    }
  }

  const ready =
    fullName && email && password.length >= 6 && skills.length && areaIds.length;

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap"
      />

      <div className="grid">
        {/* ---- The pitch ---- */}
        <section className="pitch">
          <a className="brand" href="/">
            Opulence&nbsp;Bliss
          </a>
          <p className="eyebrow">Work with us</p>
          <h1>Good work, fair pay, your own hours.</h1>
          <p className="lede">
            Join our vetted network of cleaners and massage therapists across
            London. You set your availability — we bring you the clients.
          </p>

          <div className="fee">
            <p className="fee-amount">
              £150 <span>one-off joining fee</span>
            </p>
            <p className="fee-note">
              Paid once when you join. Not a subscription — there&apos;s nothing
              monthly.
            </p>
            <ul>
              <li>Background check &amp; onboarding</li>
              <li>Your profile live on the platform</li>
              <li>Jobs matched to your skills and area</li>
              <li>Paid automatically after each visit</li>
            </ul>
          </div>

          <ol className="steps">
            <li>
              <span>1</span> Sign up and pay the £150 joining fee
            </li>
            <li>
              <span>2</span> Set the days and hours you work
            </li>
            <li>
              <span>3</span> Accept jobs and get paid per visit
            </li>
          </ol>

          <p className="already">
            Already a provider? <a href="/login">Log in</a>
          </p>
        </section>

        {/* ---- The form ---- */}
        <section className="form">
          <h2>Create your provider account</h2>

          <label>Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
          />

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />

          <label>Phone (optional)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07700 900000"
          />

          <label>What do you offer?</label>
          <div className="checks">
            {SKILLS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={skills.includes(s.key) ? "chk on" : "chk"}
                onClick={() => setSkills((l) => toggle(l, s.key))}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label>Where do you work?</label>
          <div className="checks">
            {areas.length === 0 ? (
              <span className="muted">Loading areas…</span>
            ) : (
              areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={areaIds.includes(a.id) ? "chk on" : "chk"}
                  onClick={() => setAreaIds((l) => toggle(l, a.id))}
                  title={(a.postcode_prefixes ?? []).join(", ")}
                >
                  {a.name}
                </button>
              ))
            )}
          </div>

          <button className="go" onClick={submit} disabled={busy || !ready}>
            {busy ? step || "Working…" : "Sign up & pay £150"}
          </button>
          <p className="small">
            You&apos;ll be taken to Stripe to pay securely. Your account is
            active as soon as the fee clears.
          </p>

          {err && <p className="err">{err}</p>}
        </section>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #fbf7f0;
          color: #26302a;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          padding: 0 20px 70px;
        }
        .grid {
          max-width: 1040px;
          margin: 0 auto;
          padding-top: 44px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
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
          font-size: clamp(32px, 4.6vw, 46px);
          line-height: 1.06;
          color: #2f4a3a;
          margin: 0 0 14px;
        }
        h2 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 24px;
          color: #2f4a3a;
          margin: 0 0 20px;
        }
        .lede {
          color: #6e7a70;
          font-size: 17px;
          line-height: 1.6;
          margin: 0 0 26px;
        }
        .fee {
          background: #fff;
          border: 1.5px solid #e7a579;
          border-radius: 18px;
          padding: 24px 26px;
          margin-bottom: 26px;
        }
        .fee-amount {
          font-family: "Fraunces", serif;
          font-size: 34px;
          color: #2f4a3a;
          margin: 0 0 4px;
        }
        .fee-amount span {
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 14px;
          color: #6e7a70;
        }
        .fee-note {
          color: #6e7a70;
          font-size: 14px;
          margin: 0 0 16px;
        }
        .fee ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .fee li {
          font-size: 14.5px;
          padding-left: 22px;
          position: relative;
        }
        .fee li::before {
          content: "✿";
          position: absolute;
          left: 0;
          color: #e7a579;
          font-size: 12px;
        }
        .steps {
          list-style: none;
          padding: 0;
          margin: 0 0 22px;
          display: grid;
          gap: 12px;
        }
        .steps li {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          color: #26302a;
        }
        .steps span {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #e7eee7;
          color: #2f4a3a;
          font-family: "Fraunces", serif;
          font-size: 14px;
        }
        .already {
          font-size: 14.5px;
          color: #6e7a70;
        }
        .already a {
          color: #2f4a3a;
          font-weight: 600;
        }
        .form {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 20px;
          padding: 32px 30px;
          box-shadow: 0 16px 44px rgba(47, 74, 58, 0.09);
        }
        label {
          display: block;
          font-size: 13.5px;
          color: #6e7a70;
          margin: 0 0 6px;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1.5px solid #d8d2c6;
          border-radius: 12px;
          font: inherit;
          font-size: 15.5px;
          background: #fff;
          color: #26302a;
          margin-bottom: 16px;
        }
        input:focus-visible {
          outline: none;
          border-color: #2f4a3a;
        }
        .checks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 18px;
        }
        .chk {
          background: #fbf7f0;
          border: 1.5px solid #ece5d8;
          border-radius: 999px;
          padding: 9px 16px;
          font: inherit;
          font-size: 14px;
          color: #26302a;
          cursor: pointer;
        }
        .chk:hover {
          border-color: #cf854f;
        }
        .chk.on {
          background: #e7eee7;
          border-color: #2f4a3a;
          color: #2f4a3a;
          font-weight: 600;
        }
        .go {
          width: 100%;
          background: #cf854f;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 14px;
          font: inherit;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          margin-top: 6px;
        }
        .go:hover:not(:disabled) {
          background: #ba7440;
        }
        .go:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .small {
          font-size: 12.5px;
          color: #6e7a70;
          text-align: center;
          margin: 12px 0 0;
        }
        .err {
          background: #f6e7dd;
          color: #8a4b26;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14px;
          margin: 16px 0 0;
        }
        .muted {
          color: #6e7a70;
          font-size: 14px;
        }
        @media (max-width: 880px) {
          .grid {
            grid-template-columns: 1fr;
            gap: 34px;
          }
        }
      `}</style>
    </main>
  );
}