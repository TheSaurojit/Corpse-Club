'use server';

import { prisma } from '@/lib/prisma';
import { getAdminSessionAction } from './admin-auth';

export interface ExpenseRecord {
  id: number;
  title: string;
  amount: number;
  date: string;
  method: string;
  category?: string | null;
  notes?: string | null;
  adminId?: number | null;
  createdByEmail?: string | null;
  admin?: { id: number; name: string | null; email: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAllExpensesAction(): Promise<{
  success: boolean;
  expenses: ExpenseRecord[];
  error?: string;
}> {
  try {
    const expenses = await prisma.expense.findMany({
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

    return { success: true, expenses: expenses as ExpenseRecord[] };
  } catch (err: unknown) {
    console.error('Error fetching expenses:', err);
    return { success: false, expenses: [], error: 'Failed to load expenses.' };
  }
}

export async function createExpenseAction(data: {
  title: string;
  amount: number;
  date?: string;
  method: 'cash' | 'online' | string;
  category?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  expense?: ExpenseRecord;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized. Admin session required.' };
    }

    if (!data.title || !data.title.trim()) {
      return { success: false, error: 'Expense title is required.' };
    }

    const amount = Math.round(Number(data.amount));
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Valid positive amount is required.' };
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

    // Default date to today in YYYY-MM-DD
    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const dateStr = data.date && data.date.trim() ? data.date.trim() : defaultDate;

    const expense = await prisma.expense.create({
      data: {
        title: data.title.trim(),
        amount,
        date: dateStr,
        method: data.method.toLowerCase() === 'online' ? 'online' : 'cash',
        category: data.category?.trim() || 'General',
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

    return { success: true, expense: expense as ExpenseRecord };
  } catch (err: unknown) {
    console.error('Error creating expense:', err);
    return { success: false, error: 'Failed to create expense.' };
  }
}

export async function updateExpenseAction(
  id: number,
  data: {
    title?: string;
    amount?: number;
    date?: string;
    method?: string;
    category?: string;
    notes?: string;
  }
): Promise<{
  success: boolean;
  expense?: ExpenseRecord;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized.' };
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title.trim() } : {}),
        ...(data.amount !== undefined ? { amount: Math.round(Number(data.amount)) } : {}),
        ...(data.date ? { date: data.date.trim() } : {}),
        ...(data.method ? { method: data.method.toLowerCase() === 'online' ? 'online' : 'cash' } : {}),
        ...(data.category !== undefined ? { category: data.category?.trim() || 'General' } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
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

    return { success: true, expense: expense as ExpenseRecord };
  } catch (err: unknown) {
    console.error('Error updating expense:', err);
    return { success: false, error: 'Failed to update expense.' };
  }
}

export async function deleteExpenseAction(id: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized.' };
    }

    await prisma.expense.delete({
      where: { id },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting expense:', err);
    return { success: false, error: 'Failed to delete expense.' };
  }
}
