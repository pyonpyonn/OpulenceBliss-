"use client";

// The provider's live job. Save at: app/worker/ActiveJob.tsx

import { useEffect, useState } from "react";
import JobActions from "./JobActions";

export type ActiveJobData = {
  id: string;
  status: string;
  scheduled_at: string;
  address: string | null;
  notes: string | null;
  client: string | null;
  service: string;
  durationMinutes: number | null;
  earns: number | null;
  arrivedAt: string | null;
  leftAt: string | null;
  geofencePass: boolean | null;
};

const STAGES = ["Offered", "Accepted", "On site", "Finished"];

function stageIndex(s: string) {
  if (s === "offered") return 0;
  if (s === "scheduled") return 1;
  if (s === "in_progress") return 2;
  if (s === "completed") return 3;
  return 0;
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
  return `${day}, ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
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
      Math.floor((now - new Date(job.arrivedAt).getTime()) / 1000)
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

  const idx = stageIndex(job.status);
  const maps = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        job.address
      )}`
    : null;

  return (
    <section className={live ? "job live" : "job"}>
      <div className="head">
        <div>
          <p className="eyebrow">
            {live ? "In progress now" : idx === 3 ? "Finished" : "Next job"}
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
        ) : job.earns !== null ? (
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

      <ol className="track">
        {STAGES.map((label, i) => (
          <li key={label} className={i < idx ? "done" : i === idx ? "at" : ""}>
            <span className="pip">{i < idx ? "✓" : i + 1}</span>
            <span className="lbl">{label}</span>
          </li>
        ))}
      </ol>

      <dl className="facts">
        <div>
          <dt>Client</dt>
          <dd>{job.client ?? "—"}</dd>
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
          <dt>You earn</dt>
          <dd>{job.earns !== null ? `£${job.earns.toFixed(2)}` : "—"}</dd>
        </div>
      </dl>

      {job.notes && (
        <div className="notes">
          <p className="notes-h">Client&apos;s notes</p>
          <p>{job.notes}</p>
        </div>
      )}

      {job.geofencePass === false && (
        <p className="flag">
          Location was flagged at check-in — you weren&apos;t near the address.
        </p>
      )}

      <JobActions id={job.id} status={job.status} />

      {compact && (
        <p className="more">
          <a href={`/worker/job/${job.id}`}>Open full job page →</a>
        </p>
      )}

      <style jsx>{`
        .job {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 20px;
          padding: 28px 28px 24px;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
        }
        .job.live {
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
        .timer,
        .pay {
          display: flex;
          align-items: baseline;
          gap: 7px;
          border-radius: 12px;
          padding: 10px 16px;
        }
        .timer {
          background: #e7eee7;
        }
        .pay {
          background: #f6f1e8;
        }
        .timer strong,
        .pay strong {
          font-family: "Fraunces", serif;
          font-size: 23px;
          color: #2f4a3a;
          font-variant-numeric: tabular-nums;
        }
        .timer small,
        .pay small {
          color: #6e7a70;
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
          background: #f0ebe0;
          border-radius: 999px;
          margin: 20px 0 26px;
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
          margin: 24px 0 22px;
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
        .facts a {
          color: #5b7a65;
          font-weight: 500;
        }
        .notes {
          background: #fbf7f0;
          border-radius: 12px;
          padding: 14px 16px;
          margin-top: 20px;
        }
        .notes-h {
          margin: 0 0 4px;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #a89f90;
        }
        .notes p:last-child {
          margin: 0;
          font-size: 14.5px;
          color: #26302a;
        }
        .flag {
          background: #f6e7dd;
          color: #8a4b26;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13.5px;
          margin: 16px 0 0;
        }
        .more {
          margin: 16px 0 0;
        }
        .more a {
          color: #5b7a65;
          font-size: 14px;
          text-decoration: none;
        }
        .more a:hover {
          color: #2f4a3a;
        }
      `}</style>
    </section>
  );
}
