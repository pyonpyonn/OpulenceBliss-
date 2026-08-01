"use client";

// The client's current / next visit, with live status and timer.
// Save at: app/account/CurrentVisit.tsx

import { useEffect, useState } from "react";

export type Visit = {
  id: string;
  status: string;
  scheduled_at: string;
  address: string | null;
  service: string;
  durationMinutes: number | null;
  providerName: string | null;
  providerRating: number | null;
  arrivedAt: string | null;
};

const STAGES = [
  { key: "booked", label: "Booked" },
  { key: "confirmed", label: "Confirmed" },
  { key: "arrived", label: "Arrived" },
  { key: "complete", label: "Complete" },
];

function stageIndex(status: string) {
  switch (status) {
    case "offered":
    case "declined":
      return 0;
    case "scheduled":
      return 1;
    case "in_progress":
      return 2;
    case "completed":
      return 3;
    default:
      return 0;
  }
}

function whenLabel(iso: string) {
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
          weekday: "long",
          day: "numeric",
          month: "long",
        });
  return `${day} at ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} hour${hrs === 1 ? "" : "s"}`;
  const days = Math.round(hrs / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export default function CurrentVisit({
  visit,
  hideLink,
}: {
  visit: Visit;
  hideLink?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const live = visit.status === "in_progress";

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  const idx = stageIndex(visit.status);

  // Live timer
  let elapsed = "";
  let progress = 0;
  if (live && visit.arrivedAt) {
    const secs = Math.max(0, Math.floor((now - new Date(visit.arrivedAt).getTime()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    elapsed =
      (h > 0 ? `${h}:` : "") +
      `${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
    if (visit.durationMinutes) {
      progress = Math.min(100, (secs / (visit.durationMinutes * 60)) * 100);
    }
  }

  const soon = idx <= 1 ? countdown(visit.scheduled_at) : null;

  return (
    <section className={live ? "visit live" : "visit"}>
      <div className="head">
        <div>
          <p className="eyebrow">
            {live
              ? "Happening now"
              : idx === 3
              ? "Last visit"
              : "Your next visit"}
          </p>
          <h2>{visit.service}</h2>
          <p className="when">
            {whenLabel(visit.scheduled_at)}
            {soon ? ` · ${soon}` : ""}
          </p>
        </div>

        {live && (
          <div className="timer">
            <span className="dot" />
            <strong>{elapsed}</strong>
            <small>elapsed</small>
          </div>
        )}
      </div>

      {live && visit.durationMinutes && (
        <div className="bar">
          <span style={{ width: `${progress}%` }} />
          <em>
            {Math.round(progress)}% of {visit.durationMinutes} min
          </em>
        </div>
      )}

      <ol className="track">
        {STAGES.map((s, i) => (
          <li
            key={s.key}
            className={i < idx ? "done" : i === idx ? "at" : ""}
          >
            <span className="pip">{i < idx ? "✓" : i + 1}</span>
            <span className="lbl">{s.label}</span>
          </li>
        ))}
      </ol>

      <dl className="facts">
        <div>
          <dt>Provider</dt>
          <dd>
            {visit.providerName ?? "Being matched"}
            {visit.providerRating
              ? ` · ${Number(visit.providerRating).toFixed(1)}★`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{visit.address ?? "—"}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>
            {visit.durationMinutes ? `${visit.durationMinutes} minutes` : "—"}
          </dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>
            {idx === 3 ? "Charged" : "Held — charged after the visit"}
          </dd>
        </div>
      </dl>

      {!hideLink && (
        <p className="more">
          <a href={`/account/visit/${visit.id}`}>See full details →</a>
        </p>
      )}

      <style jsx>{`
        .visit {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 20px;
          padding: 28px 28px 24px;
          margin-bottom: 28px;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
        }
        .visit.live {
          border-color: #7fa08c;
          box-shadow: 0 14px 36px rgba(47, 74, 58, 0.12);
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 11.5px;
          font-weight: 600;
          color: #cf854f;
          margin: 0 0 6px;
        }
        h2 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 27px;
          color: #2f4a3a;
          margin: 0 0 4px;
        }
        .when {
          color: #6e7a70;
          font-size: 14.5px;
          margin: 0;
        }
        .timer {
          display: flex;
          align-items: baseline;
          gap: 7px;
          background: #e7eee7;
          border-radius: 12px;
          padding: 10px 16px;
        }
        .timer strong {
          font-family: "Fraunces", serif;
          font-size: 24px;
          color: #2f4a3a;
          font-variant-numeric: tabular-nums;
        }
        .timer small {
          color: #6e7a70;
          font-size: 12px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4b8c68;
          animation: pulse 1.6s ease-in-out infinite;
          align-self: center;
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        .bar {
          position: relative;
          height: 8px;
          background: #f0ebe0;
          border-radius: 999px;
          margin: 20px 0 6px;
        }
        .bar span {
          display: block;
          height: 100%;
          background: #7fa08c;
          border-radius: 999px;
          transition: width 1s linear;
        }
        .bar em {
          position: absolute;
          right: 0;
          top: 12px;
          font-style: normal;
          font-size: 12px;
          color: #6e7a70;
        }
        .track {
          list-style: none;
          display: flex;
          gap: 6px;
          padding: 0;
          margin: 26px 0 22px;
        }
        .track li {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          position: relative;
          color: #a89f90;
          font-size: 12.5px;
        }
        .track li::before {
          content: "";
          position: absolute;
          top: 13px;
          left: 0;
          right: 50%;
          height: 2px;
          background: #f0ebe0;
        }
        .track li:first-child::before {
          display: none;
        }
        .track li.done::before,
        .track li.at::before {
          background: #7fa08c;
        }
        .pip {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #f6f1e8;
          border: 1.5px solid #e2dccf;
          font-size: 12px;
          font-weight: 600;
          position: relative;
          z-index: 1;
        }
        .track li.done .pip {
          background: #e7eee7;
          border-color: #7fa08c;
          color: #2f4a3a;
        }
        .track li.at .pip {
          background: #2f4a3a;
          border-color: #2f4a3a;
          color: #fbf7f0;
        }
        .track li.done,
        .track li.at {
          color: #2f4a3a;
        }
        .track li.at {
          font-weight: 600;
        }
        .facts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin: 0;
          padding-top: 20px;
          border-top: 1px solid #f0ebe0;
        }
        .facts dt {
          color: #a89f90;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }
        .facts dd {
          margin: 0;
          color: #26302a;
          font-size: 14.5px;
          font-weight: 500;
        }
        .more {
          margin: 20px 0 0;
          padding-top: 16px;
          border-top: 1px solid #f0ebe0;
        }
        .more a {
          color: #2f4a3a;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
        }
        .more a:hover {
          color: #cf854f;
        }
        @media (max-width: 520px) {
          .track .lbl {
            font-size: 11px;
          }
        }
      `}</style>
    </section>
  );
}