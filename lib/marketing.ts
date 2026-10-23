// Validation of the tracking IDs owners can add to their menu, and the events the menu reports.
export const ID_RULES = {
  meta: /^\d{8,20}$/,
  google: /^(G|AW|DC|GT)-[A-Z0-9]{4,20}$|^GTM-[A-Z0-9]{4,12}$/,
  tiktok: /^[A-Z0-9]{12,30}$/,
};
export const CURRENCY_CODE: Record<string, string> = { "$": "USD", "₪": "ILS", "€": "EUR", "£": "GBP" };

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; ttq?: { track: (e: string, p?: object) => void } };

// Sends one menu event to every tracker the venue set up (no-op when there are none).
export function track(event: "ViewContent" | "AddToCart" | "Purchase", params: { name?: string; value?: number; currency?: string } = {}) {
  if (typeof window === "undefined") return;
  const w = window as W;
  const p = { content_name: params.name, value: params.value, currency: params.currency };
  try { w.fbq?.("track", event, p); } catch { /* tracker failed */ }
  try { w.ttq?.track(event === "Purchase" ? "CompletePayment" : event, p); } catch { /* tracker failed */ }
  const ga = { ViewContent: "view_item", AddToCart: "add_to_cart", Purchase: "purchase" }[event];
  // Only to the venue's own Google tags, not to any other tag on the page.
  const targets = (w as unknown as { __mnuGoogle?: string[] }).__mnuGoogle;
  try { if (targets?.length) w.gtag?.("event", ga, { send_to: targets, value: params.value, currency: params.currency, items: params.name ? [{ item_name: params.name }] : undefined }); } catch { /* tracker failed */ }
}
