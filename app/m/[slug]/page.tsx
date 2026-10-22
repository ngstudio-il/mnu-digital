import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import GuestMenu from "./GuestMenu";
import OfflineMenu from "./OfflineMenu";
import { billingConfigured } from "@/lib/stripe";
import type { Category, Dish, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> };

async function load(slug: string) {
  if (!isSupabaseConfigured) return null;
  const sb = await supabaseServer();
  const { data: venue } = await sb.from("venues").select("*").eq("slug", slug).maybeSingle();
  if (!venue) return null;
  const { data: active, error } = await sb.rpc("venue_active", { p_venue: venue.id });
  if (billingConfigured() && !error && active === false) return { venue: venue as Venue, categories: [], dishes: [], offline: true };
  const [c, d] = await Promise.all([
    sb.from("categories").select("*").eq("venue_id", venue.id).order("position"),
    sb.from("dishes").select("*").eq("venue_id", venue.id).eq("available", true).order("position").order("created_at"),
  ]);
  return { venue: venue as Venue, categories: (c.data ?? []) as Category[], dishes: (d.data ?? []) as Dish[], offline: false };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  return { title: data ? `${data.venue.name} · Menu` : "Menu not found" };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t } = await searchParams;
  const data = await load(slug);
  if (!data) notFound();
  if (data.offline) return <OfflineMenu name={data.venue.name} />;
  const table = t && /^\d{1,3}$/.test(t) ? `Table ${t}` : null;
  return <GuestMenu venue={data.venue} categories={data.categories} dishes={data.dishes} table={table} />;
}
