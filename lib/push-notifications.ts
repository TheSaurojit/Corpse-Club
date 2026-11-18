import 'server-only';
import { setVapidDetails, sendNotification, type PushSubscription } from 'web-push';
import { prisma } from '@/lib/prisma';

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@corpseclub.com';

  if (!publicKey || !privateKey) {
    console.warn('[WebPush] VAPID keys not configured in environment. Push notifications disabled.');
    return false;
  }

  try {
    setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error('[WebPush] Failed to initialize VAPID configuration:', err);
    return false;
  }
}

export interface BookingNotificationPayload {
  id: string;
  customerName: string;
  customerPhone?: string;
  bookingDate: string;
  startTime: string;
  endTime?: string;
  podId?: string;
  totalPrice?: number;
}

/**
 * Sends web push notifications asynchronously to all registered admin devices.
 * Supports multiple device logins per admin email.
 * Automatically cleans up expired or revoked subscriptions (HTTP 410 / 404).
 */
export async function sendBookingCreatedNotificationToAdmins(
  booking: BookingNotificationPayload
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, pruned: 0 };
  }

  try {
    const subscriptions = await prisma.adminPushSubscription.findMany();

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[WebPush] No active admin push subscriptions found.');
      return { sent: 0, failed: 0, pruned: 0 };
    }

    const podLabel = booking.podId === 'pod-02' ? 'Pod 02' : 'Pod 01';
    const priceText = booking.totalPrice ? ` • ₹${booking.totalPrice}` : '';

    const payload = JSON.stringify({
      title: `🎮 New Booking: ${booking.id}`,
      body: `${booking.customerName} booked for ${booking.bookingDate} at ${booking.startTime} (${podLabel})${priceText}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      url: `/admin/bookings?highlight=${encodeURIComponent(booking.id)}`,
      bookingId: booking.id,
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;
    let pruned = 0;

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await sendNotification(pushSubscription, payload, {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: 'high',
          });
          return { status: 'sent', endpoint: sub.endpoint };
        } catch (err: unknown) {
          const webPushErr = err as { statusCode?: number; message?: string };
          // If subscription is expired or revoked (410 Gone / 404 Not Found), prune it
          if (webPushErr.statusCode === 410 || webPushErr.statusCode === 404) {
            try {
              await prisma.adminPushSubscription.delete({
                where: { endpoint: sub.endpoint },
              });
              return { status: 'pruned', endpoint: sub.endpoint };
            } catch {
              return { status: 'failed', endpoint: sub.endpoint };
            }
          }
          console.error(`[WebPush] Push failed for endpoint ${sub.endpoint.slice(0, 30)}...:`, webPushErr.message);
          return { status: 'failed', endpoint: sub.endpoint };
        }
      })
    );

    for (const res of results) {
      if (res.status === 'fulfilled') {
        if (res.value.status === 'sent') sent++;
        else if (res.value.status === 'pruned') pruned++;
        else failed++;
      } else {
        failed++;
      }
    }

    console.log(`[WebPush] Booking ${booking.id} broadcast complete: ${sent} sent, ${pruned} pruned, ${failed} failed.`);
    return { sent, failed, pruned };
  } catch (error) {
    console.error('[WebPush] Error broadcasting booking push notification:', error);
    return { sent: 0, failed: 0, pruned: 0 };
  }
}
