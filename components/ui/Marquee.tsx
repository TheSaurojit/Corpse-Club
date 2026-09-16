'use client';
import { useEffect, useRef } from 'react';

interface MarqueeProps {
  items: string[];
}

export default function Marquee({ items }: MarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cloned = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || cloned.current) return;
    cloned.current = true;
    const children = Array.from(track.children);
    children.forEach(child => track.appendChild(child.cloneNode(true)));
    children.forEach(child => track.appendChild(child.cloneNode(true)));
  }, []);

  return (
    <div
      style={{
        overflow: 'hidden',
        borderTop: '1px solid var(--g200)',
        borderBottom: '1px solid var(--g200)',
        padding: '14px 0',
        background: 'var(--red)',
        width: '100%',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div
        ref={trackRef}
        className="marquee-track"
        style={{
          display: 'flex',
          width: 'max-content',
          animation: 'scrollX 28s linear infinite',
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '18px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#000',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {item}
            <span
              style={{
                width: '6px',
                height: '6px',
                background: '#000',
                borderRadius: '99px',
                display: 'inline-block',
              }}
            />
          </div>
        ))}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scrollX {
          from { transform: translateX(0); }
          to { transform: translateX(-33.33333%); }
        }
      `,
        }}
      />
    </div>
  );
}
