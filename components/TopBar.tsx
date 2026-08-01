"use client";

// Global top bar: tells you whether you're signed in. No redirects.
// Save at: components/TopBar.tsx

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function TopBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [ready, setReady] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? null);
    if (user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setRole(p?.role ?? null);

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnread(count ?? 0);
    } else {
      setRole(null);
      setUnread(0);
    }
    setReady(true);
  }

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const timer = setInterval(load, 30000); // keep the badge fresh
    return () => {
      sub.subscription.unsubscribe();
      clearInterval(timer);
    };
  }, []);

  if (!ready) return null;

  const isProvider = role === "provider";

  return (
    <div className={email ? "bar in" : "bar out"}>
      {email ? (
        <>
          <span className="who">
            {role === "admin" ? "Admin" : isProvider ? "Provider" : "Client"} ·{" "}
            <strong>{email}</strong>
          </span>
          <span className="acts">
            {role === "admin" ? (
              <>
                <a href="/admin">Control panel</a>
                <a href="/providers">Providers</a>
              </>
            ) : isProvider ? (
              <>
                <a href="/worker">My jobs</a>
                <a href="/worker/availability">My availability</a>
              </>
            ) : (
              <>
                <a href="/account">My account</a>
                <a href="/book">Book a service</a>
              </>
            )}
            <a href="/notifications" className="bell">
              Updates
              {unread > 0 && <span className="badge">{unread}</span>}
            </a>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              Sign out
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="who">You&apos;re not signed in.</span>
          <span className="acts">
            <a className="cta" href="/login">
              Log in
            </a>
          </span>
        </>
      )}

      <style jsx>{`
        .bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          flex-wrap: wrap;
          padding: 9px 20px;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          font-size: 14px;
        }
        .bar.out {
          background: #f6e7dd;
          color: #8a4b26;
        }
        .bar.in {
          background: #e7eee7;
          color: #2f4a3a;
        }
        .who strong {
          font-weight: 600;
        }
        .acts {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .acts a,
        .acts button {
          color: inherit;
          text-decoration: none;
          font: inherit;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          opacity: 0.85;
        }
        .acts a:hover,
        .acts button:hover {
          opacity: 1;
          text-decoration: underline;
        }
        .acts .cta {
          background: #2f4a3a;
          color: #fbf7f0;
          padding: 6px 16px;
          border-radius: 999px;
          font-weight: 600;
          opacity: 1;
        }
        .bell {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .badge {
          background: #cf854f;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
        }
        .acts .cta:hover {
          background: #263d30;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}