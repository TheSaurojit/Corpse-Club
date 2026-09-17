'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const games = [
  { title: 'GTA 5',          type: 'Open World / Heists',        copy: 'High-stakes heists and chaos across Los Santos on ultra-crisp 4K.',               image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/library_600x900.jpg',    index: '01' },
  { title: 'Spider-Man 2',   type: 'Solo / Action Adventure',    copy: 'Web-sling across Marvel’s New York with lightning-fast SSD traversal.',          image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2651280/library_600x900.jpg',   index: '02' },
  { title: 'FC 26',          type: 'Duo / Competitive',         copy: 'Settle the score in a no-excuses head-to-head football showdown.',                image: 'https://image.api.playstation.com/vulcan/ap/rnd/202608/0314/d0cc38456ebe67005ebea2709f52a3d2f6780985b6403219.png',   index: '03' },
  { title: 'Mortal Kombat',  type: 'Duo / Fight Night',          copy: 'Brutal fatalities and bone-crushing combos on low-latency displays.',             image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1971870/library_600x900.jpg',   index: '04' },
  { title: 'It Takes Two',   type: 'Co-Op / Split Screen',       copy: 'Pure two-player chemistry. Either communicate or start over.',                   image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1426210/library_600x900.jpg',   index: '05' },
  { title: 'WWE',       type: 'Duo / Ring Mayhem',          copy: 'Step inside the squared circle with bone-rattling slams and electric finishes.',  image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2878960/library_600x900.jpg',   index: '06' },
  { title: 'Rocket League',  type: 'Competitive / Fast-Paced',   copy: 'Rocket-powered soccer with aerial control and 120Hz response.',                   image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/252950/library_600x900.jpg',    index: '07' },
  { title: 'F1',             type: 'Solo & Duo / Precision Racing', copy: 'Hit every apex at 300 km/h with DualSense adaptive trigger feedback.',       image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2488620/library_600x900.jpg',   index: '08' },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMotionReady(true), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className={`funk-viewport ${motionReady ? 'funk-ready' : 'funk-pending'}`}>
      <div className="funk-stage">
        <video className="funk-video" autoPlay muted loop playsInline disablePictureInPicture aria-hidden="true">
          <source src="/video/IMG_5786.MP4" type="video/mp4" />
        </video>
        <div className="funk-vignette" aria-hidden="true" />
        <div className="funk-grain" aria-hidden="true" />

        <header className={`funk-header ${menuOpen ? 'is-open' : ''}`}>
          <Link href="/" className="funk-brand" aria-label="Corpse Club home"><span>Corpse</span><strong>Club</strong></Link>
          <div className="funk-header__actions">
            <nav className="funk-nav" aria-label="Main navigation">
              <a href="#lounge"   onClick={() => setMenuOpen(false)}>Lounge</a>
              <a href="#library"  onClick={() => setMenuOpen(false)}>Library</a>
              <a href="#ps5"      onClick={() => setMenuOpen(false)}>PS5 Pricing</a>
              <a href="#contact"  onClick={() => setMenuOpen(false)}>Contact</a>
            </nav>
            <div className="funk-time"><span></span></div>
            <Link href="/book" className="funk-book">Book now</Link>
          </div>
          <button className="funk-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}><i /><i /></button>
        </header>

        <section id="lounge" className="funk-hero" aria-labelledby="hero-title">
          <div className="funk-copy">
            <h1 id="hero-title" className="funk-title">
              <span className="funk-line funk-line--one"><span>PLAY AFTER</span></span>
              <span className="funk-line funk-line--two"><span>DARK.</span></span>
            </h1>
            <p>The lights are low. The frames are high.<br />Corpse Club turns every session into a proper<br />night out — no queues, no filler, all game.</p>
            <Link href="/book" className="funk-cta"><span>Book Now</span></Link>
          </div>
          <div className="funk-foot"><span> India</span><span>Corpse Club — est. 2026</span></div>
        </section>
      </div>

      {/* ── Game library ─────────────────────────────────────── */}
      <section className="funk-games" id="library" aria-labelledby="games-title">
        <div className="funk-section-head">
          <span>01 / Game library</span>
          <p>Pick your poison. We have the screen, the sound, and no reason to rush.</p>
        </div>
        <h2 id="games-title">THE <em>LINEUP.</em></h2>
        <div className="funk-game-grid">
          {games.map((game) => (
            <article className="funk-game" key={game.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={game.image} alt={game.title} />
              <div className="funk-game__veil" aria-hidden="true" />
              <span className="funk-game__number">{game.index}</span>
              <div className="funk-game__copy">
                <p>{game.type}</p>
                <h3>{game.title}</h3>
                <span className="funk-game__description">{game.copy}</span>
                <Link href="/book">Book this game <span>↗</span></Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Lounge ───────────────────────────────────────────── */}
      <section className="funk-lounge" id="pods">
        <div className="funk-lounge__headline"><span>02 / The lounge</span><h2>NO NOISE.<br /><em>ALL FOCUS.</em></h2></div>
        <div className="funk-lounge__copy"><p>Private pods, 4K OLED displays and DualSense haptics. Built for rivals, co-op chaos, and those one-more-game nights.</p><div className="funk-specs"><span><b>08</b> Private pods</span><span><b>4K</b> OLED screens</span><span><b>120</b> Hz response</span></div></div>
      </section>

      {/* ── Rates ────────────────────────────────────────────── */}
      <section className="funk-rates" id="rates">
        <div><span>03 / Walk in, power up</span><h2>KEEP IT<br /><em>SIMPLE.</em></h2></div>
        <article className="funk-rate-card"><p>Starting from</p><strong>₹60</strong><span>per 20-minute solo session</span><hr /><div><b>Solo pod</b><em>₹60 / 20 min</em><b>Duo pod</b><em>₹110 / 20 min</em></div><Link href="/book">Find your time <i>↗</i></Link></article>
      </section>

      {/* ── PS5 Pricing ───────────────────────────────────────── */}
      <section className="funk-ps5" id="ps5" aria-labelledby="ps5-title">
        <div className="funk-ps5__head">
          <span>04 / PS5 Pricing</span>
          <h2 id="ps5-title">PICK YOUR<br /><em>SESSION.</em></h2>
        </div>
        <div className="funk-ps5__grid">
          {[
            { slot: '01', duration: '20 MINUTES', single: '₹60',  extra: '+₹50' },
            { slot: '02', duration: '40 MINUTES', single: '₹130', extra: '+₹50' },
            { slot: '03', duration: '60 MINUTES', single: '₹150', extra: '+₹50' },
          ].map((tier) => (
            <article className="funk-ps5__card" key={tier.slot}>
              <div className="funk-ps5__card-top">
                <span className="funk-ps5__slot">{tier.slot}</span>
                <span className="funk-ps5__duration">{tier.duration}</span>
              </div>
              <div className="funk-ps5__prices">
                <div className="funk-ps5__price-main">
                  <strong>{tier.single}</strong>
                  <span>Single controller</span>
                </div>
                <div className="funk-ps5__price-extra">
                  <strong>{tier.extra}</strong>
                  <span>For 2 controllers</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="funk-ps5__note">All sessions include private pod access &amp; DualSense haptics.</p>
      </section>

      {/* ── Contact ───────────────────────────────────────────── */}
      <section className="funk-contact" id="contact" aria-labelledby="contact-title">
        <div className="funk-contact__head">
          <span>05 / Direct Contact &amp; Inquiries</span>
          <h2 id="contact-title">DIRECT<br /><em>LINE.</em></h2>
        </div>
        <div className="funk-contact__grid">
          <article className="funk-contact__card">
            <div className="funk-contact__card-top">
              <span className="funk-contact__slot">01</span>
              <span className="funk-contact__badge">Primary Line</span>
            </div>
            <div className="funk-contact__info">
              <a href="tel:+916002915136" className="funk-contact__phone">+91 60029 15136</a>
              <p>Pod bookings, walk-in availability, and private reservations.</p>
            </div>
            <div className="funk-contact__links">
              <a href="tel:+916002915136" className="funk-contact__btn">
                Call Direct <span>↗</span>
              </a>
              <a
                href="https://wa.me/916002915136"
                target="_blank"
                rel="noopener noreferrer"
                className="funk-contact__btn funk-contact__btn--wa"
              >
                WhatsApp <span>↗</span>
              </a>
            </div>
          </article>

          <article className="funk-contact__card">
            <div className="funk-contact__card-top">
              <span className="funk-contact__slot">02</span>
              <span className="funk-contact__badge">Support &amp; Squads</span>
            </div>
            <div className="funk-contact__info">
              <a href="tel:+919395340221" className="funk-contact__phone">+91 93953 40221</a>
              <p>Squad sessions, multiplayer tournament inquiries, and general support.</p>
            </div>
            <div className="funk-contact__links">
              <a href="tel:+919395340221" className="funk-contact__btn">
                Call Direct <span>↗</span>
              </a>
              <a
                href="https://wa.me/919395340221"
                target="_blank"
                rel="noopener noreferrer"
                className="funk-contact__btn funk-contact__btn--wa"
              >
                WhatsApp <span>↗</span>
              </a>
            </div>
          </article>
        </div>
        <div className="funk-contact__footer">
          <p>Direct lines open daily — walk-ins &amp; reservations welcome.</p>
        </div>
      </section>

      {/* ── End ──────────────────────────────────────────────── */}
      <section className="funk-end"><span>Corpse Club </span><h2>MAKE IT<br /><em>COUNT.</em></h2><Link href="/book">Reserve a pod <i>↗</i></Link></section>
    </main>
  );
}
