"use client";

// Login — you choose which side you're logging into. No role guessing.
// Save at: app/login/page.tsx  →  localhost:3000/login

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// ▼ One-click demo logins use these. Both are Demo1234! if you ran the
//   password-reset SQL. Change here if your accounts use different ones.
const CLIENT_PW = "Demo1234!";
const WORKER_PW = "Demo1234!";

type Side = "client" | "provider";

export default function LoginPage() {
  const [side, setSide] = useState<Side>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn(em: string, pw: string, dest: string) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: em.trim(),
      password: pw,
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    // If they were sent here mid-booking, put them back.
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next || dest;
  }

  function submit() {
    // Route by what YOU picked — not by guessing.
    signIn(email, password, side === "client" ? "/account" : "/worker");
  }

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"
      />

      <div className="card">
        <a className="brand" href="/">
          Opulence&nbsp;Bliss
        </a>

        <p className="eyebrow">Log in</p>
        <h1>Which side are you?</h1>
        <p className="lede">Choose how you&apos;re signing in.</p>

        <div className="tabs">
          <button
            className={side === "client" ? "tab on" : "tab"}
            onClick={() => setSide("client")}
            type="button"
          >
            <strong>I&apos;m a client</strong>
            <small>Manage my membership &amp; bookings</small>
          </button>
          <button
            className={side === "provider" ? "tab on" : "tab"}
            onClick={() => setSide("provider")}
            type="button"
          >
            <strong>I&apos;m a provider</strong>
            <small>See and accept my jobs</small>
          </button>
        </div>

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
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <button className="go" onClick={submit} disabled={busy}>
          {busy
            ? "Signing in…"
            : side === "client"
            ? "Log in to my account"
            : "Log in to provider area"}
        </button>

        {err && <p className="err">{err}</p>}

        <div className="foot">
          <span>Quick demo login —</span>
          <button
            className="fill"
            type="button"
            disabled={busy}
            onClick={() => signIn("client@test.com", CLIENT_PW, "/account")}
          >
            log in as client
          </button>
          <button
            className="fill"
            type="button"
            disabled={busy}
            onClick={() => signIn("worker@test.com", WORKER_PW, "/worker")}
          >
            log in as worker
          </button>
        </div>

        <a className="home" href="/">
          ← Back to site
        </a>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #fff;
          color: #16202A;
          font-family: "Nunito", system-ui, sans-serif;
          display: grid;
          place-items: center;
          padding: 32px 20px;
        }
        .card {
          background: #fff;
          border: 1px solid #EDEFF1;
          border-radius: 20px;
          padding: 34px 32px;
          width: 100%;
          max-width: 470px;
          box-shadow: 0 16px 44px rgba(22,32,42, 0.1);
        }
        .brand {
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 19px;
          font-weight: 600;
          color: #16202A;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 22px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: #6D28D9;
          margin: 0 0 6px;
        }
        h1 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: 30px;
          color: #16202A;
          margin: 0 0 6px;
        }
        .lede {
          color: #7A828C;
          font-size: 15px;
          margin: 0 0 22px;
        }
        .tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
        }
        .tab {
          background: #FFFFFF;
          border: 1.5px solid #EDEFF1;
          border-radius: 14px;
          padding: 14px 14px;
          text-align: left;
          font: inherit;
          cursor: pointer;
          transition: border-color 0.16s ease, background 0.16s ease;
        }
        .tab:hover {
          border-color: #6D28D9;
        }
        .tab.on {
          border-color: #16202A;
          background: #F4ECFE;
        }
        .tab strong {
          display: block;
          color: #16202A;
          font-size: 15px;
          margin-bottom: 2px;
        }
        .tab small {
          color: #7A828C;
          font-size: 12.5px;
          line-height: 1.35;
          display: block;
        }
        label {
          display: block;
          font-size: 13.5px;
          color: #7A828C;
          margin: 0 0 6px;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1.5px solid #E5E7EA;
          border-radius: 12px;
          font: inherit;
          font-size: 15.5px;
          background: #fff;
          color: #16202A;
          margin-bottom: 16px;
        }
        input:focus-visible {
          outline: none;
          border-color: #16202A;
        }
        .go {
          width: 100%;
          background: linear-gradient(100deg,#F5C542,#C86FC9 55%,#7B2FF7);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 13px;
          font: inherit;
          font-weight: 600;
          font-size: 15.5px;
          cursor: pointer;
          margin-top: 4px;
        }
        .go:hover {
          background: #4C1D95;
        }
        .go:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .err {
          background: #FFE6EA;
          color: #B0384F;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14px;
          margin: 16px 0 0;
        }
        .foot {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #F1F2F4;
          font-size: 13px;
          color: #7A828C;
        }
        .fill {
          background: none;
          border: none;
          color: #6D28D9;
          font: inherit;
          font-size: 13px;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
        }
        .fill:hover {
          color: #16202A;
        }
        .home {
          display: inline-block;
          margin-top: 18px;
          color: #6D28D9;
          font-size: 14px;
          text-decoration: none;
        }
        @media (max-width: 460px) {
          .tabs {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
