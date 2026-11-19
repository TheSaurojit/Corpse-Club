'use server';

import { prisma } from '@/lib/prisma';

export interface PassbookEntry {
  id: string;
  timestamp: Date;
  dateStr: string;
  type: 'income' | 'expense';
  channel: 'online' | 'cash';
  title: string;
  subtitle?: string;
  amount: number;
  adminName?: string;
  referenceId: string;
}

export interface BankLedgerData {
  // Online Account
  onlineInflow: number;
  onlineOutflow: number;
  onlineBalance: number;

  // Cash In Hand Account
  cashInflow: number;
  cashOutflow: number;
  cashBalance: number;

  // Total Business Liquidity
  totalLiquidity: number;

  // Counts
  totalBillsCount: number;
  totalExpensesCount: number;
  totalAdjustmentsCount: number;

  // Unified Passbook Stream
  entries: PassbookEntry[];
}

export async function getBankLedgerAction(): Promise<{
  success: boolean;
  ledger?: BankLedgerData;
  error?: string;
}> {
  try {
    const [bills, expenses, adjustments] = await Promise.all([
      prisma.bill.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { name: true, email: true },
          },
        },
      }),
      prisma.expense.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { name: true, email: true },
          },
        },
      }),
      prisma.moneyAdjustment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    let onlineInflow = 0;
    let cashInflow = 0;
    const entries: PassbookEntry[] = [];

    // Process Bills into Ledger (Revenue / Income)
    for (const b of bills) {
      const adminLabel = b.admin?.name || b.createdByEmail || 'Admin';
      const dateStr = b.createdAt.toISOString().split('T')[0];

      if (b.onlineAmount > 0) {
        onlineInflow += b.onlineAmount;
        entries.push({
          id: `bill-online-${b.id}`,
          timestamp: b.createdAt,
          dateStr,
          type: 'income',
          channel: 'online',
          title: `Bill ${b.id} • ${b.customerName}`,
          subtitle: 'Online / Bank UPI Transfer',
          amount: b.onlineAmount,
          adminName: adminLabel,
          referenceId: b.id,
        });
      }

      if (b.cashAmount > 0) {
        cashInflow += b.cashAmount;
        entries.push({
          id: `bill-cash-${b.id}`,
          timestamp: b.createdAt,
          dateStr,
          type: 'income',
          channel: 'cash',
          title: `Bill ${b.id} • ${b.customerName}`,
          subtitle: 'Cash Received in Counter Drawer',
          amount: b.cashAmount,
          adminName: adminLabel,
          referenceId: b.id,
        });
      }
    }

    let onlineOutflow = 0;
    let cashOutflow = 0;

    // Process Expenses into Ledger (Cost / Outflow)
    for (const e of expenses) {
      const adminLabel = e.admin?.name || e.createdByEmail || 'Admin';
      const isOnline = e.method.toLowerCase() === 'online';

      if (isOnline) {
        onlineOutflow += e.amount;
      } else {
        cashOutflow += e.amount;
      }

      entries.push({
        id: `exp-${e.id}`,
        timestamp: e.createdAt,
        dateStr: e.date,
        type: 'expense',
        channel: isOnline ? 'online' : 'cash',
        title: e.title,
        subtitle: `Expense • ${e.category || 'General'}`,
        amount: e.amount,
        adminName: adminLabel,
        referenceId: `EXP-${e.id}`,
      });
    }

    // Process Money Adjustments & Internal Transfers (Contra Entries)
    for (const adj of adjustments) {
      const adminLabel = adj.admin?.name || adj.createdByEmail || 'Admin';
      const dateStr = adj.date || adj.createdAt.toISOString().split('T')[0];
      const fromAcc = adj.fromAccount?.toLowerCase();
      const toAcc = adj.toAccount?.toLowerCase();

      // Source Account Outflow
      if (fromAcc === 'cash') {
        cashOutflow += adj.amount;
        entries.push({
          id: `adj-out-cash-${adj.id}`,
          timestamp: adj.createdAt,
          dateStr,
          type: 'expense',
          channel: 'cash',
          title: toAcc === 'online' ? 'Transfer Out: To Online Bank' : `Adjustment Out: ${adj.reason}`,
          subtitle: `Contra Transfer • ${adj.reason}`,
          amount: adj.amount,
          adminName: adminLabel,
          referenceId: `ADJ-${adj.id}`,
        });
      } else if (fromAcc === 'online') {
        onlineOutflow += adj.amount;
        entries.push({
          id: `adj-out-online-${adj.id}`,
          timestamp: adj.createdAt,
          dateStr,
          type: 'expense',
          channel: 'online',
          title: toAcc === 'cash' ? 'Transfer Out: To Cash Drawer' : `Adjustment Out: ${adj.reason}`,
          subtitle: `Contra Transfer • ${adj.reason}`,
          amount: adj.amount,
          adminName: adminLabel,
          referenceId: `ADJ-${adj.id}`,
        });
      }

      // Destination Account Inflow
      if (toAcc === 'online') {
        onlineInflow += adj.amount;
        entries.push({
          id: `adj-in-online-${adj.id}`,
          timestamp: adj.createdAt,
          dateStr,
          type: 'income',
          channel: 'online',
          title: fromAcc === 'cash' ? 'Transfer In: From Cash Drawer' : `Adjustment In: ${adj.reason}`,
          subtitle: `Contra Transfer • ${adj.reason}`,
          amount: adj.amount,
          adminName: adminLabel,
          referenceId: `ADJ-${adj.id}`,
        });
      } else if (toAcc === 'cash') {
        cashInflow += adj.amount;
        entries.push({
          id: `adj-in-cash-${adj.id}`,
          timestamp: adj.createdAt,
          dateStr,
          type: 'income',
          channel: 'cash',
          title: fromAcc === 'online' ? 'Transfer In: From Online Bank' : `Adjustment In: ${adj.reason}`,
          subtitle: `Contra Transfer • ${adj.reason}`,
          amount: adj.amount,
          adminName: adminLabel,
          referenceId: `ADJ-${adj.id}`,
        });
      }
    }

    // Sort entries chronologically descending
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const onlineBalance = onlineInflow - onlineOutflow;
    const cashBalance = cashInflow - cashOutflow;
    const totalLiquidity = onlineBalance + cashBalance;

    return {
      success: true,
      ledger: {
        onlineInflow,
        onlineOutflow,
        onlineBalance,
        cashInflow,
        cashOutflow,
        cashBalance,
        totalLiquidity,
        totalBillsCount: bills.length,
        totalExpensesCount: expenses.length,
        totalAdjustmentsCount: adjustments.length,
        entries,
      },
    };
  } catch (err: unknown) {
    console.error('Error computing bank ledger:', err);
    return { success: false, error: 'Failed to calculate bank and cashbook ledger.' };
  }
}
