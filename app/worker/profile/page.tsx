"use client";

// Provider profile — what clients see about you.
// Save at: app/worker/profile/page.tsx

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function ProviderProfilePage() {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("");
  const [photo, setPhoto] = useState("");
  const [rating, setRating] = useState<{ avg: number | null; count: number }>({
    avg: null,
    count: 0,
  });
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
      const { data } = await supabase
        .from("providers")
        .select(
          "id, display_name, bio, years_experience, photo_url, rating_avg, rating_count"
        )
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!data) {
        setMsg("This account isn't set up as a provider.");
        setLoading(false);
        return;
      }
      setId(data.id);
      setName(data.display_name ?? "");
      setBio(data.bio ?? "");
      setYears(data.years_experience ? String(data.years_experience) : "");
      setPhoto(data.photo_url ?? "");
      setRating({
        avg: data.rating_avg ? Number(data.rating_avg) : null,
        count: data.rating_count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!id) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("providers")
      .update({
        display_name: name.trim() || null,
        bio: bio.trim() || null,
        years_experience: years ? Number(years) : null,
        photo_url: photo.trim() || null,
      })
      .eq("id", id);
    setMsg(error ? error.message : "Saved — this is what clients will see.");
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
        <h1>Your profile</h1>
        <p className="lede">
          Clients see this when they browse our professionals. A good photo and a
          short, human bio win more work.
        </p>

        {!signedIn ? (
          <div className="card center">
            <p>Please log in as a provider.</p>
            <a className="cta" href="/login">
              Go to log in
            </a>
          </div>
        ) : loading ? (
          <p className="muted">Loading…</p>
        ) : !id ? (
          <div className="card center">{msg}</div>
        ) : (
          <>
            <div className="card">
              <div className="rating">
                {rating.avg ? (
                  <>
                    <strong>{rating.avg.toFixed(1)} ★</strong>
                    <span>
                      from {rating.count} review{rating.count === 1 ? "" : "s"}
                    </span>
                  </>
                ) : (
                  <span>No reviews yet — your rating appears here.</span>
                )}
              </div>

              <label>Display name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane S."
              />

              <label>Short bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="I've cleaned homes across west London for six years. I'm thorough, tidy and I always leave a note about anything that needs attention."
              />

              <label>Years of experience</label>
              <input
                type="number"
                min={0}
                max={60}
                value={years}
                onChange={(e) => setYears(e.target.value)}
                placeholder="6"
              />

              <label>Photo URL (optional)</label>
              <input
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                placeholder="https://…"
              />
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="preview" src={photo} alt="Profile preview" />
              )}
            </div>

            <button className="cta" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
            {msg && <p className="msg">{msg}</p>}
          </>
        )}

        <p className="links">
          <a href="/worker">← My jobs</a>
          <a href="/worker/earnings">My earnings</a>
          <a href="/worker/availability">My availability</a>
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
          max-width: 580px;
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
          padding: 24px 22px;
          margin-bottom: 20px;
        }
        .card.center {
          text-align: center;
        }
        .rating {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fbf7f0;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 22px;
          font-size: 14.5px;
          color: #6e7a70;
        }
        .rating strong {
          color: #cf854f;
          font-size: 17px;
        }
        label {
          display: block;
          font-size: 13.5px;
          color: #6e7a70;
          margin: 0 0 6px;
        }
        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1.5px solid #d8d2c6;
          border-radius: 12px;
          font: inherit;
          font-size: 15.5px;
          background: #fff;
          color: #26302a;
          margin-bottom: 18px;
          resize: vertical;
        }
        input:focus-visible,
        textarea:focus-visible {
          outline: none;
          border-color: #2f4a3a;
        }
        .preview {
          width: 84px;
          height: 84px;
          object-fit: cover;
          border-radius: 50%;
          border: 2px solid #ece5d8;
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
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
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
