"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const ACCENT = "#E72D84";
const GRAD = "linear-gradient(112deg,#FF7A22 0%,#FF3D4D 31%,#E72D84 61%,#7014D8 100%)";
const INK = "#142033";

type NavLink = { href: string; label: string; match: string[] };

const NAV: NavLink[] = [
  { href: "/services/cleaning", label: "Cleaning", match: ["/services/cleaning"] },
  { href: "/services/massage", label: "Massage", match: ["/services/massage"] },
  { href: "/subscribe", label: "Memberships", match: ["/subscribe"] },
  { href: "/providers", label: "Our pros", match: ["/providers"] },
  { href: "/provider/join", label: "Jobs", match: ["/provider"] },
];

function AccountIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.8 19c.8-3.2 3-5 6.2-5s5.4 1.8 6.2 5" />
    </svg>
  );
}

export default function SiteHeader() {
  const path = usePathname() ?? "";
  const [role, setRole] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
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

  if (
    path.startsWith("/worker") ||
    path.startsWith("/admin") ||
    path.startsWith("/account")
  )
    return null;

  return (
    <header className="ob-public-header" style={wrap}>
      <div className="ob-header-bar" style={bar}>
        <Link href="/" className="ob-header-logo" style={logo}>
          opulence<span style={{ color: ACCENT }}>bliss</span>
        </Link>

        <nav className="ob-header-nav" style={navInner} aria-label="Main">
          {NAV.map((l) => {
            const on = active === l.href;
            const hot = hover === l.href;
            return (
              <Link
                key={l.href + l.label}
                href={l.href}
                prefetch
                onMouseEnter={() => setHover(l.href)}
                onMouseLeave={() => setHover(null)}
                style={{
                  ...navItem,
                  color: on || hot ? ACCENT : INK,
                  background: on ? "rgba(231,45,132,.07)" : "transparent",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ob-header-actions" style={actions}>
          <Link
            href={accountHref}
            className="ob-header-account"
            aria-label={role ? "My account" : "Log in"}
            title={role ? "My account" : "Log in"}
            style={{ ...ghostBtn, position: "relative" }}
          >
            <span className="ob-account-icon" aria-hidden="true">
              <AccountIcon />
            </span>
            <span className="ob-account-label">
              {role ? "My account" : "Log in"}
            </span>
            {unread > 0 && <span style={unreadPill}>{unread}</span>}
          </Link>

          <Link
            href="/book"
            className="ob-header-cta"
            style={cta}
            data-ob-primary="true"
          >
            <span>Book now</span>
            <span className="ob-book-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 620px) {
          .ob-public-header {
            padding: 10px 10px 0 !important;
          }

          .ob-public-header .ob-header-bar {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            grid-template-areas:
              "logo actions"
              "nav nav" !important;
            align-items: center !important;
            gap: 10px 8px !important;
            padding: 12px !important;
            border-radius: 20px !important;
          }

          .ob-public-header .ob-header-logo {
            grid-area: logo;
            min-width: 0;
            font-size: 22px !important;
          }

          .ob-public-header .ob-header-actions {
            grid-area: actions;
            justify-self: end;
            gap: 7px !important;
          }

          .ob-public-header .ob-header-account {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            padding: 0 !important;
            justify-content: center !important;
            gap: 0 !important;
            background: rgba(255,255,255,.76) !important;
            border: 1px solid rgba(67,38,72,.11) !important;
            box-shadow: 0 6px 16px rgba(82,44,86,.07);
          }

          .ob-public-header .ob-account-label {
            display: none !important;
          }

          .ob-public-header .ob-account-icon {
            display: grid;
            place-items: center;
            color: #142033;
          }

          .ob-public-header .ob-header-cta {
            min-height: 40px !important;
            padding: 10px 14px !important;
            gap: 6px !important;
            font-size: 12.5px !important;
            box-shadow: 0 8px 20px rgba(176,39,129,.20) !important;
          }

          .ob-public-header .ob-book-arrow {
            display: grid;
            place-items: center;
            width: 19px;
            height: 19px;
            border-radius: 50%;
            background: rgba(255,255,255,.14);
            font-size: 12px;
          }

          .ob-public-header .ob-header-nav {
            grid-area: nav;
            width: 100%;
            justify-content: space-between !important;
            gap: 2px !important;
            overflow-x: visible !important;
          }

          .ob-public-header .ob-header-nav a {
            flex: 0 1 auto;
            padding: 7px 7px !important;
            font-size: 12px !important;
          }
        }

        @media (max-width: 390px) {
          .ob-public-header .ob-header-bar {
            padding: 11px 10px !important;
          }

          .ob-public-header .ob-header-logo {
            font-size: 20px !important;
          }

          .ob-public-header .ob-header-account {
            width: 38px !important;
            height: 38px !important;
            min-width: 38px !important;
          }

          .ob-public-header .ob-header-cta {
            min-height: 38px !important;
            padding: 9px 12px !important;
            font-size: 12px !important;
          }

          .ob-public-header .ob-header-nav a {
            padding: 7px 5px !important;
            font-size: 11.5px !important;
          }
        }
      `}</style>
    </header>
  );
}

const wrap: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 40,
  padding: "14px 18px 0",
  background: "transparent",
  fontFamily: "'Nunito', system-ui, sans-serif",
};

const bar: React.CSSProperties = {
  width: "min(1240px, calc(100vw - 28px))",
  margin: "0 auto",
  padding: "14px 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  border: "1px solid rgba(255,255,255,.76)",
  borderRadius: 24,
  background: "rgba(255,255,255,.68)",
  boxShadow: "0 16px 44px rgba(82,44,86,.10)",
  backdropFilter: "blur(26px) saturate(155%)",
  WebkitBackdropFilter: "blur(26px) saturate(155%)",
};

const logo: React.CSSProperties = {
  fontFamily: "'Nunito', system-ui, sans-serif",
  fontSize: "clamp(23px, 3vw, 31px)",
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: "-0.04em",
  color: INK,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const navInner: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  minWidth: 0,
  overflowX: "auto",
  scrollbarWidth: "none",
};

const navItem: React.CSSProperties = {
  fontSize: 14.5,
  fontWeight: 800,
  textDecoration: "none",
  padding: "9px 12px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  transition: "background .18s ease,color .18s ease",
};

const actions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  flexShrink: 0,
};

const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 14,
  fontWeight: 800,
  color: INK,
  textDecoration: "none",
  padding: "10px 15px",
  borderRadius: 999,
  border: "1px solid rgba(67,38,72,.12)",
  background: "rgba(255,255,255,.42)",
  whiteSpace: "nowrap",
};

const cta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  fontWeight: 900,
  color: "#fff",
  textDecoration: "none",
  padding: "11px 18px",
  borderRadius: 999,
  background: GRAD,
  whiteSpace: "nowrap",
  boxShadow: "0 10px 24px rgba(176,39,129,.24)",
};

const unreadPill: React.CSSProperties = {
  position: "absolute",
  top: -7,
  right: -5,
  minWidth: 19,
  height: 19,
  padding: "0 5px",
  borderRadius: 999,
  background: GRAD,
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
  boxShadow: "0 0 0 2px rgba(255,255,255,.9)",
};
