'use server';

import { prisma } from '@/lib/prisma';
import { getAdminSessionAction } from './admin-auth';
import { getPs5Rate, ControllerMode, Ps5Duration } from '@/lib/pricing';

export interface BillingPs5SessionInput {
  controller: ControllerMode | string;
  duration: Ps5Duration | number;
  unitPrice?: number;
  quantity: number;
}

export interface BillingMenuItemInput {
  menuItemId?: number;
  name: string;
  price: number;
  quantity: number;
}

export interface BillingCustomItemInput {
  name: string;
  price: number;
  quantity: number;
}

export interface CreateBillInput {
  customerName: string;
  ps5Sessions?: BillingPs5SessionInput[];
  menuItems?: BillingMenuItemInput[];
  customItems?: BillingCustomItemInput[];
  discount?: number;
  cashAmount?: number;
  onlineAmount?: number;
  notes?: string;
}

export interface UpdateBillInput extends CreateBillInput {
  id: string;
}

export interface BillRecord {
  id: string;
  customerName: string;
  adminId?: number | null;
  createdByEmail?: string | null;
  admin?: { id: number; name: string | null; email: string } | null;
  cashAmount: number;
  onlineAmount: number;
  discount: number;
  subtotal: number;
  totalAmount: number;
  paymentStatus: string;
  ps5Amount: number;
  cafeAmount: number;
  customAmount: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  sessions: Array<{
    id: number;
    controller: string;
    duration: number;
    unitPrice: number;
    quantity: number;
    total: number;
  }>;
  items: Array<{
    id: number;
    menuItemId?: number | null;
    name: string;
    price: number;
    quantity: number;
    total: number;
    isCustom: boolean;
  }>;
}

/**
 * Fetches only unique customer names from today's bookings for the combobox selector.
 */
export async function getTodayBookingsForBillingAction(): Promise<{
  success: boolean;
  customerNames: string[];
  error?: string;
}> {
  try {
    const now = new Date();
    // Using Asia/Kolkata timezone to match booking system date format (YYYY-MM-DD)
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const parts = new Intl.DateTimeFormat('en-CA', options).format(now); // Produces YYYY-MM-DD
    const todayStr = parts;

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: todayStr,
      },
      select: {
        customerName: true,
      },
    });

    const uniqueNames = Array.from(
      new Set(
        bookings
          .map((b) => b.customerName?.trim())
          .filter((name): name is string => Boolean(name))
      )
    ).sort();

    return { success: true, customerNames: uniqueNames };
  } catch (err: unknown) {
    console.error('Error fetching today booking names:', err);
    return { success: false, customerNames: [], error: 'Failed to fetch today customer names' };
  }
}

/**
 * Generates an invoice/receipt ID like "CC-B-1042"
 */
