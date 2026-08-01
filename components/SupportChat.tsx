"use client";

// Support chat bubble. Save at: components/SupportChat.tsx
// Add <SupportChat /> to app/layout.tsx.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Do you cover IG11?",
  "What's free on Friday in SW3?",
  "When's my next visit?",
  "How much have I spent?",
];

// Known paths, longest first so /account/profile wins over /account.
const PATHS = [
  "provider/join",
  "account/profile",
  "worker/availability",
  "worker/earnings",
  "worker/profile",
  "notifications",
  "providers",
  "account",
  "worker",
  "login",
  "book",
];

const LINK_RE = new RegExp(
  // [label](target)            OR   http(s)://…            OR   /path?query
  `\\[([^\\]]+)\\]\\(([^)]+)\\)|(https?://[^\\s)]+)|(/(?:${PATHS.join(
    "|"
  )})(?:\\?[^\\s)]*)?)`,
  "g"
);

// Turn any absolute URL back into a site-relative path.
function toPath(href: string) {
  try {
    if (/^https?:\/\//.test(href)) {
      const u = new URL(href);
      return u.pathname + u.search;
    }
  } catch {
    /* ignore */
  }
  return href;
}

function Linkified({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(LINK_RE.source, "g");

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));

    const href = toPath(m[2] ?? m[3] ?? m[4] ?? "");
    const label = m[1] ?? href;
    const isBooking = href.startsWith("/book?");

    out.push(
      isBooking ? (
        <a key={m.index} href={href} className="confirm">
          Confirm &amp; pay →
        </a>
      ) : (
        <a key={m.index} href={href}>
          {label}
        </a>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));

  return <>{out}</>;
}

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hello — I'm the Opulence Bliss assistant. I can check whether we cover your postcode, find times that are actually free, and look up your bookings. Ask away.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const history = msgs.slice(1); // drop the greeting
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);

    try {
      // Send our access token so the assistant can look up our own data.
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: question, history }),
      });
      const data = await res.json();
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text:
            data.reply ??
            data.error ??
            "Sorry, I couldn't answer that. Please contact the team.",
        },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: "I couldn't reach the server. Please try again shortly.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="bubble" onClick={() => setOpen(true)} aria-label="Open support chat">
        <span>Need a hand?</span>
        <style jsx>{`
          .bubble {
            position: fixed;
            left: 18px;
            bottom: 18px;
            z-index: 9998;
            background: #2f4a3a;
            color: #fbf7f0;
            border: none;
            border-radius: 999px;
            padding: 13px 22px;
            font-family: "Hanken Grotesk", system-ui, sans-serif;
            font-size: 14.5px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 10px 28px rgba(47, 74, 58, 0.28);
          }
          .bubble:hover {
            background: #263d30;
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className="panel">
      <header>
        <div>
          <strong>Opulence Bliss</strong>
          <small>Support assistant</small>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close chat">
          ×
        </button>
      </header>

      <div className="log">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "row me" : "row them"}>
            <p>
              {m.role === "assistant" ? <Linkified text={m.text} /> : m.text}
            </p>
          </div>
        ))}
        {busy && (
          <div className="row them">
            <p className="dots">
              <span />
              <span />
              <span />
            </p>
          </div>
        )}
        {msgs.length === 1 && (
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask a question…"
          aria-label="Your message"
          disabled={busy}
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
      <p className="note">
        An assistant, not a person. For complaints or claims, contact the team.
      </p>

      <style jsx>{`
        .panel {
          position: fixed;
          left: 18px;
          bottom: 18px;
          z-index: 9998;
          width: min(370px, calc(100vw - 36px));
          height: min(520px, calc(100vh - 100px));
          background: #fbf7f0;
          border: 1px solid #ece5d8;
          border-radius: 18px;
          box-shadow: 0 22px 54px rgba(47, 74, 58, 0.24);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
        }
        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: #2f4a3a;
          color: #fbf7f0;
        }
        header strong {
          display: block;
          font-family: "Fraunces", serif;
          font-size: 16px;
          font-weight: 500;
        }
        header small {
          font-size: 12px;
          opacity: 0.75;
        }
        header button {
          background: none;
          border: none;
          color: #fbf7f0;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          opacity: 0.8;
        }
        header button:hover {
          opacity: 1;
        }
        .log {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .row {
          display: flex;
        }
        .row.me {
          justify-content: flex-end;
        }
        .row p {
          margin: 0;
          padding: 11px 14px;
          border-radius: 14px;
          font-size: 14.5px;
          line-height: 1.5;
          max-width: 85%;
          white-space: pre-wrap;
        }
        .row.them p {
          background: #fff;
          border: 1px solid #ece5d8;
          color: #26302a;
          border-bottom-left-radius: 4px;
        }
        .row.them p :global(a) {
          color: #cf854f;
          font-weight: 600;
          text-decoration: underline;
        }
        .row.them p :global(a.confirm) {
          display: inline-block;
          margin-top: 8px;
          background: #cf854f;
          color: #fff;
          padding: 9px 18px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 14px;
        }
        .row.them p :global(a.confirm:hover) {
          background: #ba7440;
        }
        .row.me p {
          background: #2f4a3a;
          color: #fbf7f0;
          border-bottom-right-radius: 4px;
        }
        .dots {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a89f90;
          animation: blink 1.2s infinite;
        }
        .dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes blink {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 6px;
        }
        .chips button {
          background: #fff;
          border: 1.5px solid #ece5d8;
          border-radius: 999px;
          padding: 8px 14px;
          font: inherit;
          font-size: 13px;
          color: #2f4a3a;
          cursor: pointer;
        }
        .chips button:hover {
          border-color: #cf854f;
        }
        .composer {
          display: flex;
          gap: 8px;
          padding: 12px 14px 6px;
          border-top: 1px solid #ece5d8;
          background: #fbf7f0;
        }
        .composer input {
          flex: 1;
          min-width: 0;
          border: 1.5px solid #d8d2c6;
          border-radius: 999px;
          padding: 11px 16px;
          font: inherit;
          font-size: 14.5px;
          background: #fff;
          color: #26302a;
        }
        .composer input:focus-visible {
          outline: none;
          border-color: #2f4a3a;
        }
        .composer button {
          background: #cf854f;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 11px 18px;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .composer button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .note {
          margin: 0;
          padding: 4px 14px 12px;
          font-size: 11.5px;
          color: #a89f90;
          text-align: center;
        }
      `}</style>
    </div>
  );
}