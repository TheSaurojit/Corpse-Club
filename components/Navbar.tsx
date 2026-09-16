'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="club-nav">
      <Link href="/" className="club-nav__brand" onClick={() => setOpen(false)}><span>Corpse</span><span>Club</span></Link>
      <nav className="club-nav__links" aria-label="Main navigation"><Link href="/#experience">The club</Link><Link href="/#games">Sessions</Link><Link href="/#pricing">Rates</Link></nav>
      <Link href="/book" className="club-nav__book">Book a pod <span>↗</span></Link>
      <button className="club-nav__toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>{open ? 'Close' : 'Menu'}</button>
      {open && <nav className="club-nav__mobile" aria-label="Mobile navigation"><Link href="/#experience" onClick={() => setOpen(false)}>The club</Link><Link href="/#games" onClick={() => setOpen(false)}>Sessions</Link><Link href="/#pricing" onClick={() => setOpen(false)}>Rates</Link><Link href="/book" onClick={() => setOpen(false)}>Book a pod ↗</Link></nav>}
    </header>
  );
}
