"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  LogOut,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Item = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  exact?: boolean;
};

const ITEMS: Item[] = [
  {
    href: "/account",
    label: "My bookings",
    short: "Visits",
    icon: CalendarDays,
    exact: true,
  },
  {
    href: "/account/membership",
    label: "Membership",
    short: "Plan",
    icon: Star,
  },
  {
    href: "/account/profile",
    label: "My details",
    short: "You",
    icon: CircleUserRound,
  },
  {
    href: "/account/updates",
    label: "Updates",
    short: "News",
    icon: Bell,
  },
];

export default function ClientNav({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const path = usePathname() ?? "";
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setCollapsed(localStorage.getItem("opulence-account-nav") !== "expanded");
  }, []);

  useEffect(() => {
    let alive = true;
    async function count() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const { count: total } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (alive) setUnread(total ?? 0);
    }
    void count();
    const timer = window.setInterval(count, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const first = (name || email || "Y").trim().charAt(0).toUpperCase();
  const isOn = (item: Item) =>
    item.exact ? path === item.href : path.startsWith(item.href);

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(
        "opulence-account-nav",
        next ? "collapsed" : "expanded",
      );
      return next;
    });
  }

  return (
    <>
      <aside className={collapsed ? "side collapsed" : "side"}>
        <div className="nav-head">
          <Link href="/" className="brand" aria-label="Opulence Bliss home">
            <span className="full-brand">
              opulence<b>bliss</b>
            </span>
            <span className="mini-brand">
              O<b>B</b>
            </span>
          </Link>
          <button
            type="button"
            className="collapse-toggle"
            onClick={toggleSidebar}
            aria-label={
              collapsed ? "Expand account menu" : "Minimise account menu"
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
          </button>
        </div>

        <div className="profile" title={collapsed ? name || email : undefined}>
          <div className="avatar">{first}</div>
          <div className="nav-copy identity">
            <strong>{name || "Your account"}</strong>
            <span>{email}</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Client account">
          {ITEMS.map((item) => {
            const active = isOn(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={active ? "nav-item active" : "nav-item"}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-icon">
                  <Icon size={23} strokeWidth={2.15} />
                </span>
                <span className="nav-copy">{item.label}</span>
                {item.href === "/account/updates" && unread > 0 && (
                  <span className="nav-count">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="rail-separator" />

        <Link
          href="/book"
          className="book-service"
          aria-label="Book a service"
          title={collapsed ? "Book a service" : undefined}
        >
          <CalendarPlus size={23} strokeWidth={2.15} />
          <span className="nav-copy">Book a service</span>
        </Link>

        <div className="rail-separator lower" />

        <div className="foot">
          <button
            className="foot-action"
            title={collapsed ? "Sign out" : undefined}
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
          >
            <LogOut size={22} />
            <span className="nav-copy">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="mtop">
        <Link href="/" className="mobile-brand">
          opulence<b>bliss</b>
        </Link>
        <Link href="/book" className="mobile-book">
          Book
        </Link>
      </div>

      <nav className="tabs" aria-label="Client account mobile navigation">
        {ITEMS.map((item) => {
          const active = isOn(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={active ? "tab active" : "tab"}
            >
              <span className="tab-icon">
                <Icon size={21} />
                {item.href === "/account/updates" && unread > 0 && (
                  <span className="tab-dot" />
                )}
              </span>
              {item.short}
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        .side {
          display: none;
        }
        .mtop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          position: sticky;
          top: 0;
          z-index: 40;
          box-sizing: border-box;
          width: 100%;
          padding: 12px 16px;
          border-bottom: 1px solid var(--ob-border);
          background: color-mix(in srgb, var(--ob-surface) 96%, transparent);
          backdrop-filter: blur(14px);
        }
        .mobile-brand {
          color: var(--ob-text);
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.04em;
          text-decoration: none;
        }
        .mobile-brand b,
        .brand b {
          color: var(--ob-purple);
        }
        .mobile-book {
          border-radius: 999px;
          background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
          color: #fff;
          padding: 9px 18px;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
        }
        .tabs {
          display: flex;
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 80;
          box-sizing: border-box;
          min-height: 66px;
          padding: 7px max(5px, env(safe-area-inset-left))
            calc(7px + env(safe-area-inset-bottom));
          border-top: 1px solid var(--ob-border);
          background: color-mix(in srgb, var(--ob-surface) 97%, transparent);
          box-shadow: 0 -5px 22px var(--ob-shadow);
          backdrop-filter: blur(16px);
        }
        .tab {
          flex: 1 1 0;
          min-width: 58px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          color: var(--ob-muted);
          font-size: 10.5px;
          font-weight: 800;
          text-decoration: none;
        }
        .tab.active {
          color: var(--ob-purple);
        }
        .tab-icon {
          position: relative;
          display: grid;
          place-items: center;
        }
        .tab-dot {
          position: absolute;
          top: -2px;
          right: -5px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ob-purple);
          box-shadow: 0 0 0 2px var(--ob-surface);
        }
        @media (min-width: 900px) {
          .side {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 250px;
            flex: 0 0 250px;
            height: 100vh;
            box-sizing: border-box;
            overflow-y: auto;
            padding: 24px 16px 86px;
            border-right: 1px solid var(--ob-border);
            background: var(--ob-surface);
            position: sticky;
            top: 0;
            align-self: flex-start;
            transition:
              width 0.22s ease,
              flex-basis 0.22s ease,
              padding 0.22s ease;
          }
          .side.collapsed {
            width: 92px;
            flex-basis: 92px;
            align-items: center;
            padding-left: 14px;
            padding-right: 14px;
          }
          .nav-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 7px;
            width: 100%;
          }
          .brand {
            min-width: 0;
            color: var(--ob-text);
            font-size: 24px;
            font-weight: 900;
            letter-spacing: -0.045em;
            line-height: 1;
            text-decoration: none;
          }
          .mini-brand {
            display: none;
          }
          .collapse-toggle {
            display: grid;
            place-items: center;
            width: 34px;
            height: 34px;
            flex: 0 0 34px;
            border: 1px solid var(--ob-border);
            border-radius: 11px;
            background: var(--ob-surface);
            color: var(--ob-muted);
            box-shadow: 0 4px 12px var(--ob-shadow);
            cursor: pointer;
          }
          .collapse-toggle:hover {
            color: var(--ob-purple);
            border-color: var(--ob-purple);
          }
          .profile {
            display: flex;
            align-items: center;
            gap: 11px;
            min-width: 0;
            padding: 10px;
            border-radius: 17px;
            background: var(--ob-surface-soft);
          }
          .avatar {
            display: grid;
            place-items: center;
            width: 48px;
            height: 48px;
            flex: 0 0 48px;
            border-radius: 50%;
            background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
            color: #fff;
            font-size: 20px;
            font-weight: 900;
          }
          .identity {
            min-width: 0;
          }
          .identity strong,
          .identity span {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .identity strong {
            color: var(--ob-text);
            font-size: 14px;
            font-weight: 900;
          }
          .identity span {
            color: var(--ob-muted);
            font-size: 11.5px;
            font-weight: 650;
          }
          .nav-list {
            display: grid;
            gap: 8px;
            width: 100%;
          }
          .nav-item {
            position: relative;
            display: flex;
            align-items: center;
            gap: 12px;
            min-height: 48px;
            box-sizing: border-box;
            border-radius: 14px;
            padding: 7px 10px;
            color: var(--ob-muted);
            font-size: 14px;
            font-weight: 850;
            text-decoration: none;
          }
          .nav-item:hover {
            color: var(--ob-text);
            background: var(--ob-surface-soft);
          }
          .nav-item.active {
            color: var(--ob-purple);
            background: var(--ob-purple-soft);
          }
          .nav-icon {
            display: grid;
            place-items: center;
            width: 34px;
            height: 34px;
            flex: 0 0 34px;
          }
          .nav-count {
            display: grid;
            place-items: center;
            min-width: 21px;
            height: 21px;
            margin-left: auto;
            padding: 0 5px;
            border-radius: 999px;
            background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
            color: #fff;
            font-size: 10px;
            font-weight: 900;
          }
          .rail-separator {
            width: calc(100% - 20px);
            height: 1px;
            margin: 0 auto;
            background: var(--ob-border);
          }
          .book-service {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            min-height: 50px;
            box-sizing: border-box;
            border-radius: 15px;
            background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
            color: #fff;
            padding: 10px 13px;
            font-size: 14px;
            font-weight: 900;
            text-decoration: none;
          }
          .rail-separator.lower {
            margin-top: 2px;
          }
          .foot {
            margin-top: auto;
            width: 100%;
          }
          .foot-action {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            min-height: 46px;
            border: 0;
            border-radius: 13px;
            background: transparent;
            color: var(--ob-muted);
            padding: 9px 11px;
            font: inherit;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
          }
          .foot-action:hover {
            background: var(--ob-surface-soft);
            color: var(--ob-text);
          }
          .collapsed .full-brand,
          .collapsed .nav-copy {
            display: none;
          }
          .collapsed .mini-brand {
            display: inline;
            font-size: 23px;
          }
          .collapsed .nav-head {
            gap: 3px;
          }
          .collapsed .collapse-toggle {
            width: 30px;
            height: 30px;
            flex-basis: 30px;
          }
          .collapsed .profile {
            padding: 0;
            background: transparent;
          }
          .collapsed .avatar {
            width: 52px;
            height: 52px;
            flex-basis: 52px;
          }
          .collapsed .nav-item {
            justify-content: center;
            width: 54px;
            height: 54px;
            min-height: 54px;
            padding: 0;
          }
          .collapsed .nav-icon {
            width: auto;
            height: auto;
          }
          .collapsed .nav-count {
            position: absolute;
            top: 2px;
            right: 0;
            min-width: 19px;
            height: 19px;
            padding: 0 4px;
          }
          .collapsed .rail-separator {
            width: 54px;
          }
          .collapsed .book-service {
            width: 54px;
            height: 54px;
            min-height: 54px;
            padding: 0;
          }
          .collapsed .foot-action {
            justify-content: center;
            width: 54px;
            height: 50px;
            padding: 0;
          }
          .mtop,
          .tabs {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
