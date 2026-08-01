"use client";

// Our professionals — public list of vetted, active providers.
// Save at: app/providers/page.tsx

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type P = {
  id: string;
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  years_experience: number | null;
  services: string[] | null;
  rating_avg: number | null;
  rating_count: number;
};

const SERVICE_LABEL: Record<string, string> = {
  cleaning: "Home cleaning",
  massage: "Massage therapy",
};

export default function ProvidersPage() {
  const [list, setList] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("providers")
        .select(
          "id, display_name, bio, photo_url, years_experience, services, rating_avg, rating_count"
        )
        .eq("vetting_status", "approved")
        .eq("joining_fee_paid", true)
        .order("rating_avg", { ascending: false, nullsFirst: false });
      setList(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap"
      />

      <div className="inner">
        <a className="brand" href="/">
          Opulence&nbsp;Bliss
        </a>

        <p className="eyebrow">Our professionals</p>
        <h1>The people who&apos;ll be in your home</h1>
        <p className="lede">
          Every provider is vetted, insured and rated by the clients they&apos;ve
          worked for. We&apos;ll match you with whoever&apos;s best placed for
          your booking.
        </p>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <div className="empty">
            No active professionals yet.{" "}
            <a href="/provider/join">Join as a provider →</a>
          </div>
        ) : (
          <div className="grid">
            {list.map((p) => (
              <article key={p.id} className="card">
                <div className="head">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt={p.display_name ?? "Provider"} />
                  ) : (
                    <div className="initials">
                      {(p.display_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2>{p.display_name ?? "Opulence provider"}</h2>
                    <p className="meta">
                      {(p.services ?? [])
                        .map((s) => SERVICE_LABEL[s] ?? s)
                        .join(" · ")}
                      {p.years_experience
                        ? ` · ${p.years_experience} yrs experience`
                        : ""}
                    </p>
                    <p className="stars">
                      {p.rating_avg ? (
                        <>
                          <span>
                            {"★".repeat(Math.round(Number(p.rating_avg)))}
                            {"☆".repeat(5 - Math.round(Number(p.rating_avg)))}
                          </span>{" "}
                          {Number(p.rating_avg).toFixed(1)} ({p.rating_count})
                        </>
                      ) : (
                        <span className="new">Newly joined</span>
                      )}
                    </p>
                  </div>
                </div>
                {p.bio && <p className="bio">{p.bio}</p>}
              </article>
            ))}
          </div>
        )}

        <div className="cta-row">
          <a className="cta" href="/book">
            Book a service
          </a>
          <a className="ghost" href="/provider/join">
            Work with us
          </a>
        </div>
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
          max-width: 820px;
          margin: 0 auto;
          padding-top: 40px;
        }
        .brand {
          font-family: "Fraunces", serif;
          font-size: 19px;
          font-weight: 600;
          color: #2f4a3a;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 26px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: #cf854f;
          margin: 0 0 8px;
        }
        h1 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: clamp(30px, 4.6vw, 44px);
          line-height: 1.08;
          color: #2f4a3a;
          margin: 0 0 12px;
        }
        .lede {
          color: #6e7a70;
          font-size: 17px;
          line-height: 1.6;
          max-width: 54ch;
          margin: 0 0 34px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 18px;
        }
        .card {
          background: #fff;
          border: 1px solid #ece5d8;
          border-radius: 18px;
          padding: 24px 24px;
        }
        .head {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        .head img,
        .initials {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
        }
        .initials {
          display: grid;
          place-items: center;
          background: #e7eee7;
          color: #2f4a3a;
          font-family: "Fraunces", serif;
          font-size: 26px;
        }
        h2 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 21px;
          color: #2f4a3a;
          margin: 0 0 4px;
        }
        .meta {
          color: #6e7a70;
          font-size: 13.5px;
          margin: 0 0 6px;
        }
        .stars {
          margin: 0;
          font-size: 13.5px;
          color: #6e7a70;
        }
        .stars span {
          color: #cf854f;
          letter-spacing: 1px;
        }
        .stars .new {
          color: #a89f90;
          letter-spacing: 0;
        }
        .bio {
          color: #26302a;
          font-size: 14.5px;
          line-height: 1.6;
          margin: 16px 0 0;
        }
        .empty {
          background: #fff;
          border: 1.5px dashed #d8cfbe;
          border-radius: 14px;
          padding: 30px 24px;
          text-align: center;
          color: #6e7a70;
        }
        .empty a {
          color: #2f4a3a;
          font-weight: 600;
        }
        .cta-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 34px;
        }
        .cta,
        .ghost {
          border-radius: 999px;
          padding: 13px 26px;
          text-decoration: none;
          font-weight: 600;
          font-size: 15px;
        }
        .cta {
          background: #2f4a3a;
          color: #fbf7f0;
        }
        .ghost {
          border: 1.5px solid #2f4a3a;
          color: #2f4a3a;
        }
        .muted {
          color: #6e7a70;
        }
      `}</style>
    </main>
  );
}