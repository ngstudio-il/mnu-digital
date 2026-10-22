import { loadAdminData } from "@/lib/admin-data";
import VenueTable from "@/components/admin/VenueTable";

export default async function AdminVenues({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { rows, noVenue } = await loadAdminData();
  return <VenueTable rows={rows} noVenue={noVenue} initialStatus={status ?? "all"} />;
}
