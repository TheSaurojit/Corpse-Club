'use server';

import { prisma } from '@/lib/prisma';
import { generate6CharBookingId, getAvailableDates, BookingDate } from '@/lib/booking';

export interface CreateBookingInput {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  controllers: number;
  totalPrice: number;
  slotIndices: number[];
  podId?: string;
}

export async function getDbBookedSlotIndicesAction(
  dateString: string
): Promise<{
  success: boolean;
  bookedIndices: number[];
  bookedSlotsByPod: Record<string, number[]>;
  error?: string;
}> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return { success: false, bookedIndices: [], bookedSlotsByPod: { 'pod-01': [], 'pod-02': [] } };
    }

    const bookedSlots = await prisma.bookedSlot.findMany({
      where: {
        bookingDate: dateString,
      },
      select: {
        slotIndex: true,
        podId: true,
      },
    });

    const bookedSlotsByPod: Record<string, number[]> = {
      'pod-01': [],
      'pod-02': [],
    };
    const allIndices: number[] = [];

    for (const b of bookedSlots) {
      const p = b.podId || 'pod-01';
      if (!bookedSlotsByPod[p]) {
        bookedSlotsByPod[p] = [];
      }
      bookedSlotsByPod[p].push(b.slotIndex);
      allIndices.push(b.slotIndex);
    }

    return {
      success: true,
      bookedIndices: allIndices,
      bookedSlotsByPod,
    };
  } catch (err: unknown) {
    console.error('Error fetching booked slots from database:', err);
    return {
      success: false,
      bookedIndices: [],
      bookedSlotsByPod: { 'pod-01': [], 'pod-02': [] },
      error: 'Failed to query database',
    };
  }
}

export async function getDbHolidaysAction(): Promise<{
  success: boolean;
  holidays: { date: string; reason?: string | null }[];
  holidayDates: string[];
  error?: string;
}> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return { success: false, holidays: [], holidayDates: [] };
    }

    if (!prisma.holiday) {
      return { success: true, holidays: [], holidayDates: [] };
    }

    const holidays = await prisma.holiday.findMany({
      select: {
        date: true,
        reason: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    return {
      success: true,
      holidays,
      holidayDates: holidays.map((h) => h.date),
    };
  } catch (err: unknown) {
    console.error('Error fetching holidays from database:', err);
    return { success: false, holidays: [], holidayDates: [], error: 'Failed to query holidays' };
  }
}

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  assignedPodId?: string;
  isSlotFilled?: boolean;
  error?: string;
}

