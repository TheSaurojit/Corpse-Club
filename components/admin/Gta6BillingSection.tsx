'use client';

import { useState } from 'react';

export interface Gta6SessionPayload {
  controller: string;
  duration: number;
  unitPrice: number;
  quantity: number;
}

interface Gta6BillingSectionProps {
  onAddSession: (session: Gta6SessionPayload) => void;
}

const GTA6_TIERS = [
  {
    duration: 60,
    label: '1 Hour (60m)',
    price: 299,
    badge: '1 HOUR PASS',
    description: '60-Minute GTA 6 Pass',
  },
  {
    duration: 120,
    label: '2 Hours (120m)',
    price: 599,
    badge: 'POPULAR',
    description: '120-Minute GTA 6 Marathon',
  },
  {
    duration: 180,
    label: '3 Hours (180m)',
    price: 899,
    badge: 'MAX PASS',
    description: '180-Minute GTA 6 Pro Pass',
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GTA 6 EVENT BILLING SECTION
 * ─────────────────────────────────────────────────────────────────────────────
 * Temporary section for the GTA 6 Launch Event (Nov 19 – Nov 30).
 * Once the event concludes, simply remove this component from:
 *   1. app/admin/billing/page.tsx
 *   2. app/admin/billing/create/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function Gta6BillingSection({ onAddSession }: Gta6BillingSectionProps) {
  const [quantities, setQuantities] = useState<Record<number, number>>({
    60: 1,
    120: 1,
    180: 1,
  });

  const handleQtyChange = (duration: number, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [duration]: Math.max(1, (prev[duration] || 1) + delta),
    }));
  };

  const handleManualQty = (duration: number, value: string) => {
    const parsed = parseInt(value, 10);
    setQuantities((prev) => ({
      ...prev,
      [duration]: isNaN(parsed) || parsed < 1 ? 1 : parsed,
    }));
  };

  const handleAdd = (tier: typeof GTA6_TIERS[number]) => {
    const qty = quantities[tier.duration] || 1;
    onAddSession({
      controller: 'GTA 6',
      duration: tier.duration,
      unitPrice: tier.price,
      quantity: qty,
    });
    // Reset quantity back to 1 after adding
    setQuantities((prev) => ({ ...prev, [tier.duration]: 1 }));
  };

  return (
    <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-950/20 via-[#131018] to-purple-950/20 p-4 shadow-lg shadow-red-950/20 relative overflow-hidden">
      {/* Decorative Event Glow */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🌴</span>
          <span className="text-xs font-bold uppercase tracking-wider text-red-400">
            GTA 6 Special PS5 Sessions
          </span>
          <span className="rounded-md border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-[9px] font-extrabold text-red-300 uppercase tracking-wider animate-pulse">
            Event Pass
          </span>
        </div>
        <span className="text-[11px] text-gray-400 font-sans">
          Controller included • Flat rate (₹299, ₹599, ₹899)
        </span>
      </div>

      {/* Tier Cards Grid */}
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {GTA6_TIERS.map((tier) => {
          const qty = quantities[tier.duration] || 1;
          const totalCost = tier.price * qty;

          return (
            <div
              key={tier.duration}
              className="flex flex-col justify-between rounded-xl border border-red-500/20 bg-black/40 p-3.5 hover:border-red-500/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    {tier.label}
                  </span>
                  <span className="rounded bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 text-[9px] font-mono font-bold text-red-400">
                    {tier.badge}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-white">₹{tier.price}</span>
                  <span className="text-[10px] text-gray-400">/ session</span>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">{tier.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                {/* Quantity Selector */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 text-[11px]">Quantity:</span>
                  <div className="flex items-center rounded-lg border border-white/10 bg-[#15151b] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(tier.duration, -1)}
                      className="px-2.5 py-1 text-gray-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => handleManualQty(tier.duration, e.target.value)}
                      className="w-10 bg-transparent text-center text-xs font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleQtyChange(tier.duration, 1)}
                      className="px-2.5 py-1 text-gray-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  type="button"
                  onClick={() => handleAdd(tier)}
                  className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 py-1.5 px-3 text-xs font-bold text-white shadow-md shadow-red-950/50 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>+ Add</span>
                  <span className="opacity-90 font-mono text-[11px]">
                    (₹{totalCost})
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
