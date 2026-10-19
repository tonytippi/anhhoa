// Device-level Web Push opt-in. iOS only delivers push to an installed (Home Screen) web app,
// so a Safari tab is asked to install first instead of showing a permission prompt that cannot work.
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfCookieName = typeof __CSRF_COOKIE_NAME__ === "undefined" ? "teacher_csrf" : __CSRF_COOKIE_NAME__;
const audience = "teacher";

export type PushState = "hidden" | "install-required" | "denied" | "off" | "on";
const csrf = () => decodeURIComponent(document.cookie.split("; ").find((entry) => entry.startsWith(`${csrfCookieName}=`))?.slice(csrfCookieName.length + 1) ?? "");
const base = (schoolId: string) => `${apiUrl}/api/${audience}/schools/${encodeURIComponent(schoolId)}/push`;
const post = (url: string, body: unknown) => fetch(url, { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify(body) });
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const key = (value: string) => {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};
async function registration() {
  if (!supported()) return undefined;
  return navigator.serviceWorker.getRegistration().catch(() => undefined);
}
async function publicKey(schoolId: string) {
  const response = await fetch(`${base(schoolId)}/config`, { credentials: "include", cache: "no-store" }).catch(() => undefined);
  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => null)) as { data?: { enabled?: boolean; publicKey?: string | null } } | null;
  return payload?.data?.enabled && payload.data.publicKey ? payload.data.publicKey : null;
}

export async function pushState(schoolId: string): Promise<PushState> {
  if (isIos() && !standalone()) return (await publicKey(schoolId)) ? "install-required" : "hidden";
  const worker = await registration();
  if (!worker || !(await publicKey(schoolId))) return "hidden";
  if (Notification.permission === "denied") return "denied";
  const subscription = await worker.pushManager.getSubscription();
  if (!subscription) return "off";
  // Re-link on every visit: the same browser may now be signed in as someone else.
  const response = await post(`${base(schoolId)}/subscriptions`, subscription.toJSON()).catch(() => undefined);
  return response?.ok ? "on" : "off";
}
export async function enablePush(schoolId: string): Promise<PushState> {
  const worker = await registration();
  const serverKey = await publicKey(schoolId);
  if (!worker || !serverKey) return "hidden";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const subscription = (await worker.pushManager.getSubscription()) ?? (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(serverKey) }));
  const response = await post(`${base(schoolId)}/subscriptions`, subscription.toJSON()).catch(() => undefined);
  return response?.ok ? "on" : "off";
}
export async function disablePush(schoolId = "device"): Promise<PushState> {
  const subscription = await (await registration())?.pushManager.getSubscription().catch(() => null);
  if (!subscription) return "off";
  await post(`${base(schoolId)}/subscriptions/remove`, { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
  return "off";
}