function getDateStringInTimeZone(date: Date = new Date(), timeZone: string = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export interface BookingHubInitialData {
  success: boolean;
  dates: BookingDate[];
  holidayDates: string[];
  bookedSlotsByDate: Record<string, number[]>;
  bookedSlotsByDateAndPod: Record<string, Record<string, number[]>>;
  error?: string;
}

/**
 * Batched server action: Fetches active holidays, computes the 5-day horizon,
 * and fetches all booked slots for both PS5 stations across all 5 dates in a SINGLE database query round-trip.
 */
export async function getBookingHubInitialDataAction(
  daysCount: number = 5,
  baseDateStr?: string
): Promise<BookingHubInitialData> {
  try {
    const refDateStr = baseDateStr || getDateStringInTimeZone(new Date(), 'Asia/Kolkata');

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      const dates = getAvailableDates(daysCount, [], refDateStr);
      return {
        success: true,
        dates,
        holidayDates: [],
        bookedSlotsByDate: {},
        bookedSlotsByDateAndPod: {},
      };
    }

    // 1. Fetch holidays from database in 1 query
    let holidayDates: string[] = [];
    if (prisma.holiday) {
      const holidays = await prisma.holiday.findMany({
        select: {
          date: true,
          reason: true,
        },
        orderBy: {
          date: 'asc',
        },
      });
      holidayDates = holidays.map((h) => h.date);
    }

    // 2. Generate calendar dates skipping holidays
    const dates = getAvailableDates(daysCount, holidayDates, refDateStr);
    const dateStrings = dates.map((d) => d.dateString);

    // 3. Batch query ALL booked slots for these dates across both stations in a SINGLE database query
    const bookedSlots = await prisma.bookedSlot.findMany({
      where: {
        bookingDate: {
          in: dateStrings,
        },
      },
      select: {
        bookingDate: true,
        slotIndex: true,
        podId: true,
      },
    });

    // 4. Map booked slots by date and by station pod
    const bookedSlotsByDate: Record<string, number[]> = {};
    const bookedSlotsByDateAndPod: Record<string, Record<string, number[]>> = {};

    for (const d of dates) {
      bookedSlotsByDate[d.dateString] = [];
      bookedSlotsByDateAndPod[d.dateString] = {
        'pod-01': [],
        'pod-02': [],
      };
    }

    for (const slot of bookedSlots) {
      const dateKey = slot.bookingDate;
      const pId = slot.podId || 'pod-01';

      if (bookedSlotsByDateAndPod[dateKey]) {
        if (!bookedSlotsByDateAndPod[dateKey][pId]) {
          bookedSlotsByDateAndPod[dateKey][pId] = [];
        }
        bookedSlotsByDateAndPod[dateKey][pId].push(slot.slotIndex);
      }

      if (bookedSlotsByDate[dateKey]) {
        bookedSlotsByDate[dateKey].push(slot.slotIndex);
      }
    }

    // 5. Populate availableCount for each date: Total capacity is 60 slots * 2 stations = 120 slot units
    for (const d of dates) {
      const p1Booked = bookedSlotsByDateAndPod[d.dateString]?.['pod-01']?.length || 0;
      const p2Booked = bookedSlotsByDateAndPod[d.dateString]?.['pod-02']?.length || 0;
      const totalBooked = p1Booked + p2Booked;
      d.availableCount = Math.max(0, 120 - totalBooked);
    }

    return {
      success: true,
      dates,
      holidayDates,
      bookedSlotsByDate,
      bookedSlotsByDateAndPod,
    };
  } catch (err: unknown) {
    console.error('Error fetching initial booking hub data from database:', err);
    const fallbackDates = getAvailableDates(daysCount, [], baseDateStr);
    return {
      success: false,
      dates: fallbackDates,
      holidayDates: [],
      bookedSlotsByDate: {},
      bookedSlotsByDateAndPod: {},
      error: 'Failed to query booking hub data',
    };
  }
}

