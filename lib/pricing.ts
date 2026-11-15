export const PS5_BILLING_RATES = {
  single: {
    20: 60,
    40: 130,
    60: 150,
  },
  dual: {
    20: 110,
    40: 180,
    60: 200,
  },
} as const;

export type ControllerMode = 'single' | 'dual';
export type Ps5Duration = 20 | 40 | 60;

export function getPs5Rate(controller: ControllerMode | string, duration: Ps5Duration | number): number {
  const c = (controller.toLowerCase() === 'dual' ? 'dual' : 'single') as ControllerMode;
  const d = (Number(duration) === 40 ? 40 : Number(duration) === 60 ? 60 : 20) as Ps5Duration;
  return PS5_BILLING_RATES[c][d] || 0;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
