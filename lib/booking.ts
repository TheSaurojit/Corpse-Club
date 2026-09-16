import {
  getDbBookedSlotIndicesAction,
  getDbHolidaysAction,
  getBookingHubInitialDataAction,
} from '@/actions/booking-actions';

export interface SlotInfo {
  index: number;
  timeString: string;
  endTimeString: string;
  hourGroup: string;
  isBooked: boolean;
}

export interface BookingDate {
  dateString: string; // YYYY-MM-DD
  dayName: string; // e.g. Wed
  dayNumber: number; // e.g. 26
  monthName: string; // e.g. Aug
  isToday: boolean;
  isWeekend: boolean;
  availableCount?: number;
}

export type DurationMinutes = 20 | 40 | 60 | 120;

export interface DurationOption {
  value: DurationMinutes;
  label: string;
  slotsCount: number;
  description: string;
  badge: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { value: 20, label: '20 Mins', slotsCount: 1, description: '1 Continuous Slot', badge: 'QUICK RUN' },
  { value: 40, label: '40 Mins', slotsCount: 2, description: '2 Continuous Slots', badge: 'POPULAR' },
  { value: 60, label: '1 Hour', slotsCount: 3, description: '3 Continuous Slots', badge: 'FULL SESSION' },
  { value: 120, label: '2 Hour', slotsCount: 6, description: '6 Continuous Slots', badge: 'MARATHON' },
];

export interface TimeBlockAvailability {
  id: string;
  dateString: string;
  startTime: string;
  endTime: string;
  durationMinutes: DurationMinutes;
  durationLabel: string;
  slotIndices: number[];
  isAvailable: boolean;
  hourGroup: string;
}