export async function createDbBookingAction(
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return { success: false, error: 'Database URL not configured in .env.local' };
    }

    // 1. Strict Date Validation: Validate format (YYYY-MM-DD)
    if (!input.bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.bookingDate)) {
      return { success: false, error: 'Invalid booking date format. Expected YYYY-MM-DD.' };
    }

    // 2. Prevent past date bookings (enforce today or future in IST)
    const todayStr = getDateStringInTimeZone(new Date(), 'Asia/Kolkata');
    if (input.bookingDate < todayStr) {
      return {
        success: false,
        error: `Cannot book for a past date (${input.bookingDate}). Today is ${todayStr}.`,
      };
    }

    // 3. Reject booking if date is marked as a holiday
    if (prisma.holiday) {
      const holiday = await prisma.holiday.findUnique({
        where: { date: input.bookingDate },
      });
      if (holiday) {
        return {
          success: false,
          error: `The arena is closed on ${input.bookingDate}${holiday.reason ? ` (${holiday.reason})` : ' (Holiday)'}. Reservations cannot be made for this day.`,
        };
      }
    }

    // 4. Enforce 5-day rolling booking window (Today + 4 days)
    const maxWindowDate = new Date();
    maxWindowDate.setDate(maxWindowDate.getDate() + 4);
    const maxWindowStr = getDateStringInTimeZone(maxWindowDate, 'Asia/Kolkata');
    if (input.bookingDate > maxWindowStr) {
      return {
        success: false,
        error: `Booking window is strictly 5 days in advance. Maximum selectable date is ${maxWindowStr}.`,
      };
    }

    // Ensure 6-character alphanumeric booking ID
    let finalId = (input.id || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(finalId)) {
      finalId = generate6CharBookingId();
    }

    let finalAssignedPodId = 'pod-01';

    // Atomic transaction: verify station availability across pod-01 & pod-02, assign free pod, and insert
    await prisma.$transaction(async (tx) => {
      // 1. Check existing reservations for pod-01 and pod-02 on requested slot indices
      const p1Conflicts = await tx.bookedSlot.findMany({
        where: {
          bookingDate: input.bookingDate,
          podId: 'pod-01',
          slotIndex: {
            in: input.slotIndices,
          },
        },
      });

      const p2Conflicts = await tx.bookedSlot.findMany({
        where: {
          bookingDate: input.bookingDate,
          podId: 'pod-02',
          slotIndex: {
            in: input.slotIndices,
          },
        },
      });

      // Smart routing: prefer requested pod if free; otherwise fallback to other pod
      const p1Free = p1Conflicts.length === 0;
      const p2Free = p2Conflicts.length === 0;

      if (input.podId === 'pod-02') {
        if (p2Free) {
          finalAssignedPodId = 'pod-02';
        } else if (p1Free) {
          finalAssignedPodId = 'pod-01';
        } else {
          throw new Error('SLOT_ALREADY_FILLED');
        }
      } else {
        if (p1Free) {
          finalAssignedPodId = 'pod-01';
        } else if (p2Free) {
          finalAssignedPodId = 'pod-02';
        } else {
          throw new Error('SLOT_ALREADY_FILLED');
        }
      }

      // 2. Ensure ID uniqueness (regenerate if 6-char collision occurs)
      const existingBooking = await tx.booking.findUnique({
        where: { id: finalId },
      });
      if (existingBooking) {
        finalId = generate6CharBookingId();
      }

      // 3. Insert the Booking with assigned podId and lock the atomic slots
      await tx.booking.create({
        data: {
          id: finalId,
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim(),
          customerEmail: input.customerEmail ? input.customerEmail.trim() : '',
          bookingDate: input.bookingDate,
          startTime: input.startTime,
          endTime: input.endTime,
          durationMins: input.durationMins,
          controllers: input.controllers,
          totalPrice: input.totalPrice,
          status: 'confirmed',
          podId: finalAssignedPodId,
          slots: {
            create: input.slotIndices.map((idx) => ({
              bookingDate: input.bookingDate,
              slotIndex: idx,
              podId: finalAssignedPodId,
            })),
          },
        },
      });
    });

    return { success: true, bookingId: finalId, assignedPodId: finalAssignedPodId };
  } catch (err: unknown) {
    console.error('Error creating booking in database:', err);
    const errMsg = err instanceof Error ? err.message : String(err);

    const isSlotFilled =
      errMsg.includes('SLOT_ALREADY_FILLED') ||
      (err as { code?: string })?.code === 'P2002' ||
      errMsg.includes('unique_slot_per_date_pod') ||
      errMsg.includes('BookedSlot');

    if (isSlotFilled) {
      return {
        success: false,
        isSlotFilled: true,
        error: 'Both PS5 Stations are fully reserved for this requested timeframe. Please choose another time slot.',
      };
    }

    return {
      success: false,
      isSlotFilled: false,
      error: errMsg || 'Database error occurred while processing reservation.',
    };
  }
}

export interface AdminBookingRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  controllers: number;
  totalPrice: number;
  status: string;
  podId: string;
  createdAt: Date;
  updatedAt: Date;
  updatedByEmail?: string | null;
  updatedBy?: {
    email: string;
    name?: string | null;
  } | null;
  slots: Array<{ slotIndex: number; podId: string }>;
}

export async function getAllBookingsForAdminAction(): Promise<{
  success: boolean;
  bookings: AdminBookingRecord[];
  error?: string;
}> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return { success: false, bookings: [] };
    }

    const bookings = await prisma.booking.findMany({
      orderBy: [
        { bookingDate: 'desc' },
        { startTime: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        updatedBy: {
          select: {
            email: true,
            name: true,
          },
        },
        slots: {
          select: {
            slotIndex: true,
            podId: true,
          },
        },
      },
    });

    return {
      success: true,
      bookings: bookings.map((b) => ({
        ...b,
        podId: b.podId || b.slots?.[0]?.podId || 'pod-01',
      })),
    };
  } catch (err: unknown) {
    console.error('Error fetching admin bookings from database:', err);
    return { success: false, bookings: [], error: 'Failed to fetch bookings' };
  }
}

export async function updateBookingStatusAction(
  bookingId: string,
  newStatus: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return { success: false, error: 'Database not connected' };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        updatedByEmail: adminEmail.toLowerCase().trim(),
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('Error updating booking status:', err);
    return { success: false, error: 'Failed to update booking status' };
  }
}

export async function deleteBookingAction(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return { success: false, error: 'Database not connected' };
    }

    const trimmedId = bookingId.trim();

    // Atomic transaction: Delete child booked slots first, then the booking record
    await prisma.$transaction(async (tx) => {
      await tx.bookedSlot.deleteMany({
        where: { bookingId: trimmedId },
      });

      await tx.booking.delete({
        where: { id: trimmedId },
      });
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting booking from database:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete booking from database',
    };
  }
}
