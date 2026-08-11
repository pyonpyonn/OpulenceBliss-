"use client";

// SETUP: code "app/account/CurrentVisit.tsx"

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { VisitStatus } from "@/lib/visitStatus";

export type Visit = {
  id: string;
  status: string;
  scheduled_at: string;
  address: string | null;
  service: string;
  durationMinutes: number | null;
  providerName: string | null;
  providerRating: number | null;
  providerRatingCount?: number | null;
  paymentLabel?: string | null;
  arrivedAt: string | null;
  finishedAt?: string | null;
  providerBio?: string | null;
  householdNotes?: string | null;
  tipTotal?: number;
};

const STAGES = ["Booked", "Confirmed", "Arrived", "Done"];

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
    hour12: true,
  })}`;
}

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} hour${hrs === 1 ? "" : "s"}`;
  return `in ${Math.round(hrs / 24)} day${Math.round(hrs / 24) === 1 ? "" : "s"}`;
}

function shortWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function CurrentVisit({
  visit,
  hideLink,
  detailStatus,
  children,
}: {
  visit: Visit;
  hideLink?: boolean;
  detailStatus?: VisitStatus | null;
  children?: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  const live = visit.status === "in_progress";
  const idx = stageIndex(visit.status);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  let elapsed = "";
  let progress = 0;
  if (live && visit.arrivedAt) {
    const secs = Math.max(
      0,
      Math.floor((now - new Date(visit.arrivedAt).getTime()) / 1000),
    );
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    elapsed =
      (h > 0 ? `${h}:` : "") +
      `${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
    if (visit.durationMinutes)
      progress = Math.min(100, (secs / (visit.durationMinutes * 60)) * 100);
  }

  const soon = idx <= 1 ? countdown(visit.scheduled_at) : null;

  return (
    <section className={live ? "visit live" : "visit"}>
      <div className="top">
        <div>
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
        </div>
      )}

      <ol className="track">
        {STAGES.map((s, i) => (
          <li key={s} className={i < idx ? "done" : i === idx ? "at" : ""}>
            <span className="pip">{i < idx ? "✓" : i + 1}</span>
            <span className="lbl">{s}</span>
          </li>
        ))}
      </ol>

      <div className="facts">
        <div className="fact mint">
          <span>Your pro</span>
          <strong>
            {visit.providerName ?? "Matching…"}
            {visit.providerRating
              ? ` · ${Number(visit.providerRating).toFixed(1)}★${
                  visit.providerRatingCount
                    ? ` (${visit.providerRatingCount})`
                    : ""
                }`
              : ""}
          </strong>
        </div>
        <div className="fact sky">
          <span>Where</span>
          <strong>{visit.address ?? "—"}</strong>
        </div>
        <div className="fact butter">
          <span>How long</span>
          <strong>
            {visit.durationMinutes ? `${visit.durationMinutes} min` : "—"}
          </strong>
        </div>
        <div className="fact blush">
          <span>Payment</span>
          <strong>
            {visit.paymentLabel ?? (idx === 3 ? "Charged" : "Held")}
          </strong>
        </div>
      </div>

      {detailStatus && (
        <>
          <div className="status-summary">
            <strong>{detailStatus.headline}</strong>
            <p>{detailStatus.detail}</p>
          </div>
          <div className="status-details">
            <div className="status-box">
              <span>Waiting on</span>
              <strong>{detailStatus.nextActorLabel}</strong>
              <p>{detailStatus.nextActorDetail}</p>
            </div>
            <div className="status-box">
              <span>Your money</span>
              <strong>{detailStatus.money.label}</strong>
              <p>{detailStatus.money.explanation}</p>
            </div>
            {detailStatus.deadline && (
              <div className="status-box status-wide">
                <span>Next update</span>
                <strong>{detailStatus.deadline.label}</strong>
                <p>{shortWhen(detailStatus.deadline.at)}</p>
              </div>
            )}
          </div>
          {detailStatus.ifNobodyAccepts && (
            <p className="status-notice">
              <strong>If nobody accepts: </strong>
              {detailStatus.ifNobodyAccepts}
            </p>
          )}
          {detailStatus.reviewCase && (
            <p className="status-notice">
              <strong>
                {detailStatus.reviewCase.category.replace(/_/g, " ")}:{" "}
              </strong>
              {detailStatus.reviewCase.summary}
            </p>
          )}
        </>
      )}

      {detailStatus &&
        (visit.providerBio ||
          visit.householdNotes ||
          visit.arrivedAt ||
          visit.finishedAt ||
          (visit.tipTotal ?? 0) > 0) && (
          <div className="visit-notes">
            {visit.providerBio && (
              <div>
                <span>About your professional</span>
                <p>{visit.providerBio}</p>
              </div>
            )}
            {visit.householdNotes && (
              <div>
                <span>Your instructions</span>
                <p>{visit.householdNotes}</p>
              </div>
            )}
            {(visit.arrivedAt || visit.finishedAt) && (
              <div>
                <span>Recorded visit</span>
                <p>
                  {visit.arrivedAt
                    ? `Arrived ${shortWhen(visit.arrivedAt)}`
                    : "Arrival not recorded"}
                  {visit.finishedAt
                    ? ` · Finished ${shortWhen(visit.finishedAt)}`
                    : ""}
                </p>
              </div>
            )}
            {(visit.tipTotal ?? 0) > 0 && (
              <div>
                <span>Tip added</span>
                <p>£{(visit.tipTotal ?? 0).toFixed(2)}</p>
              </div>
            )}
          </div>
        )}

      {children && <div className="inside-actions">{children}</div>}

      {!hideLink && (
        <a className="more" href={`/account/visit/${visit.id}`}>
          See full details <span aria-hidden="true">→</span>
        </a>
      )}

      <style jsx>{`
        .visit {
          background: #fff;
          border: 2px solid #f1f1f2;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 16px;
          font-family: "Nunito", system-ui, sans-serif;
        }
        .visit.live {
          border-color: #b9dcf7;
          box-shadow: 0 14px 34px rgba(27, 94, 158, 0.1);
        }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          flex-wrap: wrap;
        }
        h2 {
          font-size: 23px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #1f2933;
          margin: 0 0 4px;
        }
        .when {
          color: #6b7280;
          font-size: 15px;
          font-weight: 600;
          margin: 0;
        }
        .timer {
          display: flex;
          align-items: baseline;
          gap: 8px;
          background: #ddedfb;
          border-radius: 16px;
          padding: 11px 16px;
        }
        .timer strong {
          font-size: 24px;
          font-weight: 900;
          color: #1b5e9e;
          font-variant-numeric: tabular-nums;
        }
        .timer small {
          color: #4b7fae;
          font-size: 12px;
          font-weight: 700;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #2f9e6e;
          align-self: center;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.25;
          }
        }
        .bar {
          height: 10px;
          background: #f1f1f2;
          border-radius: 999px;
          margin: 20px 0 4px;
          overflow: hidden;
        }
        .bar span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, #f5c542, #c86fc9 55%, #7b2ff7);
          border-radius: 999px;
          transition: width 1s linear;
        }
        .track {
          list-style: none;
          display: flex;
          gap: 4px;
          padding: 0;
          margin: 18px 0 16px;
        }
        .track li {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          color: #9ca3af;
          font-size: 12.5px;
          font-weight: 700;
        }
        .track li::before {
          content: "";
          position: absolute;
          top: 13px;
          left: 0;
          right: 50%;
          height: 4px;
          background: #f1f1f2;
        }
        .track li:first-child::before {
          display: none;
        }
        .track li.done::before,
        .track li.at::before {
          background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
        }
        .pip {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #f6f6f7;
          font-size: 13px;
          font-weight: 900;
          position: relative;
          z-index: 1;
          color: #9ca3af;
        }
        .track li.done .pip {
          background: #e9ddfd;
          color: #6d28d9;
        }
        .track li.at .pip {
          background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
          color: #fff;
        }
        .track li.done,
        .track li.at {
          color: #1f2933;
        }
        .facts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .status-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #f1f1f2;
        }
        .status-summary {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #f1f1f2;
        }
        .status-summary strong {
          display: block;
          color: #16202a;
          font-size: 17px;
          font-weight: 900;
        }
        .status-summary p {
          color: #58616c;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin: 4px 0 0;
        }
        .status-box {
          background: #f7f8f9;
          border-radius: 14px;
          padding: 14px 15px;
        }
        .status-box.status-wide {
          grid-column: 1 / -1;
        }
        .status-box span,
        .visit-notes span {
          display: block;
          color: #a0a7b0;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .status-box strong {
          display: block;
          color: #16202a;
          font-size: 16px;
          font-weight: 900;
        }
        .status-box p,
        .visit-notes p {
          color: #707985;
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.5;
          margin: 4px 0 0;
        }
        .visit-notes {
          display: grid;
          gap: 12px;
          margin-top: 12px;
          padding: 14px 15px;
          background: #fffaf0;
          border: 1px solid #f1e5ca;
          border-radius: 14px;
        }
        .status-notice {
          background: #fffaf0;
          border: 1px solid #f1e5ca;
          border-radius: 12px;
          color: #6f5a2a;
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.5;
          margin: 10px 0 0;
          padding: 11px 13px;
        }
        .inside-actions {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #f1f1f2;
        }
        .fact {
          border-radius: 13px;
          padding: 11px 12px;
        }
        .fact span {
          display: block;
          font-size: 11.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          opacity: 0.7;
          margin-bottom: 3px;
        }
        .fact strong {
          font-size: 14px;
          font-weight: 800;
          color: #1f2933;
          overflow-wrap: anywhere;
        }
        .mint {
          background: #e4f6ec;
          color: #137b4e;
        }
        .sky {
          background: #e3f0fb;
          color: #1b5e9e;
        }
        .butter {
          background: #fff3d6;
          color: #8a5a00;
        }
        .blush {
          background: #ffe6ea;
          color: #b0384f;
        }
        .more {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
          padding: 11px 18px;
          border-radius: 999px;
          background: #16202a;
          color: #fff;
          font-weight: 900;
          font-size: 14px;
          text-decoration: none;
        }
        .more:hover {
          background: #6d28d9;
        }
        @media (max-width: 520px) {
          h2 {
            font-size: 23px;
          }
          .track .lbl {
            font-size: 11px;
          }
          .facts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .status-details {
            grid-template-columns: minmax(0, 1fr);
          }
          .status-box.status-wide {
            grid-column: auto;
          }
          .more {
            display: flex;
            width: 100%;
            box-sizing: border-box;
          }
        }
      `}</style>
    </section>
  );
}
