'use server';

import { prisma } from '@/lib/prisma';
import { getAdminSessionAction } from './admin-auth';

export interface MenuItemData {
  id: number;
  name: string;
  category: string;
  price: number;
  description?: string | null;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getMenuItemsAction(): Promise<{
  success: boolean;
  items: MenuItemData[];
  error?: string;
}> {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return { success: true, items };
  } catch (err: unknown) {
    console.error('Error fetching menu items:', err);
    return { success: false, items: [], error: 'Failed to load menu items.' };
  }
}

export async function createMenuItemAction(data: {
  name: string;
  category: string;
  price: number;
  description?: string;
  isAvailable?: boolean;
}): Promise<{
  success: boolean;
  item?: MenuItemData;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized. Admin session required.' };
    }

    if (!data.name || !data.name.trim()) {
      return { success: false, error: 'Item name is required.' };
    }

    if (data.price === undefined || data.price < 0) {
      return { success: false, error: 'A valid price is required.' };
    }

    const item = await prisma.menuItem.create({
      data: {
        name: data.name.trim(),
        category: (data.category || 'General').trim(),
        price: Math.round(Number(data.price)),
        description: data.description?.trim() || null,
        isAvailable: data.isAvailable !== undefined ? Boolean(data.isAvailable) : true,
      },
    });

    return { success: true, item };
  } catch (err: unknown) {
    console.error('Error creating menu item:', err);
    return { success: false, error: 'Failed to create menu item.' };
  }
}

export async function updateMenuItemAction(
  id: number,
  data: {
    name?: string;
    category?: string;
    price?: number;
    description?: string;
    isAvailable?: boolean;
  }
): Promise<{
  success: boolean;
  item?: MenuItemData;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized. Admin session required.' };
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.category ? { category: data.category.trim() } : {}),
        ...(data.price !== undefined ? { price: Math.round(Number(data.price)) } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isAvailable !== undefined ? { isAvailable: Boolean(data.isAvailable) } : {}),
      },
    });

    return { success: true, item };
  } catch (err: unknown) {
    console.error('Error updating menu item:', err);
    return { success: false, error: 'Failed to update menu item.' };
  }
}

export async function deleteMenuItemAction(id: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized. Admin session required.' };
    }

    await prisma.menuItem.delete({
      where: { id },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('Error deleting menu item:', err);
    return { success: false, error: 'Failed to delete menu item.' };
  }
}

export async function toggleMenuItemStockAction(
  id: number,
  isAvailable: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized.' };
    }

    await prisma.menuItem.update({
      where: { id },
      data: { isAvailable },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('Error toggling menu item stock:', err);
    return { success: false, error: 'Failed to toggle availability.' };
  }
}

export async function seedDefaultMenuAction(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const count = await prisma.menuItem.count();
    if (count > 0) {
      return { success: true, count, error: 'Menu already contains items.' };
    }

    const defaultItems = [
      { name: 'Cold Coffee (Classic)', category: 'Beverages', price: 90, description: 'Chilled rich blended coffee' },
      { name: 'Monster Energy Drink', category: 'Beverages', price: 125, description: '500ml Energy Boost can' },
      { name: 'Red Bull Energy Can', category: 'Beverages', price: 125, description: '250ml Vitalizing drink' },
      { name: 'Iced Lemon Tea', category: 'Beverages', price: 70, description: 'Refreshing iced tea with lemon & mint' },
      { name: 'Crispy Salted Fries', category: 'Snacks', price: 90, description: 'Golden French fries served with dip' },
      { name: 'Peri Peri Fries', category: 'Snacks', price: 110, description: 'Spicy seasoned fries with mayo' },
      { name: 'Veg Cheese Burger', category: 'Food', price: 120, description: 'Crispy patty with cheddar & special sauce' },
      { name: 'Chicken Crispy Burger', category: 'Food', price: 150, description: 'Fried chicken patty with lettuce & mayo' },
      { name: 'Corpse Club Special Maggi', category: 'Snacks', price: 80, description: 'Double masala noodles with sweet corn' },
      { name: 'Cheese Burst Maggi', category: 'Snacks', price: 100, description: 'Maggi loaded with melted mozzarella' },
    ];

    await prisma.menuItem.createMany({
      data: defaultItems.map((item) => ({
        ...item,
        isAvailable: true,
      })),
    });

    return { success: true, count: defaultItems.length };
  } catch (err: unknown) {
    console.error('Error seeding default menu:', err);
    return { success: false, count: 0, error: 'Failed to seed sample menu.' };
  }
}
