import Link from 'next/link';

export default function Footer() {
  return <footer className="club-footer"><div className="club-footer__top"><Link href="/" className="club-footer__mark">CORPSE<br /><em>CLUB</em></Link><p>Private console sessions for people who still care about the game.</p><Link href="/book" className="club-footer__link">Reserve your spot ↗</Link></div><div className="club-footer__bottom"><span>New Delhi / India</span><span>Open daily / 11—22</span><span>© {new Date().getFullYear()} Corpse Club</span></div></footer>;
}
