"use client";

// Cancel / reschedule / rate — the client's controls on each booking.
// Save at: app/account/BookingTools.tsx

import { useEffect, useRef, useState, useTransition } from "react";
import {
  cancelBooking,
  loadRescheduleWindow,
  rescheduleBooking,
  rateBooking,
} from "./actions";

function label(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tmr = new Date();
  tmr.setDate(today.getDate() + 1);
  const day =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === tmr.toDateString()
        ? "Tomorrow"
        : d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
  return `${day}, ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
}

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  fontSize: 13.5,
  cursor: "pointer",
  textDecoration: "underline",
};

export function BookingTools({
  id,
  postcode,
  showCancel = true,
}: {
  id: string;
  postcode: string | null;
  showCancel?: boolean;
}) {
  const [pending, start] = useTransition();
  const [slots, setSlots] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState<string | null>(null);
  const openedFromLink = useRef(false);

  async function loadSlots() {
    setMessage(null);
    setSlots(null);
    try {
      const windowResult = await loadRescheduleWindow(id);
      if (!windowResult.ok) {
        setMessage(windowResult.message);
        return;
      }
      if (!windowResult.window.can_reschedule) {
        setMessage(
          windowResult.window.reason ?? "This visit can no longer be changed.",
        );
        return;
      }

      setCutoff(windowResult.window.cutoff_at ?? null);
      setOpen(true);
      const res = await fetch(
        `/api/slots?postcode=${encodeURIComponent(postcode ?? "")}`,
      );
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    }
  }

  useEffect(() => {
    if (openedFromLink.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reschedule") !== "1") return;
    openedFromLink.current = true;
    void loadSlots();
    // loadSlots is intentionally run once for the explicit dashboard link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <button
          style={{ ...linkBtn, color: "#6D28D9" }}
          disabled={pending}
          onClick={() => (open ? setOpen(false) : loadSlots())}
        >
          {open ? "Close" : "Reschedule"}
        </button>
        {showCancel && (
          <button
            style={{ ...linkBtn, color: "#B0384F" }}
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  "Cancel this booking? Your card won't be charged.",
                )
              )
                return;
              start(async () => {
                await cancelBooking(id);
              });
            }}
          >
            {pending ? "Working…" : "Cancel booking"}
          </button>
        )}
      </div>

      {message && (
        <p style={{ color: "#B0384F", fontSize: 13.5, margin: "10px 0 0" }}>
          {message}
        </p>
      )}

      {open && (
        <div style={{ marginTop: 12 }}>
          {cutoff && (
            <p style={{ color: "#7A828C", fontSize: 13, margin: "0 0 8px" }}>
              You can change this visit until {label(cutoff)}.
            </p>
          )}
          {slots === null ? (
            <p style={{ color: "#7A828C", fontSize: 13.5, margin: 0 }}>
              Finding available times…
            </p>
          ) : slots.length === 0 ? (
            <p style={{ color: "#7A828C", fontSize: 13.5, margin: 0 }}>
              No other times available right now.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {slots.slice(0, 12).map((s) => (
                <button
                  key={s}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await rescheduleBooking(id, s);
                      setMessage(result.message);
                      if (result.ok) setOpen(false);
                    })
                  }
                  style={{
                    background: "#FFFFFF",
                    border: "1.5px solid #EDEFF1",
                    borderRadius: 10,
                    padding: "9px 10px",
                    font: "inherit",
                    fontSize: 13.5,
                    color: "#16202A",
                    cursor: pending ? "wait" : "pointer",
                  }}
                >
                  {label(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RateBooking({
  id,
  existing,
}: {
  id: string;
  existing?: { rating: number; comment: string | null } | null;
}) {
  const [pending, start] = useTransition();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);

  if (existing) {
    return (
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
        <span style={{ color: "#6D28D9" }}>
          {"★".repeat(existing.rating)}
          {"☆".repeat(5 - existing.rating)}
        </span>{" "}
        <span style={{ color: "#7A828C" }}>
          {existing.comment ? `“${existing.comment}”` : "Thanks for rating."}
        </span>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        style={{ ...linkBtn, color: "#6D28D9", marginTop: 12 }}
        onClick={() => setOpen(true)}
      >
        Rate this visit
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setStars(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 24,
              lineHeight: 1,
              padding: 0,
              color: n <= stars ? "#6D28D9" : "#E5E7EA",
            }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Anything you'd like to add? (optional)"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          border: "1.5px solid #E5E7EA",
          borderRadius: 10,
          font: "inherit",
          fontSize: 14,
          marginBottom: 10,
          resize: "vertical",
        }}
      />
      <button
        disabled={pending || stars === 0}
        onClick={() => start(() => rateBooking(id, stars, comment))}
        style={{
          background: "#16202A",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 999,
          padding: "9px 20px",
          font: "inherit",
          fontSize: 14,
          fontWeight: 600,
          cursor: pending || stars === 0 ? "not-allowed" : "pointer",
          opacity: pending || stars === 0 ? 0.6 : 1,
        }}
      >
        {pending ? "Sending…" : "Submit rating"}
      </button>
    </div>
  );
}

// Tip your provider after a completed visit.
export function TipBooking({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function tip(amount: number) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: id, amount }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || "Couldn't start the tip");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Tip failed");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        style={{ ...linkBtn, color: "#6D28D9", marginTop: 10 }}
        onClick={() => setOpen(true)}
      >
        Add a tip
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "#7A828C" }}>
        Tips go entirely to your provider — we take nothing.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[3, 5, 10].map((n) => (
          <button
            key={n}
            disabled={busy}
            onClick={() => tip(n)}
            style={{
              background: "#FFFFFF",
              border: "1.5px solid #EDEFF1",
              borderRadius: 999,
              padding: "9px 18px",
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              color: "#16202A",
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            £{n}
          </button>
        ))}
        <button
          style={{ ...linkBtn, color: "#7A828C" }}
          onClick={() => setOpen(false)}
        >
          Not now
        </button>
      </div>
      {err && (
        <p
          style={{
            background: "#FFE6EA",
            color: "#B0384F",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 13.5,
            marginTop: 10,
          }}
        >
          {err}
        </p>
      )}
    </div>
  );
}