function generateBillId(): string {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CC-B-${randomSuffix}`;
}

/**
 * Get all bills sorted newest first
 */
export async function getAllBillsAction(): Promise<{
  success: boolean;
  bills: BillRecord[];
  error?: string;
}> {
  try {
    const bills = await prisma.bill.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sessions: true,
        items: true,
      },
    });

    return { success: true, bills: bills as BillRecord[] };
  } catch (err: unknown) {
    console.error('Error fetching bills:', err);
    return { success: false, bills: [], error: 'Failed to load bills.' };
  }
}

/**
 * Get a single bill by ID
 */
export async function getBillByIdAction(id: string): Promise<{
  success: boolean;
  bill?: BillRecord;
  error?: string;
}> {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sessions: true,
        items: true,
      },
    });

    if (!bill) {
      return { success: false, error: 'Bill not found.' };
    }

    return { success: true, bill: bill as BillRecord };
  } catch (err: unknown) {
    console.error('Error fetching bill by ID:', err);
    return { success: false, error: 'Failed to fetch bill.' };
  }
}

/**
 * Create a new bill with multiple PS5 sessions, cafe items, custom out-of-menu items, split payment, and discount
 */
export async function createBillAction(data: CreateBillInput): Promise<{
  success: boolean;
  bill?: BillRecord;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    // Lookup admin id from admin email if authenticated, otherwise mark as Staff / Counter
    let adminId: number | null = null;
    let createdByEmail: string | null = null;
    if (session.isAuthenticated && session.email) {
      createdByEmail = session.email.toLowerCase().trim();
      const adminRecord = await prisma.admin.findUnique({
        where: { email: createdByEmail },
      });
      if (adminRecord) {
        adminId = adminRecord.id;
      }
    } else {
      createdByEmail = 'Staff / Counter';
    }

    if (!data.customerName || !data.customerName.trim()) {
      return { success: false, error: 'Customer name is required.' };
    }

    // 1. Calculate PS5 amount
    let ps5Amount = 0;
    const preparedSessions = (data.ps5Sessions || []).map((s) => {
      const unitPrice = s.unitPrice ?? getPs5Rate(s.controller, s.duration);
      const qty = Math.max(1, Number(s.quantity) || 1);
      const lineTotal = unitPrice * qty;
      ps5Amount += lineTotal;
      const isDual = String(s.controller).toLowerCase() === 'dual';
      const isGta = String(s.controller).toLowerCase().includes('gta');
      return {
        controller: isDual ? 'dual' : isGta ? 'GTA 6' : 'single',
        duration: Number(s.duration) || 20,
        unitPrice,
        quantity: qty,
        total: lineTotal,
      };
    });

    // 2. Calculate Cafe Menu Items amount
    let cafeAmount = 0;
    const preparedMenuItems = (data.menuItems || []).map((m) => {
      const price = Math.max(0, Math.round(Number(m.price) || 0));
      const qty = Math.max(1, Number(m.quantity) || 1);
      const lineTotal = price * qty;
      cafeAmount += lineTotal;
      return {
        menuItemId: m.menuItemId || null,
        name: m.name.trim(),
        price,
        quantity: qty,
        total: lineTotal,
        isCustom: false,
      };
    });

    // 3. Calculate Custom Out-of-Menu Items amount
    let customAmount = 0;
    const preparedCustomItems = (data.customItems || []).map((c) => {
      const price = Math.max(0, Math.round(Number(c.price) || 0));
      const qty = Math.max(1, Number(c.quantity) || 1);
      const lineTotal = price * qty;
      customAmount += lineTotal;
      return {
        menuItemId: null,
        name: c.name.trim(),
        price,
        quantity: qty,
        total: lineTotal,
        isCustom: true,
      };
    });

    const subtotal = ps5Amount + cafeAmount + customAmount;
    const discount = Math.max(0, Math.round(Number(data.discount) || 0));
    const totalAmount = Math.max(0, subtotal - discount);

    const cashAmount = Math.max(0, Math.round(Number(data.cashAmount) || 0));
    const onlineAmount = Math.max(0, Math.round(Number(data.onlineAmount) || 0));
    const totalPaid = cashAmount + onlineAmount;

    if (totalPaid > totalAmount) {
      return {
        success: false,
        error: `Total payment (₹${totalPaid}) cannot exceed the total payable amount (₹${totalAmount}).`,
      };
    }

    let paymentStatus = 'paid';
    if (totalPaid === 0 && totalAmount > 0) {
      paymentStatus = 'pending';
    } else if (totalPaid < totalAmount) {
      paymentStatus = 'partial';
    }

    const billId = generateBillId();

    const createdBill = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.create({
        data: {
          id: billId,
          customerName: data.customerName.trim(),
          adminId,
          createdByEmail,
          cashAmount,
          onlineAmount,
          discount,
          subtotal,
          totalAmount,
          paymentStatus,
          ps5Amount,
          cafeAmount,
          customAmount,
          notes: data.notes?.trim() || null,
        },
      });

      if (preparedSessions.length > 0) {
        await tx.billPs5Session.createMany({
          data: preparedSessions.map((s) => ({
            billId: bill.id,
            ...s,
          })),
        });
      }

      const allItems = [...preparedMenuItems, ...preparedCustomItems];
      if (allItems.length > 0) {
        await tx.billItem.createMany({
          data: allItems.map((item) => ({
            billId: bill.id,
            ...item,
          })),
        });
      }

      return await tx.bill.findUnique({
        where: { id: bill.id },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sessions: true,
          items: true,
        },
      });
    });

    return { success: true, bill: createdBill as BillRecord };
  } catch (err: unknown) {
    console.error('Error creating bill:', err);
    return { success: false, error: 'Failed to create bill. Please check inputs.' };
  }
}

/**
 * Update an existing bill
 */
export async function updateBillAction(
  id: string,
  data: CreateBillInput
): Promise<{
  success: boolean;
  bill?: BillRecord;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized.' };
    }

    if (!data.customerName || !data.customerName.trim()) {
      return { success: false, error: 'Customer name is required.' };
    }

    // 1. Calculate PS5 amount
    let ps5Amount = 0;
    const preparedSessions = (data.ps5Sessions || []).map((s) => {
      const unitPrice = s.unitPrice ?? getPs5Rate(s.controller, s.duration);
      const qty = Math.max(1, Number(s.quantity) || 1);
      const lineTotal = unitPrice * qty;
      ps5Amount += lineTotal;
      const isDual = String(s.controller).toLowerCase() === 'dual';
      const isGta = String(s.controller).toLowerCase().includes('gta');
      return {
        controller: isDual ? 'dual' : isGta ? 'GTA 6' : 'single',
        duration: Number(s.duration) || 20,
        unitPrice,
        quantity: qty,
        total: lineTotal,
      };
    });

    // 2. Calculate Cafe Menu Items amount
    let cafeAmount = 0;
    const preparedMenuItems = (data.menuItems || []).map((m) => {
      const price = Math.max(0, Math.round(Number(m.price) || 0));
      const qty = Math.max(1, Number(m.quantity) || 1);
      const lineTotal = price * qty;
      cafeAmount += lineTotal;
      return {
        menuItemId: m.menuItemId || null,
        name: m.name.trim(),
        price,
        quantity: qty,
        total: lineTotal,
        isCustom: false,
      };
    });

    // 3. Calculate Custom Out-of-Menu Items amount
    let customAmount = 0;
    const preparedCustomItems = (data.customItems || []).map((c) => {
      const price = Math.max(0, Math.round(Number(c.price) || 0));
      const qty = Math.max(1, Number(c.quantity) || 1);
      const lineTotal = price * qty;
      customAmount += lineTotal;
      return {
        menuItemId: null,
        name: c.name.trim(),
        price,
        quantity: qty,
        total: lineTotal,
        isCustom: true,
      };
    });

    const subtotal = ps5Amount + cafeAmount + customAmount;
    const discount = Math.max(0, Math.round(Number(data.discount) || 0));
    const totalAmount = Math.max(0, subtotal - discount);

    const cashAmount = Math.max(0, Math.round(Number(data.cashAmount) || 0));
    const onlineAmount = Math.max(0, Math.round(Number(data.onlineAmount) || 0));
    const totalPaid = cashAmount + onlineAmount;

    if (totalPaid > totalAmount) {
      return {
        success: false,
        error: `Total payment (₹${totalPaid}) cannot exceed the total payable amount (₹${totalAmount}).`,
      };
    }

    let paymentStatus = 'paid';
    if (totalPaid === 0 && totalAmount > 0) {
      paymentStatus = 'pending';
    } else if (totalPaid < totalAmount) {
      paymentStatus = 'partial';
    }

    const updatedBill = await prisma.$transaction(async (tx) => {
      // Delete old line items & sessions
      await tx.billPs5Session.deleteMany({ where: { billId: id } });
      await tx.billItem.deleteMany({ where: { billId: id } });

      // Update Bill parent record
      await tx.bill.update({
        where: { id },
        data: {
          customerName: data.customerName.trim(),
          cashAmount,
          onlineAmount,
          discount,
          subtotal,
          totalAmount,
          paymentStatus,
          ps5Amount,
          cafeAmount,
          customAmount,
          notes: data.notes?.trim() || null,
        },
      });

      // Insert fresh sessions
      if (preparedSessions.length > 0) {
        await tx.billPs5Session.createMany({
          data: preparedSessions.map((s) => ({
            billId: id,
            ...s,
          })),
        });
      }

      // Insert fresh items
      const allItems = [...preparedMenuItems, ...preparedCustomItems];
      if (allItems.length > 0) {
        await tx.billItem.createMany({
          data: allItems.map((item) => ({
            billId: id,
            ...item,
          })),
        });
      }

      return await tx.bill.findUnique({
        where: { id },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sessions: true,
          items: true,
        },
      });
    });

    return { success: true, bill: updatedBill as BillRecord };
  } catch (err: unknown) {
    console.error('Error updating bill:', err);
    return { success: false, error: 'Failed to update bill.' };
  }
}

/**
 * Delete a bill by ID
 */
export async function deleteBillAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized.' };
    }

    await prisma.bill.delete({
      where: { id },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting bill:', err);
    return { success: false, error: 'Failed to delete bill.' };
  }
}
