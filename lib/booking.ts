import {
  getDbBookedSlotIndicesAction,
  getDbHolidaysAction,
  getBookingHubInitialDataAction,
} from '@/actions/booking-actions';

export const STATIONS = [
  { id: 'pod-01', name: 'PS5 Station 01', shortName: 'PS5-01' },
  { id: 'pod-02', name: 'PS5 Station 02', shortName: 'PS5-02' },
] as const;

export type StationId = (typeof STATIONS)[number]['id'];

// 10-minute atomic slots: 12:00 PM to 10:00 PM = 10 hours = 600 mins = 60 slots
export const SLOT_DURATION_MINS = 10;
export const START_HOUR = 12; // 12:00 PM
export const END_HOUR = 22; // 10:00 PM
export const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 600 mins
export const TOTAL_SLOTS = TOTAL_MINUTES / SLOT_DURATION_MINS; // 60 slots

export interface SlotInfo {
  index: number;
  timeString: string;
  endTimeString: string;
  hourGroup: string;
  isBooked: boolean;
  bookedPods: string[];
  availablePodsCount: number;
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

export type DurationMinutes = 20 | 40 | 60 | 120 | 180;

export interface DurationOption {
  value: DurationMinutes;
  label: string;
  slotsCount: number; // number of 10-min slots
  description: string;
  badge: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { value: 20, label: '20 Mins', slotsCount: 2, description: '20-Minute Blitz Session', badge: 'QUICK RUN' },
  { value: 40, label: '40 Mins', slotsCount: 4, description: '40-Minute Match Session', badge: 'POPULAR' },
  { value: 60, label: '1 Hour', slotsCount: 6, description: '60-Minute Full Gaming Hour', badge: 'FULL SESSION' },
  { value: 120, label: '2 Hours', slotsCount: 12, description: '120-Minute Marathon Session', badge: 'MARATHON' },
  { value: 180, label: '3 Hours', slotsCount: 18, description: '180-Minute Tournament Pass', badge: 'PRO PASS' },
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
  availablePodsCount: number; // 0, 1, or 2
  pod01Available: boolean;
  pod02Available: boolean;
  assignedPodId: StationId | null;
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
      availableCount: 120, // 60 slots * 2 stations
    });
  }

  return dates;
}

// Fetch calendar dates with live available slot counts from database, skipping holidays (Default: 5 days)
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

// Pure helper: returns empty set
export function getBookedSlotsForDate(dateString: string): Set<number> {
  return new Set<number>();
}

// Generate 60 10-minute slots from 12:00 PM to 10:00 PM for both stations
export function getSlotsForDate(
  dateString: string,
  bookedSlotsByPod?: Record<string, number[]> | Set<number>
): SlotInfo[] {
  const slots: SlotInfo[] = [];

  let pod01Booked: Set<number>;
  let pod02Booked: Set<number>;

  if (bookedSlotsByPod instanceof Set) {
    pod01Booked = bookedSlotsByPod;
    pod02Booked = new Set();
  } else if (bookedSlotsByPod) {
    pod01Booked = new Set(bookedSlotsByPod['pod-01'] || []);
    pod02Booked = new Set(bookedSlotsByPod['pod-02'] || []);
  } else {
    pod01Booked = new Set();
    pod02Booked = new Set();
  }

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const totalMinutesFromStart = i * SLOT_DURATION_MINS;
    const slotHour = START_HOUR + Math.floor(totalMinutesFromStart / 60);
    const slotMinute = totalMinutesFromStart % 60;

    const endTotalMinutesFromStart = (i + 1) * SLOT_DURATION_MINS;
    const endSlotHour = START_HOUR + Math.floor(endTotalMinutesFromStart / 60);
    const endSlotMinute = endTotalMinutesFromStart % 60;

    const timeString = formatTime(slotHour, slotMinute);
    const endTimeString = formatTime(endSlotHour, endSlotMinute);
    const hourLabel = formatHourLabel(slotHour);

    const isPod01Booked = pod01Booked.has(i);
    const isPod02Booked = pod02Booked.has(i);

    const bookedPods: string[] = [];
    if (isPod01Booked) bookedPods.push('pod-01');
    if (isPod02Booked) bookedPods.push('pod-02');

    const availablePodsCount = 2 - bookedPods.length;

    slots.push({
      index: i,
      timeString,
      endTimeString,
      hourGroup: hourLabel,
      isBooked: availablePodsCount === 0,
      bookedPods,
      availablePodsCount,
    });
  }

  return slots;
}

// Helper to normalize booked inputs into Sets for pod-01 and pod-02
function normalizeBookedPods(
  bookedInput?: Record<string, number[]> | number[] | Set<number>
): { pod01Booked: Set<number>; pod02Booked: Set<number> } {
  if (bookedInput instanceof Set) {
    return { pod01Booked: bookedInput, pod02Booked: new Set() };
  }
  if (Array.isArray(bookedInput)) {
    return { pod01Booked: new Set(bookedInput), pod02Booked: new Set() };
  }
  if (bookedInput && typeof bookedInput === 'object') {
    return {
      pod01Booked: new Set(bookedInput['pod-01'] || []),
      pod02Booked: new Set(bookedInput['pod-02'] || []),
    };
  }
  return { pod01Booked: new Set(), pod02Booked: new Set() };
}

