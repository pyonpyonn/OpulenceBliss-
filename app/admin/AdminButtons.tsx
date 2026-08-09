"use client";

// Admin buttons with a confirm step. Save at: app/admin/AdminButtons.tsx

import { useTransition, useState } from "react";
import {
  bringBookingToNow,
  wipeAvailability,
  wipeReviews,
  resetJoiningFees,
} from "./actions";

type Job = {
  label: string;
  hint: string;
  confirm: string;
  run: () => Promise<void>;
  danger?: boolean;
};

export default function AdminButtons() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const jobs: Job[] = [
    {
      label: "Move next booking to now",
      hint: "For testing: pulls the soonest upcoming visit forward a couple of minutes so you can check in and out straight away. Real rules still apply.",
      confirm: "Move the next upcoming booking to right now?",
      run: async () => { await bringBookingToNow(); },
    },
    {
      label: "Clear all availability",
      hint: "Wipes every provider's working hours. They'll need to set them again.",
      confirm: "Delete all provider availability?",
      run: wipeAvailability,
    },
    {
      label: "Clear all reviews",
      hint: "Deletes every rating from both sides and resets the cached averages.",
      confirm: "Delete all reviews and reset ratings?",
      run: wipeReviews,
    },
    {
      label: "Reset joining fees",
      hint: "Marks every provider as unpaid, so you can re-test the £150 paywall.",
      confirm: "Reset all providers to unpaid?",
      run: resetJoiningFees,
    },
  ];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {jobs.map((j) => (
        <div
          key={j.label}
          style={{
            background: "#fff",
            border: `1.5px solid ${j.danger ? "#e6b0b0" : "#ece5d8"}`,
            borderRadius: 14,
            padding: "18px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <strong
              style={{
                display: "block",
                color: j.danger ? "#8a2f2f" : "#2f4a3a",
                fontSize: 15.5,
                marginBottom: 3,
              }}
            >
              {j.label}
            </strong>
            <span style={{ color: "#6e7a70", fontSize: 13.5 }}>{j.hint}</span>
          </div>
          <button
            disabled={pending}
            onClick={() => {
              if (!window.confirm(j.confirm)) return;
              setDone(null);
              start(async () => {
                await j.run();
                setDone(j.label);
              });
            }}
            style={{
              background: j.danger ? "#8a2f2f" : "transparent",
              color: j.danger ? "#fff" : "#8a4b26",
              border: j.danger ? "none" : "1.5px solid #e6c4b0",
              borderRadius: 999,
              padding: "10px 20px",
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {pending ? "Working…" : "Run"}
          </button>
        </div>
      ))}

      {done && (
        <p
          style={{
            background: "#e7eee7",
            color: "#2f4a3a",
            padding: "12px 14px",
            borderRadius: 10,
            fontSize: 14.5,
            margin: 0,
          }}
        >
          Done — {done.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
