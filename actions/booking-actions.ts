'use server';

import { prisma } from '@/lib/prisma';
import { generate6CharBookingId } from '@/lib/booking';

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
): Promise<{ success: boolean; bookedIndices: number[]; error?: string }> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
      return { success: false, bookedIndices: [] };
    }

    const bookedSlots = await prisma.bookedSlot.findMany({
      where: {
        bookingDate: dateString,
      },
      select: {
        slotIndex: true,
      },
    });

    const indices = bookedSlots.map((b) => b.slotIndex);
    return { success: true, bookedIndices: indices };
  } catch (err: unknown) {
    console.error('Error fetching booked slots from Neon:', err);
    return { success: false, bookedIndices: [], error: 'Failed to query database' };
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
    console.error('Error fetching holidays from Neon:', err);
    return { success: false, holidays: [], holidayDates: [], error: 'Failed to query holidays' };
  }
}

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
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

    // 4. Enforce 1-week rolling booking window (Today + 6 days)
    const maxWindowDate = new Date();
    maxWindowDate.setDate(maxWindowDate.getDate() + 6);
    const maxWindowStr = getDateStringInTimeZone(maxWindowDate, 'Asia/Kolkata');
    if (input.bookingDate > maxWindowStr) {
      return {
        success: false,
        error: `Booking window is strictly 1 week in advance. Maximum selectable date is ${maxWindowStr}.`,
      };
    }

    const podId = input.podId || 'pod-01';

    // Ensure 6-character alphanumeric booking ID
    let finalId = (input.id || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(finalId)) {
      finalId = generate6CharBookingId();
    }

    // Atomic transaction: verify slots are not already booked, then insert
    await prisma.$transaction(async (tx) => {
      // 1. Strict Duplicate Verification: Check if any requested slot is already reserved
      const existingBookedSlots = await tx.bookedSlot.findMany({
        where: {
          bookingDate: input.bookingDate,
          podId,
          slotIndex: {
            in: input.slotIndices,
          },
        },
      });

      if (existingBookedSlots.length > 0) {
        throw new Error('SLOT_ALREADY_FILLED');
      }

      // 2. Ensure ID uniqueness (regenerate if 6-char collision occurs)
      const existingBooking = await tx.booking.findUnique({
        where: { id: finalId },
      });
      if (existingBooking) {
        finalId = generate6CharBookingId();
      }

      // 3. Insert the Booking and create the locked slots
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
          slots: {
            create: input.slotIndices.map((idx) => ({
              bookingDate: input.bookingDate,
              slotIndex: idx,
              podId,
            })),
          },
        },
      });
    });

    return { success: true, bookingId: finalId };
  } catch (err: unknown) {
    console.error('Error creating booking in Neon:', err);
    const errMsg = err instanceof Error ? err.message : String(err);

    // Specifically detect duplicate slot collision or unique constraint violation
    const isSlotFilled =
      errMsg.includes('SLOT_ALREADY_FILLED') ||
      (err as { code?: string })?.code === 'P2002' ||
      errMsg.includes('unique_slot_per_date_pod') ||
      errMsg.includes('BookedSlot');

    if (isSlotFilled) {
      return {
        success: false,
        isSlotFilled: true,
        error: 'The selected slot has already been reserved by another player. Please choose another time.',
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

    return { success: true, bookings };
  } catch (err: unknown) {
    console.error('Error fetching admin bookings from Neon:', err);
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
