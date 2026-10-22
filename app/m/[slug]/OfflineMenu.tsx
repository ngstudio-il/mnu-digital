import "@/styles/guest.css";

export default function OfflineMenu({ name }: { name: string }) {
  return (
    <div className="g" style={{ ["--brand" as string]: "#1f2829" }}>
      <header className="g-head"><small>MENU</small><h1>{name}</h1></header>
      <p className="g-empty">This menu isn’t available right now. Please ask a member of staff.</p>
    </div>
  );
}
