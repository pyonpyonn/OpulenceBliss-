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
    window.location.href = dest;
  }

  function submit() {
    // Route by what YOU picked — not by guessing.
    signIn(email, password, side === "client" ? "/account" : "/worker");
  }

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap"
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
          background: #fbf7f0;
          color: #26302a;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          display: grid;
          place-items: center;
          padding: 32px 20px;
        }
        .card {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 20px;
          padding: 34px 32px;
          width: 100%;
          max-width: 470px;
          box-shadow: 0 16px 44px rgba(47, 74, 58, 0.1);
        }
        .brand {
          font-family: "Fraunces", serif;
          font-size: 19px;
          font-weight: 600;
          color: #2f4a3a;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 22px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: #cf854f;
          margin: 0 0 6px;
        }
        h1 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 30px;
          color: #2f4a3a;
          margin: 0 0 6px;
        }
        .lede {
          color: #6e7a70;
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
          background: #fbf7f0;
          border: 1.5px solid #ece5d8;
          border-radius: 14px;
          padding: 14px 14px;
          text-align: left;
          font: inherit;
          cursor: pointer;
          transition: border-color 0.16s ease, background 0.16s ease;
        }
        .tab:hover {
          border-color: #cf854f;
        }
        .tab.on {
          border-color: #2f4a3a;
          background: #e7eee7;
        }
        .tab strong {
          display: block;
          color: #2f4a3a;
          font-size: 15px;
          margin-bottom: 2px;
        }
        .tab small {
          color: #6e7a70;
          font-size: 12.5px;
          line-height: 1.35;
          display: block;
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
        .go {
          width: 100%;
          background: #2f4a3a;
          color: #fbf7f0;
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
          background: #263d30;
        }
        .go:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .err {
          background: #f6e7dd;
          color: #8a4b26;
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
          border-top: 1px solid #f0ebe0;
          font-size: 13px;
          color: #6e7a70;
        }
        .fill {
          background: none;
          border: none;
          color: #5b7a65;
          font: inherit;
          font-size: 13px;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
        }
        .fill:hover {
          color: #2f4a3a;
        }
        .home {
          display: inline-block;
          margin-top: 18px;
          color: #5b7a65;
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