"use client";

// Opulence Bliss — landing page (home).
// Save at: app/page.tsx  (replaces the Supabase starter homepage)

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  service_type: string | null;
};

const money = (n: number) =>
  "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });

export default function Home() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [postcode, setPostcode] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name, description, price, service_type")
        .eq("active", true)
        .order("price");
      setPackages(data ?? []);
    })();
  }, []);

  return (
    <div className="site">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&display=swap"
      />

      {/* ---------- NAV ---------- */}
      <nav className="nav">
        <a href="/" className="brand">
          Opulence&nbsp;Bliss
        </a>
        <div className="nav-links">
          <a href="#cleaning">Cleaning</a>
          <a href="#massage">Massage</a>
          <a href="#how">How it works</a>
          <a href="#packages">Prices</a>
          <a href="/providers">Our pros</a>
          <a href="/account">My account</a>
          <a href="/provider/join">Work with us</a>
          <a href="/book" className="nav-cta">
            Book now
          </a>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Home &amp; wellness care, London</p>
          <h1>
            A home that cares
            <br />
            for you back.
          </h1>
          <p className="lede">
            Vetted cleaners and massage therapists, at your door when you want
            them. Book a single visit or come back whenever — pay per visit, no
            membership.
          </p>

          <div className="composer">
            <input
              placeholder="Enter your postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              aria-label="Postcode"
            />
            <a
              className="btn"
              href={`/book${postcode ? `?pc=${encodeURIComponent(postcode)}` : ""}`}
            >
              Check availability
            </a>
          </div>
          <p className="micro">
            Covering Central, North &amp; West London · pay per visit · no
            membership, no lock-in
          </p>
        </div>

        <aside className="hero-card">
          <span className="tag">Popular</span>
          <p className="hero-card-title">Two-hour clean, whenever you need it</p>
          <p className="hero-card-price">
            from £69 <span>per visit</span>
          </p>
          <ul>
            <li>Book a single visit or return anytime</li>
            <li>Eco-friendly products included</li>
            <li>Request your favourite pro again</li>
          </ul>
          <a className="btn wide" href="/book">
            Book a service
          </a>
        </aside>
      </header>

      {/* ---------- TRUST STRIP ---------- */}
      <section className="strip">
        {[
          ["Vetted & insured", "Every provider background-checked"],
          ["Clear per-visit price", "No hourly haggling, no membership"],
          ["Request your pro", "Loved them? Ask for them next time"],
          ["Book in 2 hours", "Same-day slots when pros are free"],
        ].map(([t, s]) => (
          <div key={t}>
            <strong>{t}</strong>
            <span>{s}</span>
          </div>
        ))}
      </section>

      {/* ---------- SERVICES ---------- */}
      <section id="services" className="band">
        <p className="eyebrow center">What we do</p>
        <h2 className="center">Two services, one standard</h2>
        <div className="two">
          <article className="svc">
            <span className="ico">✿</span>
            <h3>Home cleaning</h3>
            <p>
              Fortnightly or weekly cleans by a professional who learns your home —
              your products, your preferences, your rhythm.
            </p>
            <ul>
              <li>Kitchens, bathrooms, living spaces</li>
              <li>Eco products as standard</li>
              <li>Seasonal deep clean on higher tiers</li>
            </ul>
          </article>
          <article className="svc">
            <span className="ico">❋</span>
            <h3>In-home massage</h3>
            <p>
              Qualified therapists bringing the treatment room to you — no traffic,
              no waiting room, no rushing home afterwards.
            </p>
            <ul>
              <li>Deep tissue, Swedish, or relaxation</li>
              <li>60 or 90 minute sessions</li>
              <li>Table and linens provided</li>
            </ul>
          </article>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="band alt">
        <p className="eyebrow center">How it works</p>
        <h2 className="center">Four steps, then it just happens</h2>
        <ol className="steps">
          {[
            ["Choose your service", "Pick the visit that suits you."],
            ["Confirm your area", "We check a provider covers your postcode."],
            ["We match your pro", "A vetted professional accepts your booking."],
            ["Sit back", "They arrive, check in, and take care of it."],
          ].map(([t, s], i) => (
            <li key={t}>
              <span className="num">{i + 1}</span>
              <div>
                <strong>{t}</strong>
                <p>{s}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- SERVICES & PRICES ---------- */}
      <section id="packages" className="band">
        <p className="eyebrow center">Services &amp; prices</p>
        <h2 className="center">Simple, per-visit pricing</h2>
        <p className="center sub">
          Pay for the visit you book. No membership, no lock-in.
        </p>

        {packages.length === 0 ? (
          <p className="center muted">Loading services…</p>
        ) : (
          <>
            {/* Cleaning */}
            <div id="cleaning" className="svc-block">
              <div className="svc-head">
                <span className="ico">✿</span>
                <div>
                  <h3>Home cleaning</h3>
                  <p>
                    A vetted cleaner who learns your home. Products and equipment
                    included.
                  </p>
                </div>
              </div>
              <div className="pkgs">
                {packages
                  .filter((p) => (p.service_type ?? "").includes("clean"))
                  .map((p, i) => (
                    <article
                      key={p.id}
                      className={i === 0 ? "pkg featured" : "pkg"}
                    >
                      {i === 0 && <span className="pill">Most booked</span>}
                      <h4>{p.name}</h4>
                      <p className="pkg-price">
                        {money(p.price)} <span>per visit</span>
                      </p>
                      <p className="pkg-desc">{p.description}</p>
                      <a className="btn ghost" href="/book">
                        Book this
                      </a>
                    </article>
                  ))}
              </div>
            </div>

            {/* Massage */}
            <div id="massage" className="svc-block">
              <div className="svc-head">
                <span className="ico">❋</span>
                <div>
                  <h3>Massage therapy</h3>
                  <p>
                    A qualified therapist brings the treatment room to you — table
                    and fresh linens provided.
                  </p>
                </div>
              </div>
              <div className="pkgs">
                {packages
                  .filter((p) => (p.service_type ?? "").includes("massage"))
                  .map((p, i) => (
                    <article
                      key={p.id}
                      className={i === 1 ? "pkg featured" : "pkg"}
                    >
                      {i === 1 && <span className="pill">Best value</span>}
                      <h4>{p.name}</h4>
                      <p className="pkg-price">
                        {money(p.price)} <span>per visit</span>
                      </p>
                      <p className="pkg-desc">{p.description}</p>
                      <a className="btn ghost" href="/book">
                        Book this
                      </a>
                    </article>
                  ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      <section className="band alt">
        <p className="eyebrow center">From our members</p>
        <h2 className="center">Quietly, reliably better</h2>
        <div className="quotes">
          {[
            [
              "The same cleaner every fortnight has changed how our home feels. I no longer think about it — it's simply handled.",
              "Eleanor R. · Kensington",
            ],
            [
              "Having a therapist come to the house after a long week is the single best thing I've added to my routine.",
              "James T. · Hampstead",
            ],
            [
              "Booking took two minutes and the standard has never slipped. That's all I wanted.",
              "Priya M. · Chiswick",
            ],
          ].map(([q, who]) => (
            <blockquote key={who}>
              <p>{q}</p>
              <footer>{who}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="cta-band">
        <h2>Ready to hand it over?</h2>
        <p>Pick a service and a time — we&apos;ll match you with a pro.</p>
        <a className="btn light" href="/book">
          Book your first visit
        </a>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="foot">
        <div>
          <strong>Opulence Bliss</strong>
          <p>Premium home &amp; wellness care, London.</p>
        </div>
        <div className="foot-links">
          <a href="/book">Book</a>
          <a href="/account">My account</a>
          <a href="/provider/join">Become a provider</a>
          <a href="/worker">Provider login</a>
        </div>
      </footer>

      <style jsx>{`
        .site {
          --cream: #fbf7f0;
          --green: #2f4a3a;
          --green-mid: #5b7a65;
          --green-pale: #e7eee7;
          --apricot: #e7a579;
          --apricot-deep: #cf854f;
          --ink: #26302a;
          --muted: #6e7a70;
          --line: #ece5d8;
          background: var(--cream);
          color: var(--ink);
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          overflow-x: hidden;
        }
        h1,
        h2,
        h3 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          color: var(--green);
        }
        .center {
          text-align: center;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: var(--apricot-deep);
          margin: 0 0 8px;
        }
        .muted {
          color: var(--muted);
        }

        /* NAV */
        .nav {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(251, 247, 240, 0.92);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          gap: 20px;
        }
        .brand {
          font-family: "Fraunces", serif;
          font-size: 21px;
          font-weight: 600;
          color: var(--green);
          text-decoration: none;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 26px;
        }
        .nav-links a {
          color: var(--ink);
          text-decoration: none;
          font-size: 15px;
        }
        .nav-links a:hover {
          color: var(--apricot-deep);
        }
        .nav-cta {
          background: var(--green);
          color: var(--cream) !important;
          padding: 9px 18px;
          border-radius: 999px;
          font-weight: 600;
        }
        .nav-cta:hover {
          background: #263d30;
        }

        /* HERO */
        .hero {
          max-width: 1120px;
          margin: 0 auto;
          padding: 76px 28px 64px;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 56px;
          align-items: center;
        }
        h1 {
          font-size: clamp(42px, 6.4vw, 72px);
          line-height: 1.02;
          letter-spacing: -0.01em;
          margin: 0 0 18px;
        }
        .lede {
          font-size: 18px;
          color: var(--muted);
          line-height: 1.6;
          max-width: 46ch;
          margin: 0 0 30px;
        }
        .composer {
          display: flex;
          gap: 10px;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 7px 7px 7px 20px;
          max-width: 460px;
          box-shadow: 0 10px 30px rgba(47, 74, 58, 0.07);
        }
        .composer input {
          flex: 1;
          border: none;
          outline: none;
          font: inherit;
          font-size: 16px;
          background: transparent;
          color: var(--ink);
          text-transform: uppercase;
          min-width: 0;
        }
        .btn {
          background: var(--green);
          color: var(--cream);
          text-decoration: none;
          border-radius: 999px;
          padding: 12px 22px;
          font-weight: 600;
          font-size: 15px;
          white-space: nowrap;
          display: inline-block;
          transition: background 0.18s ease;
        }
        .btn:hover {
          background: #263d30;
        }
        .btn.wide {
          display: block;
          text-align: center;
          margin-top: 4px;
        }
        .btn.ghost {
          background: transparent;
          color: var(--green);
          border: 1.5px solid var(--green);
        }
        .btn.ghost:hover {
          background: var(--green-pale);
        }
        .btn.light {
          background: var(--cream);
          color: var(--green);
        }
        .btn.light:hover {
          background: #fff;
        }
        .micro {
          font-size: 13.5px;
          color: var(--muted);
          margin: 14px 0 0;
        }

        .hero-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 30px 28px;
          box-shadow: 0 20px 50px rgba(47, 74, 58, 0.1);
        }
        .tag {
          display: inline-block;
          background: var(--green-pale);
          color: var(--green);
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 999px;
        }
        .hero-card-title {
          font-family: "Fraunces", serif;
          font-size: 22px;
          color: var(--green);
          margin: 16px 0 6px;
          line-height: 1.2;
        }
        .hero-card-price {
          font-family: "Fraunces", serif;
          font-size: 30px;
          margin: 0 0 18px;
        }
        .hero-card-price span {
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 14px;
          color: var(--muted);
        }
        .hero-card ul {
          list-style: none;
          padding: 0;
          margin: 0 0 22px;
          display: grid;
          gap: 10px;
        }
        .hero-card li {
          font-size: 14.5px;
          padding-left: 22px;
          position: relative;
        }
        .hero-card li::before {
          content: "✿";
          position: absolute;
          left: 0;
          color: var(--apricot);
          font-size: 12px;
        }

        /* TRUST STRIP */
        .strip {
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          background: #fff;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          max-width: 1120px;
          margin: 0 auto;
        }
        .strip > div {
          padding: 26px 24px;
          border-right: 1px solid var(--line);
        }
        .strip > div:last-child {
          border-right: none;
        }
        .strip strong {
          display: block;
          color: var(--green);
          font-size: 15px;
          margin-bottom: 4px;
        }
        .strip span {
          font-size: 13.5px;
          color: var(--muted);
        }

        /* BANDS */
        .band {
          max-width: 1120px;
          margin: 0 auto;
          padding: 82px 28px;
        }
        .band.alt {
          max-width: none;
          background: #f6f1e8;
        }
        .band.alt > * {
          max-width: 1120px;
          margin-left: auto;
          margin-right: auto;
        }
        .band h2 {
          font-size: clamp(30px, 4.4vw, 44px);
          margin: 0 0 12px;
          line-height: 1.1;
        }
        .sub {
          color: var(--muted);
          margin: 0 0 40px;
        }

        .two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 26px;
          margin-top: 40px;
        }
        .svc {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 34px 32px;
        }
        .ico {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: var(--green-pale);
          color: var(--green);
          font-size: 20px;
          margin-bottom: 16px;
        }
        .svc h3 {
          font-size: 25px;
          margin: 0 0 10px;
        }
        .svc p {
          color: var(--muted);
          line-height: 1.6;
          margin: 0 0 18px;
        }
        .svc ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 9px;
        }
        .svc li {
          font-size: 14.5px;
          padding-left: 20px;
          position: relative;
        }
        .svc li::before {
          content: "·";
          position: absolute;
          left: 6px;
          color: var(--apricot-deep);
          font-weight: 700;
        }

        /* STEPS */
        .steps {
          list-style: none;
          padding: 0;
          margin: 44px 0 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 22px;
        }
        .steps li {
          display: grid;
          gap: 12px;
        }
        .num {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--green);
          color: var(--cream);
          font-family: "Fraunces", serif;
          font-size: 17px;
        }
        .steps strong {
          color: var(--green);
          font-size: 16.5px;
        }
        .steps p {
          color: var(--muted);
          font-size: 14.5px;
          margin: 6px 0 0;
          line-height: 1.55;
        }

        /* PACKAGES */
        .svc-block {
          margin-top: 44px;
        }
        .svc-head {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 22px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--line);
        }
        .svc-head h3 {
          font-size: 26px;
          margin: 0 0 4px;
        }
        .svc-head p {
          color: var(--muted);
          font-size: 15px;
          margin: 0;
          max-width: 52ch;
        }
        .pkg h4 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 21px;
          color: var(--green);
          margin: 0 0 6px;
        }
        .pkgs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(232px, 1fr));
          gap: 20px;
        }
        .pkg {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 30px 26px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .pkg.featured {
          border-color: var(--apricot);
          box-shadow: 0 16px 40px rgba(207, 133, 79, 0.14);
        }
        .pill {
          position: absolute;
          top: -11px;
          left: 26px;
          background: var(--apricot-deep);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 999px;
        }
        .pkg h3 {
          font-size: 22px;
          margin: 0 0 6px;
        }
        .pkg-price {
          font-family: "Fraunces", serif;
          font-size: 28px;
          margin: 0 0 12px;
        }
        .pkg-price span {
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 13.5px;
          color: var(--muted);
        }
        .pkg-desc {
          color: var(--muted);
          font-size: 14.5px;
          line-height: 1.55;
          margin: 0 0 22px;
        }
        .pkg .btn {
          margin-top: auto;
          text-align: center;
        }

        /* QUOTES */
        .quotes {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          margin-top: 42px;
        }
        blockquote {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 28px 26px;
          margin: 0;
        }
        blockquote p {
          font-family: "Fraunces", serif;
          font-size: 17.5px;
          line-height: 1.5;
          color: var(--ink);
          margin: 0 0 16px;
        }
        blockquote footer {
          font-size: 13.5px;
          color: var(--muted);
        }

        /* CTA */
        .cta-band {
          background: var(--green);
          color: var(--cream);
          text-align: center;
          padding: 76px 28px;
        }
        .cta-band h2 {
          color: var(--cream);
          font-size: clamp(30px, 4.4vw, 44px);
          margin: 0 0 10px;
        }
        .cta-band p {
          color: #cfdcd2;
          margin: 0 0 26px;
        }

        /* FOOTER */
        .foot {
          max-width: 1120px;
          margin: 0 auto;
          padding: 40px 28px 60px;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .foot strong {
          font-family: "Fraunces", serif;
          font-size: 18px;
          color: var(--green);
        }
        .foot p {
          color: var(--muted);
          font-size: 14px;
          margin: 6px 0 0;
        }
        .foot-links {
          display: flex;
          gap: 22px;
          align-items: flex-start;
        }
        .foot-links a {
          color: var(--green-mid);
          text-decoration: none;
          font-size: 14.5px;
        }
        .foot-links a:hover {
          color: var(--green);
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .hero {
            grid-template-columns: 1fr;
            padding-top: 52px;
            gap: 36px;
          }
          .strip,
          .steps,
          .quotes {
            grid-template-columns: 1fr 1fr;
          }
          .strip > div:nth-child(2) {
            border-right: none;
          }
          .two {
            grid-template-columns: 1fr;
          }
          .nav-links a:not(.nav-cta) {
            display: none;
          }
        }
        @media (max-width: 560px) {
          .strip,
          .steps,
          .quotes {
            grid-template-columns: 1fr;
          }
          .strip > div {
            border-right: none;
            border-bottom: 1px solid var(--line);
          }
          .composer {
            flex-direction: column;
            border-radius: 18px;
            padding: 14px;
          }
          .composer input {
            padding: 6px 4px;
          }
        }
      `}</style>
    </div>
  );
}