// Generate successive calendar days, skipping designated holiday dates (Default: 5 days rolling window)
export function getAvailableDates(
  daysCount: number = 5,
  holidayDates: string[] = [],
  baseDateStr?: string
): BookingDate[] {
  const dates: BookingDate[] = [];
  const holidaySet = new Set(holidayDates);

  let baseDate: Date;
  if (baseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    const parts = baseDateStr.split('-').map(Number);
    baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    baseDate = new Date();
  }

  const todayStr =
    baseDateStr ||
    `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
  let dayOffset = 0;

  // Search forward up to 30 days, skipping designated holidays until daysCount available days are collected
  while (dates.length < daysCount && dayOffset < 30) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + dayOffset);
    dayOffset++;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Skip the whole day if it is marked as a holiday in the database
    if (holidaySet.has(dateString)) {
      continue;
    }

    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    dates.push({
      dateString,
      dayName,
      dayNumber,
      monthName,
      isToday: dateString === todayStr,
      isWeekend,
      availableCount: 30,
    });
  }

  return dates;
}

// Fetch calendar dates with live available slot counts from Neon database, skipping holidays (Default: 5 days)
// Batched into a single round-trip query for instantaneous loading
export async function fetchAvailableDatesWithDbCounts(
  daysCount: number = 5,
  baseDateStr?: string
): Promise<BookingDate[]> {
  try {
    const res = await getBookingHubInitialDataAction(daysCount, baseDateStr);
    if (res.success && res.dates) {
      return res.dates;
    }
  } catch (err) {
    console.error('Error fetching available dates with db counts:', err);
  }
  return getAvailableDates(daysCount, [], baseDateStr);
}

// Pure helper: returns empty set (no dummy slots)
export function getBookedSlotsForDate(dateString: string): Set<number> {
  return new Set<number>();
}

// Generate 30 20-minute slots from 12:00 PM to 10:00 PM
// Total 10 hours = 600 mins = 30 slots of 20 mins
export function getSlotsForDate(dateString: string, bookedIndices?: Set<number>): SlotInfo[] {
  const slots: SlotInfo[] = [];
  const startHour = 12; // 12:00 PM
  const totalSlots = 30;
  const booked = bookedIndices || new Set<number>();

  for (let i = 0; i < totalSlots; i++) {
    const totalMinutesFromStart = i * 20;
    const slotHour = startHour + Math.floor(totalMinutesFromStart / 60);
    const slotMinute = totalMinutesFromStart % 60;

    const endTotalMinutesFromStart = (i + 1) * 20;
    const endSlotHour = startHour + Math.floor(endTotalMinutesFromStart / 60);
    const endSlotMinute = endTotalMinutesFromStart % 60;

    const timeString = formatTime(slotHour, slotMinute);
    const endTimeString = formatTime(endSlotHour, endSlotMinute);
    const hourLabel = formatHourLabel(slotHour);

    slots.push({
      index: i,
      timeString,
      endTimeString,
      hourGroup: hourLabel,
      isBooked: booked.has(i),
    });
  }

  return slots;
}

// Pure synchronous helper to calculate 20m/40m/60m/120m time blocks from booked slot indices
export function calculateAvailabilityBlocks(
  dateString: string,
  durationMinutes: DurationMinutes,
  bookedIndices: number[] = [],
  isHoliday: boolean = false,
  mode: 'fixed' | 'flexible' = 'fixed'
): {
  blocks: TimeBlockAvailability[];
  totalAvailable: number;
  totalBooked: number;
  dateString: string;
} {
  if (isHoliday) {
    return {
      blocks: [],
      totalAvailable: 0,
      totalBooked: 0,
      dateString,
    };
  }

  const bookedSet = new Set<number>(bookedIndices);
  const slots = getSlotsForDate(dateString, bookedSet);
  const slotsNeeded = durationMinutes / 20;
  const totalSlots = slots.length;
  const blocks: TimeBlockAvailability[] = [];

  const durationOption = DURATION_OPTIONS.find((d) => d.value === durationMinutes);
  const durationLabel = durationOption ? durationOption.label : `${durationMinutes} Mins`;

  const step = mode === 'fixed' ? slotsNeeded : 1;

  for (let i = 0; i + slotsNeeded <= totalSlots; i += step) {
    const slotIndices: number[] = [];
    let isAvailable = true;

    for (let s = 0; s < slotsNeeded; s++) {
      const idx = i + s;
      slotIndices.push(idx);
      if (slots[idx].isBooked) {
        isAvailable = false;
      }
    }

    const startSlot = slots[i];
    const endSlot = slots[i + slotsNeeded - 1];

    blocks.push({
      id: `${dateString}-slot-${i}-${i + slotsNeeded}`,
      dateString,
      startTime: startSlot.timeString,
      endTime: endSlot.endTimeString,
      durationMinutes,
      durationLabel,
      slotIndices,
      isAvailable,
      hourGroup: startSlot.hourGroup,
    });
  }

  const totalAvailable = blocks.filter((b) => b.isAvailable).length;
  const totalBooked = blocks.length - totalAvailable;

  return {
    blocks,
    totalAvailable,
    totalBooked,
    dateString,
  };
}

// Fetch availability strictly from Neon PostgreSQL database for a chosen date and duration
export async function fetchAvailabilityFromDb(
  dateString: string,
  durationMinutes: DurationMinutes,
  mode: 'fixed' | 'flexible' = 'fixed'
): Promise<{
  blocks: TimeBlockAvailability[];
  totalAvailable: number;
  totalBooked: number;
  dateString: string;
}> {
  let isHoliday = false;
  // If date is a holiday in Neon database, return 0 available slots immediately
  try {
    const holidayRes = await getDbHolidaysAction();
    if (holidayRes.success && Array.isArray(holidayRes.holidayDates) && holidayRes.holidayDates.includes(dateString)) {
      isHoliday = true;
    }
  } catch (err) {
    console.error('Error checking holiday for date in fetchAvailabilityFromDb:', err);
  }

  const bookedIndices: number[] = [];
  if (!isHoliday) {
    // Query live booked slots from Neon PostgreSQL
    try {
      const liveDb = await getDbBookedSlotIndicesAction(dateString);
      if (liveDb.success && Array.isArray(liveDb.bookedIndices)) {
        bookedIndices.push(...liveDb.bookedIndices);
      }
    } catch (err) {
      console.error('Error fetching live booked slots from Neon:', err);
    }
  }

  return calculateAvailabilityBlocks(dateString, durationMinutes, bookedIndices, isHoliday, mode);
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = String(minute).padStart(2, '0');
  return `${String(displayHour).padStart(2, '0')}:${displayMin} ${period}`;
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export function formatSlotRange(selectedSlots: number[]): {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  durationHours: string;
} {
  if (!selectedSlots || selectedSlots.length === 0) {
    return { startTime: '', endTime: '', durationMinutes: 0, durationHours: '0 mins' };
  }

  const sorted = [...selectedSlots].sort((a, b) => a - b);
  const minIndex = sorted[0];
  const maxIndex = sorted[sorted.length - 1];

  const allSlots = getSlotsForDate('2026-01-01'); // helper time generator
  const startTime = allSlots[minIndex]?.timeString || '';
  const endTime = allSlots[maxIndex]?.endTimeString || '';

  const durationMinutes = sorted.length * 20;
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  
  let durationHours = '';
  if (hours > 0 && mins > 0) {
    durationHours = `${hours}h ${mins}m`;
  } else if (hours > 0) {
    durationHours = `${hours} hr${hours > 1 ? 's' : ''}`;
  } else {
    durationHours = `${mins} mins`;
  }

  return { startTime, endTime, durationMinutes, durationHours };
}

// Official Controller Pricing Matrix in INR:
// 1 Controller: 20m -> ₹60, 40m -> ₹130, 60m (1h) -> ₹150, 120m (2h) -> ₹300
// 2 Controller: 20m -> ₹110, 40m -> ₹180, 60m (1h) -> ₹200, 120m (2h) -> ₹400
export const PRICING_MATRIX: Record<number, { 1: number; 2: number }> = {
  20: { 1: 60, 2: 110 },
  40: { 1: 130, 2: 180 },
  60: { 1: 150, 2: 200 },
  120: { 1: 300, 2: 400 },
};

export interface CustomerDetails {
  name: string;
  phone: string;
  email: string;
}

export function getPriceForDuration(durationMinutes: number, controllers: number): number {
  const tier = PRICING_MATRIX[durationMinutes];
  if (tier) {
    return controllers === 2 ? tier[2] : tier[1];
  }
  const slots = Math.max(1, Math.round(durationMinutes / 20));
  const baseRate = controllers === 2 ? 55 : 30;
  return slots * baseRate;
}

export function calculatePrice(slotCount: number, playerCount: number): {
  perSlotRate: number;
  totalPrice: number;
  perHourRate: number;
} {
  const durationMinutes = (slotCount || 1) * 20;
  const totalPrice = getPriceForDuration(durationMinutes, playerCount);
  const perSlotRate = Math.round(totalPrice / (slotCount || 1));
  const perHourRate = getPriceForDuration(60, playerCount);
  return { perSlotRate, totalPrice, perHourRate };
}

export function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Generates a 6-character uppercase alphanumeric booking code (e.g. "A7K9X2")
 * Uses unambiguous characters (excluding 0, O, 1, I).
 */
export function generate6CharBookingId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
