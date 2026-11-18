'use server';

import { getAdminSessionAction } from '@/actions/admin-auth';
import { prisma } from '@/lib/prisma';
import { setVapidDetails, sendNotification } from 'web-push';

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface SavePushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
  deviceName?: string;
}

/**
 * Saves or updates a push subscription for the logged-in admin's device.
 * Multiple devices can be registered under the same admin email.
 */
export async function saveAdminPushSubscriptionAction(
  input: SavePushSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated || !session.email) {
      return { success: false, error: 'Unauthorized: Admin session required' };
    }

    if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
      return { success: false, error: 'Invalid push subscription details' };
    }

    const adminEmail = session.email.toLowerCase().trim();

    await prisma.adminPushSubscription.upsert({
      where: {
        endpoint: input.endpoint,
      },
      create: {
        adminEmail,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent || null,
        deviceName: input.deviceName || null,
      },
      update: {
        adminEmail,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent || null,
        deviceName: input.deviceName || null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to save admin push subscription:', error);
    return { success: false, error: 'Database error saving push subscription' };
  }
}

/**
 * Unsubscribes a specific device from push notifications.
 */
export async function removeAdminPushSubscriptionAction(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!endpoint) {
      return { success: false, error: 'Endpoint is required' };
    }

    await prisma.adminPushSubscription.deleteMany({
      where: { endpoint },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to remove admin push subscription:', error);
    return { success: false, error: 'Failed to remove push subscription' };
  }
}

/**
 * Sends a test push notification to the current device's endpoint.
 */
export async function testAdminPushNotificationAction(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSessionAction();
    if (!session.isAuthenticated) {
      return { success: false, error: 'Unauthorized' };
    }

    const sub = await prisma.adminPushSubscription.findUnique({
      where: { endpoint },
    });

    if (!sub) {
      return { success: false, error: 'Device subscription not found in database' };
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@corpseclub.com';

    if (!publicKey || !privateKey) {
      return { success: false, error: 'VAPID keys not configured in environment' };
    }

    setVapidDetails(subject, publicKey, privateKey);

    const testPayload = JSON.stringify({
      title: '🔔 Push Notifications Active!',
      body: 'Your device is configured to receive instant booking alerts.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      url: '/admin/bookings',
      bookingId: 'TEST-00',
      timestamp: Date.now(),
    });

    await sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      testPayload,
      { TTL: 60, urgency: 'high' }
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to send test push notification:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
