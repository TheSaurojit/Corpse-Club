'use client';

import { useState, useEffect, useRef } from 'react';
import {
  saveAdminPushSubscriptionAction,
  removeAdminPushSubscriptionAction,
  testAdminPushNotificationAction,
} from '@/actions/push-actions';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getReadableDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  const ua = window.navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = 'Device';
  if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

export default function NotificationButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check initial support & subscription status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setIsSupported(false);
      return;
    }

    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription) {
          setIsSubscribed(true);
          setCurrentEndpoint(subscription.endpoint);
        } else {
          setIsSubscribed(false);
          setCurrentEndpoint(null);
        }
      })
      .catch((err) => {
        console.error('[WebPush] Error checking subscription:', err);
      });
  }, []);

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);
      setStatusMessage(null);

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatusMessage('Error: NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.');
        return;
      }

      // 1. Request browser notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setStatusMessage('Permission was denied. Please allow notifications in site settings.');
        return;
      }

      // 2. Wait for Service Worker registration
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        const appServerKey = urlBase64ToUint8Array(vapidKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        });
      }

      // 3. Extract keys
      const subJson = subscription.toJSON();
      if (!subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Push keys missing from browser subscription.');
      }

      // 4. Send to server action to persist for admin email
      const result = await saveAdminPushSubscriptionAction({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
        deviceName: getReadableDeviceName(),
      });

      if (result.success) {
        setIsSubscribed(true);
        setCurrentEndpoint(subscription.endpoint);
        setStatusMessage('Notifications active on this device!');
      } else {
        setStatusMessage(result.error || 'Failed to register subscription.');
      }
    } catch (err) {
      console.error('[WebPush] Subscribe error:', err);
      setStatusMessage(err instanceof Error ? err.message : 'Failed to enable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setIsLoading(true);
      setStatusMessage(null);

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        await removeAdminPushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setCurrentEndpoint(null);
      setStatusMessage('Notifications disabled for this device.');
    } catch (err) {
      console.error('[WebPush] Unsubscribe error:', err);
      setStatusMessage('Failed to disable notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!currentEndpoint) return;
    try {
      setIsLoading(true);
      setStatusMessage('Sending test notification...');
      const res = await testAdminPushNotificationAction(currentEndpoint);
      if (res.success) {
        setStatusMessage('Test notification sent! Check your device.');
      } else {
        setStatusMessage(`Error: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage('Failed to trigger test notification.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell / Status Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setStatusMessage(null);
        }}
        title={
          !isSupported
            ? 'Web Push not supported on this browser'
            : isSubscribed
            ? 'Push Notifications Active'
            : 'Push Notifications Inactive (Click to setup)'
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {/* Status indicator dot */}
        {isSubscribed ? (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-black animate-pulse" />
        ) : permission === 'denied' ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        ) : (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" />
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-white/10 bg-[#0d0d0f]/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Booking Push Alerts</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  isSubscribed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isSubscribed ? 'Active' : 'Not Active'}
              </span>
            </div>
          </div>

          <div className="py-3 text-xs text-gray-400 space-y-2">
            {!isSupported ? (
              <p className="text-amber-400">
                Web Push is not supported in this browser. On iOS Safari, tap <strong>Share → Add to Home Screen</strong> first.
              </p>
            ) : permission === 'denied' ? (
              <p className="text-red-400">
                Notifications are blocked in your browser. Please reset permission in your site settings to receive alerts.
              </p>
            ) : isSubscribed ? (
              <div>
                <p className="text-gray-300 font-medium">This device will receive alerts for new bookings.</p>
                <p className="text-gray-500 text-[11px] mt-1">
                  Device: {getReadableDeviceName()}. Multiple devices can be connected under your admin email.
                </p>
              </div>
            ) : (
              <p>
                Enable push notifications to get instant alerts on this device whenever a customer books a PS5 station.
              </p>
            )}

            {statusMessage && (
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-purple-300">
                {statusMessage}
              </div>
            )}
          </div>

          {isSupported && permission !== 'denied' && (
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              {!isSubscribed ? (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleSubscribe}
                  className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Setting up...' : 'Enable Alerts on This Device'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSendTest}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Sending...' : 'Send Test Notification'}
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleUnsubscribe}
                    className="w-full py-1.5 px-3 rounded-xl bg-transparent hover:bg-red-500/10 text-red-400 text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Disable on this device
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
