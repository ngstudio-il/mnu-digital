import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import GuestMenu from "./GuestMenu";
import OfflineMenu from "./OfflineMenu";
import Tracking from "./Tracking";
import { billingConfigured } from "@/lib/stripe";
import { BUILT_IN_UI, UI_EN, type ContentMap, type UiStrings } from "@/lib/i18n";
import type { Category, Dish, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string; preview?: string }> };
type Sb = Awaited<ReturnType<typeof supabaseServer>>;

// Words for the guest menu in each language it offers; English fills any gap.
async function loadUi(sb: Sb, langs: string[]) {
  const ui: Record<string, UiStrings> = {};
  const fromDb = langs.filter((l) => !BUILT_IN_UI[l]);
  const { data } = fromDb.length ? await sb.from("ui_translations").select("lang, strings").in("lang", fromDb) : { data: [] };
  for (const l of langs) {
    const row = (data ?? []).find((r) => r.lang === l);
    ui[l] = { ...UI_EN, ...(BUILT_IN_UI[l] ?? (row?.strings as Partial<UiStrings> | undefined) ?? {}) };
  }
  return ui;
}

async function load(slug: string) {
  if (!isSupabaseConfigured) return null;
  const sb = await supabaseServer();
  const { data: venue } = await sb.from("venues").select("*").eq("slug", slug).maybeSingle();
  if (!venue) return null;
  const primary: string = venue.primary_lang || "en";
  // A private menu is shown only to its owner and admins, with a note that guests can't see it.
  let ownerView = false;
  if (venue.is_public === false) {
    const { data: { user } } = await sb.auth.getUser();
    ownerView = !!user && (user.id === venue.owner_id || (await sb.rpc("is_admin")).data === true);
    if (!ownerView) return { venue: venue as Venue, categories: [], dishes: [], offline: true, private: true, ownerView, primary, langs: [primary], content: {}, ui: await loadUi(sb, [primary]) };
  }
  const { data: active, error } = await sb.rpc("venue_active", { p_venue: venue.id });
  if (billingConfigured() && !error && active === false) {
    return { venue: venue as Venue, categories: [], dishes: [], offline: true, private: false, ownerView, primary, langs: [primary], content: {}, ui: await loadUi(sb, [primary]) };
  }
  const targets = ((venue.langs as string[]) ?? []).filter((l) => l !== primary);
  const [c, d, tr] = await Promise.all([
    sb.from("categories").select("*").eq("venue_id", venue.id).order("position"),
    sb.from("dishes").select("*").eq("venue_id", venue.id).eq("available", true).order("position").order("created_at"),
    targets.length ? sb.from("menu_translations").select("lang, key, name, description").eq("venue_id", venue.id).in("lang", targets) : Promise.resolve({ data: [] }),
  ]);
  const content: ContentMap = {};
  for (const r of (tr.data ?? []) as { lang: string; key: string; name: string; description: string }[]) (content[r.lang] ??= {})[r.key] = { name: r.name, description: r.description };
  // A language is offered once at least part of the menu is translated into it.
  const langs = [primary, ...targets.filter((l) => content[l])];
  return {
    venue: venue as Venue, categories: (c.data ?? []) as Category[], dishes: (d.data ?? []) as Dish[], offline: false, private: false, ownerView,
    primary, langs, content, ui: await loadUi(sb, langs),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  return {
    title: data ? `${data.venue.name} · ${data.ui[data.primary].menu}` : "Menu not found",
    ...(data?.venue.is_public === false ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t, preview } = await searchParams;
  const data = await load(slug);
  if (!data) notFound();
  if (data.offline) return <OfflineMenu name={data.venue.name} lang={data.primary} ui={data.ui[data.primary]} message={data.private ? data.ui[data.primary].privateMenu : undefined} />;
  const table = t && /^\d{1,3}$/.test(t) ? `Table ${t}` : null;
  // The dashboard's preview frame doesn't count as a visit, so it gets no tracking.
  const inPreview = preview === "1";
  return <>{!inPreview && data.venue.marketing && <Tracking m={data.venue.marketing} />}<GuestMenu preview={inPreview} ownerView={data.ownerView} venue={data.venue} categories={data.categories} dishes={data.dishes} table={table} i18n={{ primary: data.primary, langs: data.langs, content: data.content, ui: data.ui }} /></>;
}
