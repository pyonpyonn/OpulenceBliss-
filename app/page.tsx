"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Pkg = { price: number; service_type: string | null; billing_type: string };

export default function Home() {
  const [from, setFrom] = useState<{ clean: number; massage: number }>({
    clean: 0,
    massage: 0,
  });
  const [postcode, setPostcode] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("packages")
        .select("price, service_type, billing_type")
        .eq("active", true)
        .eq("billing_type", "per_visit");

      const list = (data ?? []) as Pkg[];
      const min = (t: string) => {
        const p = list
          .filter((x) => (x.service_type ?? "").includes(t))
          .map((x) => Number(x.price));
        return p.length ? Math.min(...p) : 0;
      };
      setFrom({ clean: min("clean"), massage: min("massage") });
    })();
  }, []);

  const bookLink = postcode
    ? `/book?pc=${encodeURIComponent(postcode)}`
    : "/book";

  return (
    <main className="ob-home">
      <section className="ob-home-shell ob-home-shell-with-photo">
        <section className="ob-family-hero" aria-label="Premium home care">
          <div className="ob-family-hero-shade" />
          <div className="ob-family-progress-wrap">
            <div className="ob-booking-progress" aria-label="Booking steps">
              <div className="active"><b>01</b><span>Choose service</span></div>
              <div><b>02</b><span>Pick time</span></div>
              <div><b>03</b><span>Confirm booking</span></div>
            </div>
          </div>

          <div className="ob-family-hero-copy">
            <p className="ob-home-kicker">Premium home & wellness care</p>
            <h1>Book premium home care in minutes</h1>
            <p>
              Vetted cleaners and massage therapists across London.
              Book a single visit or a monthly membership — your call.
            </p>
            <div className="ob-family-hero-actions">
              <a href={bookLink} data-ob-primary="true">Book my cleaning <span>→</span></a>
              <a href="#services" className="ob-family-secondary">Explore services</a>
            </div>
          </div>
        </section>

        <div className="ob-service-grid ob-service-grid-overlap" id="services">
          <a className="ob-service-card cleaning" href="/services/cleaning">
            <div className="ob-service-icon">✦</div>
            <div className="ob-service-copy">
              <div className="ob-service-title-row">
                <h2>Cleaning</h2><span>Popular</span>
              </div>
              <p>Professional home cleaning and ironing, at home.</p>
              {from.clean > 0 && <strong>from £{from.clean}</strong>}
            </div>
            <i>→</i>
          </a>

          <a className="ob-service-card massage" href="/services/massage">
            <div className="ob-service-icon">♨</div>
            <div className="ob-service-copy">
              <div className="ob-service-title-row">
                <h2>Massage</h2><span>Relax</span>
              </div>
              <p>Expert at-home massage for total relaxation.</p>
              {from.massage > 0 && <strong>from £{from.massage}</strong>}
            </div>
            <i>→</i>
          </a>

          <a className="ob-service-card membership" href="/subscribe">
            <div className="ob-service-icon">♔</div>
            <div className="ob-service-copy">
              <div className="ob-service-title-row">
                <h2>Memberships</h2><span>Best value</span>
              </div>
              <p>Regular visits, handled for you with exclusive benefits.</p>
              <strong>from £189 / month</strong>
            </div>
            <i>→</i>
          </a>

          <a className="ob-service-card pros" href="/providers">
            <div className="ob-service-icon">◎</div>
            <div className="ob-service-copy">
              <div className="ob-service-title-row">
                <h2>Our pros</h2><span>Trusted</span>
              </div>
              <p>Vetted professionals, trusted by clients across London.</p>
              <strong>Meet the team</strong>
            </div>
            <i>→</i>
          </a>
        </div>

        <div className="ob-postcode-card">
          <div className="ob-location-icon">⌖</div>
          <div className="ob-postcode-copy">
            <strong>We cover Central, North & West London</strong>
            <span>Enter your postcode to see availability and prices.</span>
          </div>
          <div className="ob-postcode-form">
            <input
              placeholder="ENTER YOUR POSTCODE"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              aria-label="Postcode"
            />
            <a href={bookLink} data-ob-primary="true">Check coverage</a>
          </div>
        </div>

        <div className="ob-home-actions">
          <a className="ob-pricing-link" href="#how">See pricing & how it works →</a>
          <a className="ob-continue" href={bookLink} data-ob-primary="true">Continue <span>→</span></a>
        </div>

        <div className="ob-trust-row">
          {[
            ["◇", "Vetted & insured", "Every provider background-checked"],
            ["◈", "Clear pricing", "No hourly haggling, no hidden fees"],
            ["♡", "Your regular pro", "Ask for them again next time"],
            ["◷", "Book in 2 hours", "Same-day slots when pros are free"],
          ].map(([icon, title, sub]) => (
            <div key={title}>
              <i>{icon}</i>
              <span><strong>{title}</strong><small>{sub}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="ob-home-section" id="how">
        <p className="ob-home-kicker">How it works</p>
        <h2>Four steps, then it just happens</h2>
        <div className="ob-steps-grid">
          {[
            ["01", "Enter your postcode", "We check we cover you."],
            ["02", "Choose your service", "See the price before you commit."],
            ["03", "Pick a time", "Only times a pro is genuinely free."],
            ["04", "Sit back", "They arrive, check in, and take care of it."],
          ].map(([n, title, text]) => (
            <article key={n}>
              <b>{n}</b><h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ob-home-section ob-testimonials">
        <p className="ob-home-kicker">From our members</p>
        <h2>Quietly, reliably better</h2>
        <div className="ob-quotes-grid">
          {[
            ["The same cleaner every fortnight has changed how our home feels. I no longer think about it.", "Eleanor R. · Kensington"],
            ["Having a therapist come to the house after a long week is the best thing I've added to my routine.", "James T. · Hampstead"],
            ["Booking took two minutes and the standard has never slipped. That's all I wanted.", "Priya M. · Chiswick"],
          ].map(([quote, who]) => (
            <blockquote key={who}><p>{quote}</p><footer>{who}</footer></blockquote>
          ))}
        </div>
      </section>

      <section className="ob-final-cta">
        <div><p className="ob-home-kicker">Ready when you are</p><h2>Ready to hand it over?</h2><span>See what&apos;s free this week.</span></div>
        <a href="/book" data-ob-primary="true">Book a service →</a>
      </section>

      <footer className="ob-home-footer">
        <div><strong>opulence<span>bliss</span></strong><p>Premium home & wellness care, London.</p></div>
        <nav>
          <a href="/services/cleaning">Cleaning</a>
          <a href="/services/massage">Massage</a>
          <a href="/subscribe">Memberships</a>
          <a href="/provider/join">Work with us</a>
          <a href="/worker">Provider login</a>
        </nav>
      </footer>
    </main>
  );
}