// Pure synchronous helper to calculate 20m/40m/60m/120m/180m time blocks across both PS5 stations
export function calculateAvailabilityBlocks(
  dateString: string,
  durationMinutes: DurationMinutes,
  bookedSlotsInput?: Record<string, number[]> | number[],
  isHoliday: boolean = false,
  mode: 'fixed' | 'flexible' | 'all' = 'flexible'
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

  const { pod01Booked, pod02Booked } = normalizeBookedPods(bookedSlotsInput);
  const slots = getSlotsForDate(dateString, {
    'pod-01': Array.from(pod01Booked),
    'pod-02': Array.from(pod02Booked),
  });

  const slotsNeeded = Math.round(durationMinutes / SLOT_DURATION_MINS); // e.g. 60 min -> 6 slots
  const totalSlots = slots.length; // 60
  const blocks: TimeBlockAvailability[] = [];

  const durationOption = DURATION_OPTIONS.find((d) => d.value === durationMinutes);
  const durationLabel = durationOption ? durationOption.label : `${durationMinutes} Mins`;

  // Step increments:
  // 'fixed': stepped by duration (e.g. 6 slots for 60 min)
  // 'flexible': stepped by 30 mins (3 slots) or duration if smaller
  // 'all': stepped by 10 mins (1 slot) to allow any custom start time
  let step = 1;
  if (mode === 'fixed') {
    step = Math.max(1, slotsNeeded);
  } else if (mode === 'flexible') {
    // 30 mins (3 slots) or 20 mins (2 slots)
    step = durationMinutes <= 30 ? 2 : 3;
  } else {
    step = 1; // every 10 minutes
  }

  for (let i = 0; i + slotsNeeded <= totalSlots; i += step) {
    const slotIndices: number[] = [];
    for (let s = 0; s < slotsNeeded; s++) {
      slotIndices.push(i + s);
    }

    // A pod can take the session ONLY if it is completely free for all consecutive slots
    const pod01Available = !slotIndices.some((idx) => pod01Booked.has(idx));
    const pod02Available = !slotIndices.some((idx) => pod02Booked.has(idx));

    const isAvailable = pod01Available || pod02Available;
    const availablePodsCount = (pod01Available ? 1 : 0) + (pod02Available ? 1 : 0);
    const assignedPodId: StationId | null = pod01Available
      ? 'pod-01'
      : pod02Available
      ? 'pod-02'
      : null;

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
      availablePodsCount,
      pod01Available,
      pod02Available,
      assignedPodId,
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

// Fetch availability strictly from database for a chosen date and duration
export async function fetchAvailabilityFromDb(
  dateString: string,
  durationMinutes: DurationMinutes,
  mode: 'fixed' | 'flexible' | 'all' = 'flexible'
): Promise<{
  blocks: TimeBlockAvailability[];
  totalAvailable: number;
  totalBooked: number;
  dateString: string;
}> {
  let isHoliday = false;
  try {
    const holidayRes = await getDbHolidaysAction();
    if (holidayRes.success && Array.isArray(holidayRes.holidayDates) && holidayRes.holidayDates.includes(dateString)) {
      isHoliday = true;
    }
  } catch (err) {
    console.error('Error checking holiday for date in fetchAvailabilityFromDb:', err);
  }

  let bookedSlotsByPod: Record<string, number[]> = { 'pod-01': [], 'pod-02': [] };
  if (!isHoliday) {
    try {
      const liveDb = await getDbBookedSlotIndicesAction(dateString);
      if (liveDb.success && liveDb.bookedSlotsByPod) {
        bookedSlotsByPod = liveDb.bookedSlotsByPod;
      }
    } catch (err) {
      console.error('Error fetching live booked slots from DB:', err);
    }
  }

  return calculateAvailabilityBlocks(dateString, durationMinutes, bookedSlotsByPod, isHoliday, mode);
}

export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = String(minute).padStart(2, '0');
  return `${String(displayHour).padStart(2, '0')}:${displayMin} ${period}`;
}

export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
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

  const durationMinutes = sorted.length * SLOT_DURATION_MINS;
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
// 1 Controller: 20m -> ₹60, 40m -> ₹130, 60m (1h) -> ₹150, 120m (2h) -> ₹300, 180m (3h) -> ₹450
// 2 Controller: 20m -> ₹110, 40m -> ₹180, 60m (1h) -> ₹200, 120m (2h) -> ₹400, 180m (3h) -> ₹600
export const PRICING_MATRIX: Record<number, { 1: number; 2: number }> = {
  20: { 1: 60, 2: 110 },
  40: { 1: 130, 2: 180 },
  60: { 1: 150, 2: 200 },
  120: { 1: 300, 2: 400 },
  180: { 1: 450, 2: 600 },
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
  const slots = Math.max(1, Math.round(durationMinutes / SLOT_DURATION_MINS));
  const baseRate = controllers === 2 ? 35 : 25;
  return slots * baseRate;
}

export function calculatePrice(slotCount: number, playerCount: number): {
  perSlotRate: number;
  totalPrice: number;
  perHourRate: number;
} {
  const durationMinutes = (slotCount || 1) * SLOT_DURATION_MINS;
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
