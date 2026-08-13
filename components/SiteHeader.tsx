"use client";

// SETUP: code "components/SiteHeader.tsx"
//
// Inline styles on purpose — nothing in globals.css can override them.

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const GRAD = "linear-gradient(100deg,#F5C542,#C86FC9 55%,#7B2FF7)";

type NavLink = { href: string; label: string; match: string[] };

// The same links for everyone, signed in or not. Anything role-specific
// lives inside the portal, reached via "My account".
const NAV: NavLink[] = [
  { href: "/services/cleaning", label: "Cleaning", match: ["/services/cleaning"] },
  { href: "/services/massage", label: "Massage", match: ["/services/massage"] },
  { href: "/subscribe", label: "Memberships", match: ["/subscribe"] },
  { href: "/providers", label: "Our pros", match: ["/providers"] },
  { href: "/provider/join", label: "Jobs", match: ["/provider"] },
];

export default function SiteHeader() {
  const path = usePathname() ?? "";
  const [role, setRole] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setRole(null);
        setUnread(0);
      } else {
        const { data: p } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (!alive) return;
        setRole(p?.role ?? "customer");

        const { count } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);
        if (!alive) return;
        setUnread(count ?? 0);
      }
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
      sub.subscription.unsubscribe();
    };
  }, []);


  let active: string | null = null;
  let bestLen = -1;
  for (const l of NAV) {
    for (const m of l.match) {
      if (m && path.startsWith(m) && m.length > bestLen) {
        bestLen = m.length;
        active = l.href;
      }
    }
  }

  const accountHref =
    role === "provider"
      ? "/worker"
      : role === "admin"
      ? "/admin"
      : role
      ? "/account"
      : "/login";

  // The provider and admin portals have their own chrome.
  if (
    path.startsWith("/worker") ||
    path.startsWith("/admin") ||
    path.startsWith("/account")
  )
    return null;

  return (
    <header className="site-header">
      {/* ---------- row 1 ---------- */}
      <div className="site-header-bar">
        <Link href="/" className="site-header-logo">
          opulence<span>bliss</span>
        </Link>

        <div className="site-header-actions">
          <Link
            href={accountHref}
            className="site-header-account"
          >
            {role ? "My account" : "Log in"}
            {unread > 0 && (
              <span
                className="site-header-count"
              >
                {unread}
              </span>
            )}
          </Link>
          <Link href="/book" className="site-header-cta">
            Book now
          </Link>
        </div>
      </div>

      {/* ---------- row 2 ---------- */}
      <nav className="site-header-nav" aria-label="Main">
        <div className="site-header-nav-inner">
          {NAV.map((l) => {
            const on = active === l.href;
            return (
              <Link
                key={l.href + l.label}
                href={l.href}
                prefetch
                className={on ? "site-header-link active" : "site-header-link"}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <style jsx>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 40;
          background: var(--ob-surface-glass);
          color: var(--ob-text);
          border-bottom: 1px solid var(--ob-border);
          box-shadow: 0 8px 28px var(--ob-shadow-soft);
          backdrop-filter: blur(20px) saturate(150%);
          font-family: var(--font-nunito), "Nunito", system-ui, sans-serif;
        }
        .site-header-bar {
          max-width: 1180px;
          margin: 0 auto;
          padding: 17px 26px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .site-header-logo {
          color: var(--ob-text);
          font-size: clamp(26px, 4vw, 34px);
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
          text-decoration: none;
        }
        .site-header-logo span {
          color: var(--ob-purple);
        }
        .site-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .site-header-account,
        .site-header-cta {
          position: relative;
          border-radius: 999px;
          white-space: nowrap;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
          transition: transform 0.18s ease, border-color 0.18s ease,
            box-shadow 0.18s ease;
        }
        .site-header-account {
          padding: 9px 16px;
          color: var(--ob-text);
          border: 1px solid var(--ob-border-strong);
          background: color-mix(in srgb, var(--ob-surface) 72%, transparent);
        }
        .site-header-cta {
          padding: 11px 22px;
          color: #fff;
          background: ${GRAD};
          box-shadow: 0 7px 20px color-mix(in srgb, #7b2ff7 28%, transparent);
        }
        .site-header-account:hover,
        .site-header-cta:hover {
          transform: translateY(-1px);
        }
        .site-header-account:hover {
          border-color: var(--ob-purple);
          color: var(--ob-purple);
        }
        .site-header-count {
          position: absolute;
          top: -7px;
          right: -7px;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: ${GRAD};
          color: #fff;
          box-shadow: 0 0 0 2px var(--ob-surface);
          font-size: 11px;
          font-weight: 900;
        }
        .site-header-nav {
          background: color-mix(in srgb, var(--ob-purple-soft) 68%, var(--ob-surface));
          border-top: 1px solid color-mix(in srgb, var(--ob-purple) 14%, var(--ob-border));
        }
        .site-header-nav-inner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 26px;
          display: flex;
          gap: 30px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .site-header-nav-inner::-webkit-scrollbar {
          display: none;
        }
        .site-header-link {
          position: relative;
          padding: 13px 0 12px;
          color: var(--ob-text);
          text-decoration: none;
          white-space: nowrap;
          font-size: 15.5px;
          font-weight: 800;
        }
        .site-header-link::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 3px;
          border-radius: 999px 999px 0 0;
          background: ${GRAD};
          transform: scaleX(0);
          transition: transform 0.18s ease;
        }
        .site-header-link:hover,
        .site-header-link.active {
          color: var(--ob-purple);
        }
        .site-header-link:hover::after,
        .site-header-link.active::after {
          transform: scaleX(1);
        }
        @media (max-width: 620px) {
          .site-header-bar {
            padding: 13px 15px 11px;
          }
          .site-header-actions {
            gap: 7px;
          }
          .site-header-account,
          .site-header-cta {
            padding: 9px 13px;
            font-size: 13.5px;
          }
          .site-header-nav-inner {
            padding: 0 15px;
            gap: 22px;
          }
        }
        @media (max-width: 390px) {
          .site-header-logo {
            font-size: 23px;
          }
          .site-header-account {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
