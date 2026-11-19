'use server';

import { prisma } from '@/lib/prisma';
import { getAdminSessionAction } from './admin-auth';

export interface MoneyAdjustmentRecord {
  id: number;
  type: string; // 'transfer' | 'correction'
  fromAccount: string; // 'cash' | 'online'
  toAccount: string; // 'cash' | 'online'
  amount: number;
  date: string; // YYYY-MM-DD
  reason: string;
  notes?: string | null;
  adminId?: number | null;
  createdByEmail?: string | null;
  admin?: { id: number; name: string | null; email: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAllAdjustmentsAction(): Promise<{
  success: boolean;
  adjustments: MoneyAdjustmentRecord[];
  error?: string;
}> {
  try {
    const adjustments = await prisma.moneyAdjustment.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { success: true, adjustments: adjustments as MoneyAdjustmentRecord[] };
  } catch (err: unknown) {
    console.error('Error fetching adjustments:', err);
    return { success: false, adjustments: [], error: 'Failed to load money adjustments.' };
  }
}

export async function createMoneyAdjustmentAction(data: {
  type?: 'transfer' | 'correction' | string;
  fromAccount: 'cash' | 'online' | string;
  toAccount: 'cash' | 'online' | string;
  amount: number;
  date?: string;
  reason: string;
  notes?: string;
}): Promise<{
  success: boolean;
  adjustment?: MoneyAdjustmentRecord;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized. Admin session required.' };
    }

    const fromAcc = data.fromAccount?.toLowerCase().trim();
    const toAcc = data.toAccount?.toLowerCase().trim();

    if (!fromAcc || !toAcc) {
      return { success: false, error: 'Source and destination accounts are required.' };
    }

    if (fromAcc === toAcc) {
      return { success: false, error: 'Source and destination accounts cannot be identical.' };
    }

    if (!data.reason || !data.reason.trim()) {
      return { success: false, error: 'Reason for adjustment is required.' };
    }

    const amount = Math.round(Number(data.amount));
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Please enter a valid positive amount.' };
    }

    let adminId: number | null = null;
    let createdByEmail: string | null = null;
    if (session.email) {
      createdByEmail = session.email.toLowerCase().trim();
      const adminRecord = await prisma.admin.findUnique({
        where: { email: createdByEmail },
      });
      if (adminRecord) {
        adminId = adminRecord.id;
      }
    }

    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const dateStr = data.date && data.date.trim() ? data.date.trim() : defaultDate;

    const adjustment = await prisma.moneyAdjustment.create({
      data: {
        type: data.type || 'transfer',
        fromAccount: fromAcc,
        toAccount: toAcc,
        amount,
        date: dateStr,
        reason: data.reason.trim(),
        notes: data.notes?.trim() || null,
        adminId,
        createdByEmail,
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { success: true, adjustment: adjustment as MoneyAdjustmentRecord };
  } catch (err: unknown) {
    console.error('Error creating money adjustment:', err);
    return { success: false, error: 'Failed to record money adjustment.' };
  }
}

export async function deleteMoneyAdjustmentAction(id: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized.' };
    }

    await prisma.moneyAdjustment.delete({
      where: { id },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting money adjustment:', err);
    return { success: false, error: 'Failed to delete money adjustment.' };
  }
}
