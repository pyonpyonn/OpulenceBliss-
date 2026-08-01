"use client";

// Worker availability — set the days and hours you work.
// Save at: app/worker/availability/page.tsx

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HOURS = Array.from({ length: 15 }, (_, i) => 7 + i); // 07:00 – 21:00
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

type Row = { on: boolean; start: number; end: number };

export default function AvailabilityPage() {
  const [providerId, setProviderId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(
    DAYS.map((_, i) => ({ on: i >= 1 && i <= 5, start: 9, end: 17 }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSignedIn(false);
        setLoading(false);
        return;
      }

      const { data: prov } = await supabase
        .from("providers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!prov) {
        setMsg("This account isn't set up as a provider.");
        setLoading(false);
        return;
      }
      setProviderId(prov.id);

      const { data: avail } = await supabase
        .from("provider_availability")
        .select("weekday, start_time, end_time")
        .eq("provider_id", prov.id);

      if (avail && avail.length) {
        const next = DAYS.map(() => ({ on: false, start: 9, end: 17 }));
        for (const a of avail) {
          next[a.weekday] = {
            on: true,
            start: parseInt(String(a.start_time).slice(0, 2), 10),
            end: parseInt(String(a.end_time).slice(0, 2), 10),
          };
        }
        setRows(next);
      }
      setLoading(false);
    })();
  }, []);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setMsg(null);
  }

  async function save() {
    if (!providerId) return;
    setSaving(true);
    setMsg(null);

    await supabase
      .from("provider_availability")
      .delete()
      .eq("provider_id", providerId);

    const payload = rows
      .map((r, i) => ({ ...r, weekday: i }))
      .filter((r) => r.on && r.end > r.start)
      .map((r) => ({
        provider_id: providerId,
        weekday: r.weekday,
        start_time: hh(r.start),
        end_time: hh(r.end),
      }));

    if (payload.length) {
      const { error } = await supabase
        .from("provider_availability")
        .insert(payload);
      setMsg(error ? error.message : "Saved — clients can now book these times.");
    } else {
      setMsg("Saved — you're marked as unavailable.");
    }
    setSaving(false);
  }

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap"
      />

      <div className="inner">
        <p className="eyebrow">Provider area</p>
        <h1>Your availability</h1>
        <p className="lede">
          Clients can only book times you&apos;re open. Update this whenever your
          week changes.
        </p>

        {!signedIn ? (
          <div className="card center">
            <p>Please log in as a provider to set your hours.</p>
            <a className="cta" href="/login">
              Go to log in
            </a>
          </div>
        ) : loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="card">
              {DAYS.map((d, i) => (
                <div key={d} className={rows[i].on ? "row on" : "row"}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={rows[i].on}
                      onChange={(e) => update(i, { on: e.target.checked })}
                    />
                    <span>{d}</span>
                  </label>

                  {rows[i].on ? (
                    <div className="hours">
                      <select
                        value={rows[i].start}
                        onChange={(e) =>
                          update(i, { start: Number(e.target.value) })
                        }
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {hh(h)}
                          </option>
                        ))}
                      </select>
                      <em>to</em>
                      <select
                        value={rows[i].end}
                        onChange={(e) =>
                          update(i, { end: Number(e.target.value) })
                        }
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {hh(h)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="off">Not working</span>
                  )}
                </div>
              ))}
            </div>

            <button className="cta" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save availability"}
            </button>
            {msg && <p className="msg">{msg}</p>}
          </>
        )}

        <p className="links">
          <a href="/worker">← Back to my jobs</a>
        </p>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #fbf7f0;
          color: #26302a;
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          padding: 0 20px 80px;
        }
        .inner {
          max-width: 620px;
          margin: 0 auto;
          padding-top: 40px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: #cf854f;
          margin: 0 0 6px;
        }
        h1 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 36px;
          color: #2f4a3a;
          margin: 0 0 8px;
        }
        .lede {
          color: #6e7a70;
          margin: 0 0 26px;
        }
        .card {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 16px;
          padding: 6px 22px;
          margin-bottom: 22px;
        }
        .card.center {
          text-align: center;
          padding: 30px 22px;
        }
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid #f0ebe0;
          flex-wrap: wrap;
        }
        .row:last-child {
          border-bottom: none;
        }
        .toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15.5px;
          cursor: pointer;
        }
        .toggle input {
          width: 17px;
          height: 17px;
          accent-color: #2f4a3a;
          cursor: pointer;
        }
        .row.on .toggle span {
          font-weight: 600;
          color: #2f4a3a;
        }
        .hours {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hours select {
          border: 1.5px solid #d8d2c6;
          border-radius: 10px;
          padding: 7px 10px;
          font: inherit;
          font-size: 14.5px;
          background: #fff;
          color: #26302a;
        }
        .hours em {
          font-style: normal;
          color: #6e7a70;
          font-size: 14px;
        }
        .off {
          color: #a89f90;
          font-size: 14px;
        }
        .cta {
          background: #2f4a3a;
          color: #fbf7f0;
          border: none;
          border-radius: 999px;
          padding: 13px 26px;
          font: inherit;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        .cta:hover {
          background: #263d30;
        }
        .cta:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .msg {
          background: #e7eee7;
          color: #2f4a3a;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14.5px;
          margin: 16px 0 0;
        }
        .muted {
          color: #6e7a70;
        }
        .links {
          margin-top: 30px;
        }
        .links a {
          color: #5b7a65;
          font-size: 14px;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}