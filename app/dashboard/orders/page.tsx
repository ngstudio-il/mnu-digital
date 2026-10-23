"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { ago, money } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

function Column({ status, children }: { status: OrderStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return <section ref={setNodeRef} className={`col${isOver ? " over" : ""}`}>{children}</section>;
}

function Ticket({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id });
  return (
    <article ref={setNodeRef} {...attributes} {...listeners} className={`ticket draggable${isDragging ? " dragging" : ""}`}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}>
      {children}
    </article>
  );
}

const COLS: [OrderStatus, string][] = [["new", "New"], ["preparing", "Preparing"], ["ready", "Ready"], ["done", "Completed"]];
const NEXT: Partial<Record<OrderStatus, [OrderStatus, string][]>> = {
  new: [["cancelled", "Decline"], ["preparing", "Accept"]],
  preparing: [["ready", "Mark ready"]],
  ready: [["done", "Complete"]],
};
const DONE_MSG: Record<OrderStatus, string> = { preparing: "accepted", ready: "is ready", done: "completed", cancelled: "declined", new: "" };

export default function Orders() {
  const { venue, setVenue, toast, orderTick, refreshNewOrders } = useDash();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<"all" | "dinein" | "takeaway">("all");
  const [, setNow] = useState(0);

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    supabaseBrowser().from("orders").select("*, order_items(*)").eq("venue_id", venue.id).gte("created_at", since).order("created_at")
      .then(({ data }: { data: Order[] | null }) => setOrders(data ?? []));
  }, [venue.id, orderTick]);

  useEffect(() => { const t = setInterval(() => setNow((n) => n + 1), 60000); return () => clearInterval(t); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  function onDragEnd(e: DragEndEvent) {
    const to = e.over?.id as OrderStatus | undefined;
    const o = orders?.find((x) => x.id === e.active.id);
    if (!to || !o || o.status === to) return;
    move(o, to);
  }

  async function move(o: Order, status: OrderStatus) {
    setOrders((list) => list?.map((x) => (x.id === o.id ? { ...x, status } : x)) ?? null);
    const { error } = await supabaseBrowser().from("orders").update({ status }).eq("id", o.id);
    if (error) { toast("Couldn’t update the order. Check your connection."); return; }
    toast(`Order #${o.number} ${DONE_MSG[status]}`);
    refreshNewOrders();
  }

  async function toggleAccepting() {
    const ordering_on = !venue.ordering_on;
    const { data, error } = await supabaseBrowser().from("venues").update({ ordering_on }).eq("id", venue.id).select().single();
    if (error || !data) return toast("Couldn’t change the setting.");
    setVenue(data);
    toast(ordering_on ? "Orders are on" : "Orders paused");
  }

  const list = (orders ?? []).filter((o) => filter === "all" || o.type === filter);

  return (
    <>
      <div className="orders-bar">
        <div className="seg" role="group" aria-label="Filter orders">
          {([["all", "All"], ["dinein", "Dine-in"], ["takeaway", "Pickup"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <span className="accepting">Accepting orders <button className="switch" type="button" role="switch" aria-checked={venue.ordering_on} aria-label="Accepting orders" onClick={toggleAccepting} /></span>
      </div>
      {!venue.ordering_on && <div className="paused">Ordering is paused. Guests can still see the menu but can’t place orders.</div>}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="board">
        {COLS.map(([status, label]) => {
          let items = list.filter((o) => o.status === status);
          if (status === "done") items = items.slice(-6).reverse();
          return (
            <Column status={status} key={status}>
              <div className="col-head"><b>{label}</b><span>{items.length}</span></div>
              {orders === null ? <p className="col-empty">Loading…</p> : items.length ? items.map((o) => (
                <Ticket id={o.id} key={o.id}>
                  <div className="t-top"><b>#{o.number}</b><span>{ago(o.created_at)}</span></div>
                  <div className="t-where"><span>{o.type === "takeaway" ? "Pickup" : o.table_label || "Dine-in"}</span>{o.customer_name && <span>{o.customer_name}</span>}</div>
                  <ul className="t-items">{o.order_items?.map((it) => <li key={it.id}><b>{it.qty}×</b>{it.name}</li>)}</ul>
                  {o.note && <p className="t-note">{o.note}</p>}
                  <div className="t-foot"><em>{money(o.total, venue.currency)}</em>
                    <div className="t-actions">{NEXT[o.status]?.map(([to, l]) => (
                      <button key={to} type="button" className={`btn sm${to === "cancelled" ? " ghost" : ""}`} onClick={() => move(o, to)}>{l}</button>
                    ))}</div>
                  </div>
                </Ticket>
              )) : <p className="col-empty">{status === "new" ? "New orders from guests land here." : "Nothing here yet."}</p>}
            </Column>
          );
        })}
      </div>
      </DndContext>
      <p className="note" style={{ marginTop: 12 }}>Tip: drag an order to another column to move it, for example from New to Preparing to accept it.</p>
    </>
  );
}
