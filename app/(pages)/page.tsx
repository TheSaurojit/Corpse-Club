'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const games = [
  { title: 'FC 25',          type: 'Duo / Competitive',  copy: 'Settle the score in a no-excuses head-to-head session.',              image: '/assets/match-hero-2.png',    index: '01' },
  { title: 'Tekken 8',       type: 'Duo / Fight night',  copy: 'A proper fight card deserves an OLED and a loud room.',                image: '/assets/match-hero-3.png',    index: '02' },
  { title: 'Spider-Man 2',   type: 'Solo / Story mode',  copy: 'Drop into a world that looks better after dark.',                     image: '/assets/match-hero-squad.png', index: '03' },
  { title: 'Mortal Kombat 1',type: 'Duo / Finish them',  copy: 'For rivalries that need a little more drama.',                        image: '/assets/match-hero-3.png',    index: '04' },
  { title: 'Gran Turismo 7', type: 'Solo / Time trial',  copy: 'Chase lap times with every frame exactly where it should be.',        image: '/assets/match-hero-2.png',    index: '05' },
  { title: 'God of War',     type: 'Solo / Epic mode',   copy: 'Kratos never looked this good. Ragnarök on an OLED is something else.',image: '/assets/match-hero-squad.png', index: '06' },
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
            <div className="funk-time"><span>Next slot</span><strong>7:20 PM&nbsp; • &nbsp;Tonight</strong></div>
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
          <div className="funk-foot"><span>New Delhi / India</span><span>Corpse Club — est. 2026</span></div>
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
      <section className="funk-rates" id="contact">
        <div><span>03 / Walk in, power up</span><h2>KEEP IT<br /><em>SIMPLE.</em></h2></div>
        <article className="funk-rate-card"><p>Starting from</p><strong>₹50</strong><span>per 20-minute solo session</span><hr /><div><b>Solo pod</b><em>₹50 / 20 min</em><b>Duo pod</b><em>₹80 / 20 min</em></div><Link href="/book">Find your time <i>↗</i></Link></article>
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

      {/* ── End ──────────────────────────────────────────────── */}
      <section className="funk-end"><span>Corpse Club / New Delhi</span><h2>MAKE IT<br /><em>COUNT.</em></h2><Link href="/book">Reserve a pod <i>↗</i></Link></section>
    </main>
  );
}
