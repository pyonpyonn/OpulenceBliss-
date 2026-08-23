"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next || dest;
  }

  function submit() {
    signIn(email, password, side === "client" ? "/account" : "/worker");
  }

  return (
    <main className="ob-auth-shell">
      <section className="ob-auth-card">
        <div className="ob-auth-brand-row">
          <a className="ob-auth-brand" href="/">
            opulence<span>bliss</span>
          </a>
          <a className="ob-auth-back" href="/">Back to site</a>
        </div>

        <div className="ob-auth-intro">
          <p className="ob-auth-kicker">Welcome back</p>
          <h1>Your care, one beautiful place.</h1>
          <p>
            Sign in to manage bookings, memberships, availability and your Opulence Bliss account.
          </p>
        </div>

        <div className="ob-auth-tabs" aria-label="Account type">
          <button
            className={side === "client" ? "ob-auth-tab active" : "ob-auth-tab"}
            onClick={() => setSide("client")}
            type="button"
          >
            <span className="ob-auth-tab-icon">♡</span>
            <span>
              <strong>Client</strong>
              <small>Bookings & membership</small>
            </span>
          </button>
          <button
            className={side === "provider" ? "ob-auth-tab active" : "ob-auth-tab"}
            onClick={() => setSide("provider")}
            type="button"
          >
            <span className="ob-auth-tab-icon">✦</span>
            <span>
              <strong>Provider</strong>
              <small>Jobs & availability</small>
            </span>
          </button>
        </div>

        <div className="ob-auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <button className="go ob-auth-submit" onClick={submit} disabled={busy}>
            {busy
              ? "Signing in…"
              : side === "client"
                ? "Continue to my account"
                : "Continue to provider portal"}
            {!busy && <span aria-hidden>→</span>}
          </button>

          {err && <p className="ob-auth-error">{err}</p>}
        </div>

        <div className="ob-auth-demo">
          <span>Demo access</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => signIn("client@test.com", CLIENT_PW, "/account")}
          >
            Client demo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => signIn("worker@test.com", WORKER_PW, "/worker")}
          >
            Provider demo
          </button>
        </div>
      </section>

      <aside className="ob-auth-showcase" aria-hidden="true">
        <div className="ob-auth-orb orb-one" />
        <div className="ob-auth-orb orb-two" />
        <div className="ob-auth-showcase-card">
          <p>Premium home & wellness care</p>
          <h2>Beautifully simple from booking to doorstep.</h2>
          <div className="ob-auth-proof-grid">
            <span><b>01</b> Vetted professionals</span>
            <span><b>02</b> Clear pricing</span>
            <span><b>03</b> Your regular pro</span>
            <span><b>04</b> Same-day options</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
