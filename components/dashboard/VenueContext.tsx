"use client";
import { createContext, useContext } from "react";
import type { Subscription, Venue } from "@/lib/types";

export type DashCtx = {
  venue: Venue;
  setVenue: (v: Venue) => void;
  user: { id: string; name: string; email: string; provider: string; lang: string };
  toast: (msg: string) => void;
  newOrders: number;
  refreshNewOrders: () => void;
  orderTick: number;
  subscription: Subscription;
  openBilling: () => void;
};

export const VenueContext = createContext<DashCtx | null>(null);

export function useDash() {
  const c = useContext(VenueContext);
  if (!c) throw new Error("useDash must be used inside the dashboard");
  return c;
}
