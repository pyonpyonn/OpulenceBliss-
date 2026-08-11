"use client";

const STAGES = ["Booked", "Confirmed", "Arrived", "Done"];

function stageIndex(status: string) {
  if (["offered", "declined"].includes(status)) return 0;
  if (status === "scheduled") return 1;
  if (status === "in_progress") return 2;
  if (status === "completed") return 3;
  return 0;
}

export default function BookingProgress({ status }: { status: string }) {
  const current = stageIndex(status);

  return (
    <div
      className="booking-progress"
      aria-label={`Booking progress: ${STAGES[current]}`}
    >
      <span className="rail" aria-hidden="true" />
      <span
        className="fill"
        aria-hidden="true"
        style={{ width: `${current * 25}%` }}
      />
      <ol>
        {STAGES.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={label}
              className={done ? "done" : active ? "active" : "future"}
            >
              <span className="node">{done ? "✓" : index + 1}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>

      <style jsx>{`
        .booking-progress {
          position: relative;
          margin: 19px 0 17px;
          padding-top: 1px;
        }
        .rail,
        .fill {
          position: absolute;
          top: 15px;
          left: 12.5%;
          height: 5px;
          border-radius: 999px;
        }
        .rail {
          right: 12.5%;
          background: #eceef1;
        }
        .fill {
          max-width: 75%;
          background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
          transition: width 0.35s ease;
        }
        ol {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li {
          display: grid;
          justify-items: center;
          gap: 7px;
          color: #a0a7b0;
          min-width: 0;
        }
        .node {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          box-sizing: border-box;
          border: 3px solid #fff;
          border-radius: 50%;
          background: #eceef1;
          color: #89919b;
          font-size: 12px;
          font-weight: 900;
          box-shadow: 0 0 0 1px #e2e5e9;
        }
        li.done .node {
          background: #e9ddfd;
          color: #6d28d9;
          box-shadow: 0 0 0 1px #d8c2f7;
        }
        li.active .node {
          background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
          color: #fff;
          box-shadow:
            0 0 0 1px #c86fc9,
            0 0 0 5px rgba(200, 111, 201, 0.13);
        }
        li.done,
        li.active {
          color: #16202a;
        }
        strong {
          font-size: 12px;
          font-weight: 900;
          text-align: center;
        }
        @media (max-width: 420px) {
          strong {
            font-size: 10.5px;
          }
          .node {
            width: 27px;
            height: 27px;
          }
          .rail,
          .fill {
            top: 13.5px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fill {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
