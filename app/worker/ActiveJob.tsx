"use client";

// The provider's live job. Save at: app/worker/ActiveJob.tsx

import { useEffect, useState } from "react";
import BookingProgress from "@/components/BookingProgress";
import ParticipantSummary from "@/components/ParticipantSummary";
import JobActions from "./JobActions";

export type ActiveJobData = {
  id: string;
  status: string;
  scheduled_at: string;
  address: string | null;
  notes: string | null;
  client: string | null;
  clientEmail?: string | null;
  clientRating?: number | null;
  clientRatingCount?: number | null;
  service: string;
  durationMinutes: number | null;
  earns: number | null;
  paymentLabel?: string | null;
  arrivedAt: string | null;
  leftAt: string | null;
  geofencePass: boolean | null;
};

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

export default function ActiveJob({
  job,
  compact,
}: {
  job: ActiveJobData;
  compact?: boolean;
}) {
  const live = job.status === "in_progress";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  let elapsed = "";
  let progress = 0;
  if (live && job.arrivedAt) {
    const secs = Math.max(
      0,
      Math.floor((now - new Date(job.arrivedAt).getTime()) / 1000),
    );
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    elapsed =
      (h > 0 ? `${h}:` : "") +
      `${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
    if (job.durationMinutes) {
      progress = Math.min(100, (secs / (job.durationMinutes * 60)) * 100);
    }
  }

  const maps = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        job.address,
      )}`
    : null;

  return (
    <section
      className={`job${live ? " live" : ""}${compact ? " compact" : ""}`}
    >
      <div className="head">
        <div>
          <p className="eyebrow">
            {live
              ? "In progress now"
              : job.status === "completed"
                ? "Finished"
                : "Next job"}
          </p>
          <h2>{job.service}</h2>
          <p className="when">{whenLabel(job.scheduled_at)}</p>
        </div>
        {live ? (
          <div className="timer">
            <span className="dot" />
            <strong>{elapsed}</strong>
            <small>on site</small>
          </div>
        ) : job.earns !== null && !compact ? (
          <div className="pay">
            <strong>£{job.earns.toFixed(2)}</strong>
            <small>you earn</small>
          </div>
        ) : null}
      </div>

      {live && job.durationMinutes && (
        <div className="bar">
          <span style={{ width: `${progress}%` }} />
          <em>
            {Math.round(progress)}% of {job.durationMinutes} min
          </em>
        </div>
      )}

      <BookingProgress status={job.status} />

      <dl className="facts">
        <div>
          <dt>Customer</dt>
          <dd>
            {job.client ?? "—"}
            {job.clientRating
              ? ` · ${Number(job.clientRating).toFixed(1)}★${
                  job.clientRatingCount ? ` (${job.clientRatingCount})` : ""
                }`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>
            {job.address ?? "—"}
            {maps && (
              <>
                {" · "}
                <a href={maps} target="_blank" rel="noreferrer">
                  map
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{job.durationMinutes ? `${job.durationMinutes} min` : "—"}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>
            {job.paymentLabel ??
              (job.earns !== null ? `£${job.earns.toFixed(2)} secured` : "—")}
          </dd>
        </div>
      </dl>

      {!compact && (
        <ParticipantSummary
          roleLabel="Your customer"
          name={job.client}
          email={job.clientEmail}
          rating={job.clientRating ?? null}
          ratingCount={job.clientRatingCount ?? 0}
          ratingSource="provider"
          description="This score comes from providers after completed visits. Use Messages for arrival details or anything you need before the job."
        />
      )}

      {job.notes && !compact && (
        <div className="notes">
          <p className="notes-h">Client&apos;s notes</p>
          <p>{job.notes}</p>
        </div>
      )}

      {job.geofencePass === false && !compact && (
        <p className="flag">
          Location was flagged at check-in — you weren&apos;t near the address.
        </p>
      )}

      {!compact && (
        <JobActions
          id={job.id}
          status={job.status}
          scheduledAt={job.scheduled_at}
        />
      )}

      {compact && (
        <p className="more">
          <a href={live ? "/worker/current" : `/worker/job/${job.id}`}>
            See full details <span aria-hidden="true">→</span>
          </a>
        </p>
      )}

      <style jsx>{`
        .job {
          background: #fff;
          border: 1px solid #edeff1;
          border-radius: 20px;
          padding: 28px 28px 24px;
          font-family: "Nunito", system-ui, sans-serif;
        }
        .job.live {
          border-color: #c86fc9;
          box-shadow: 0 14px 36px rgba(22, 32, 42, 0.12);
        }
        .job.compact {
          border: 2px solid #f1f1f2;
          border-radius: 24px;
          padding: 20px;
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
          color: #6d28d9;
          margin: 0 0 6px;
        }
        h2 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: 27px;
          color: #16202a;
          margin: 0 0 4px;
        }
        .when {
          display: inline-flex;
          color: #16202a;
          background: #f7f8f9;
          border: 1px solid #e6e8eb;
          border-radius: 12px;
          padding: 8px 11px;
          font-size: 17px;
          font-weight: 900;
          line-height: 1.35;
          margin: 5px 0 0;
        }
        .timer,
        .pay {
          display: flex;
          align-items: baseline;
          gap: 7px;
          border-radius: 12px;
          padding: 10px 16px;
        }
        .timer {
          background: #f4ecfe;
        }
        .pay {
          background: #f7f8f9;
        }
        .timer strong,
        .pay strong {
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 23px;
          color: #16202a;
          font-variant-numeric: tabular-nums;
        }
        .timer small,
        .pay small {
          color: #7a828c;
          font-size: 12px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4b8c68;
          align-self: center;
          animation: pulse 1.6s ease-in-out infinite;
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
          background: #f1f2f4;
          border-radius: 999px;
          margin: 20px 0 26px;
        }
        .bar span {
          display: block;
          height: 100%;
          background: #c86fc9;
          border-radius: 999px;
          transition: width 1s linear;
        }
        .bar em {
          position: absolute;
          right: 0;
          top: 12px;
          font-style: normal;
          font-size: 12px;
          color: #7a828c;
        }
        .facts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin: 0;
          padding: 0;
          border: 0;
        }
        .facts > div {
          min-width: 0;
          padding: 11px 12px;
          border-radius: 13px;
          background: #f7f8f9;
        }
        .facts > div:nth-child(1) {
          background: #e4f6ec;
        }
        .facts > div:nth-child(2) {
          background: #e3f0fb;
        }
        .facts > div:nth-child(3) {
          background: #fff3d6;
        }
        .facts > div:nth-child(4) {
          background: #ffe6ea;
        }
        .facts dt {
          color: #a9afb7;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }
        .facts dd {
          margin: 0;
          color: #16202a;
          font-size: 14px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .facts a {
          color: #6d28d9;
          font-weight: 900;
        }
        .notes {
          background: #ffffff;
          border-radius: 12px;
          padding: 14px 16px;
          margin-top: 20px;
        }
        .notes-h {
          margin: 0 0 4px;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #a9afb7;
        }
        .notes p:last-child {
          margin: 0;
          font-size: 14.5px;
          color: #16202a;
        }
        .flag {
          background: #ffe6ea;
          color: #b0384f;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13.5px;
          margin: 16px 0 0;
        }
        .more {
          margin: 16px 0 0;
        }
        .more a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #16202a;
          color: #fff;
          border-radius: 999px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
        }
        .more a:hover {
          background: #6d28d9;
        }
        @media (max-width: 620px) {
          .facts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .more a {
            display: flex;
            width: 100%;
            box-sizing: border-box;
          }
        }
      `}</style>
    </section>
  );
}
