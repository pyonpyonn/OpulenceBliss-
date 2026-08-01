"use client";

// Pop-up notifications. Save at: components/Toaster.tsx
// Add <Toaster /> to app/layout.tsx (next to <TopBar />).

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Toast = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
};

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const since = useRef(new Date().toISOString());
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;

    async function poll() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !alive) return;

      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, href, created_at")
        .eq("user_id", user.id)
        .eq("read", false)
        .gt("created_at", since.current)
        .order("created_at", { ascending: true })
        .limit(3);

      if (!data?.length || !alive) return;

      const fresh = data.filter((n) => !seen.current.has(n.id));
      if (!fresh.length) return;

      fresh.forEach((n) => seen.current.add(n.id));
      setToasts((t) => [
        ...t,
        ...fresh.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          href: n.href,
        })),
      ]);

      // Auto-dismiss
      fresh.forEach((n) => {
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== n.id));
        }, 8000);
      });
    }

    poll();
    const timer = setInterval(poll, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div
            className="body"
            onClick={() => {
              if (t.href) window.location.href = t.href;
            }}
            role={t.href ? "link" : undefined}
          >
            <strong>{t.title}</strong>
            {t.body && <p>{t.body}</p>}
          </div>
          <button
            aria-label="Dismiss"
            onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
          >
            ×
          </button>
        </div>
      ))}

      <style jsx>{`
        .toaster {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 9999;
          display: grid;
          gap: 10px;
          width: min(340px, calc(100vw - 36px));
          font-family: "Hanken Grotesk", system-ui, sans-serif;
        }
        .toast {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: #fff;
          border: 1px solid #ece5d8;
          border-left: 4px solid #cf854f;
          border-radius: 12px;
          padding: 14px 14px 14px 16px;
          box-shadow: 0 14px 34px rgba(47, 74, 58, 0.16);
          animation: slide 0.28s ease;
        }
        .body {
          flex: 1;
          cursor: pointer;
        }
        .toast strong {
          display: block;
          color: #2f4a3a;
          font-size: 15px;
          margin-bottom: 3px;
        }
        .toast p {
          margin: 0;
          color: #6e7a70;
          font-size: 13.5px;
          line-height: 1.45;
        }
        .toast button {
          background: none;
          border: none;
          color: #a89f90;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 0 2px;
        }
        .toast button:hover {
          color: #6e7a70;
        }
        @keyframes slide {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
