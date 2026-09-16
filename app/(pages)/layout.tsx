import type { Metadata } from 'next';
import './globals.css';
import SiteChrome from '@/components/SiteChrome';
import CustomCursor from '@/components/ui/CustomCursor';
import NoiseCanvas from '@/components/ui/NoiseCanvas';
import ScrollReveal from '@/components/ui/ScrollReveal';

export const metadata: Metadata = {
  title: 'CORPSE CLUB — Next-Gen PS5 Gaming Lounge & Arena',
  description:
    'High-performance PS5 gaming lounge. 4K 120Hz OLED displays, DualSense Wireless Haptics, and 30 continuous 20-minute reservation slots (12:00 PM – 10:00 PM).',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CustomCursor />
        <NoiseCanvas />
        <div id="page-transition" />
        <SiteChrome>{children}</SiteChrome>
        <ScrollReveal />
      </body>
    </html>
  );
}
