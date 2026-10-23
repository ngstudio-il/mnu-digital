"use client";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type Handle = { ref: (el: HTMLElement | null) => void; props: Record<string, unknown> };

// A list the owner can reorder by dragging the grip handle (mouse, touch or keyboard).
// `horizontal` is for lists laid out in a row, like the category chips on a phone.
export function SortableList<T extends { id: string }>({ items, onReorder, render, disabled = false, horizontal = false }: {
  items: T[];
  onReorder: (next: T[]) => void;
  render: (item: T, handle: Handle | null, dragging: boolean) => React.ReactNode;
  disabled?: boolean;
  horizontal?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function end(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }
  if (disabled) return <>{items.map((i) => <div key={i.id}>{render(i, null, false)}</div>)}</>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={items.map((i) => i.id)} strategy={horizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}>
        {items.map((i) => <Row key={i.id} id={i.id}>{(h, dragging) => render(i, h, dragging)}</Row>)}
      </SortableContext>
    </DndContext>
  );
}

function Row({ id, children }: { id: string; children: (h: Handle, dragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 5 : undefined }}>
      {children({ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } }, isDragging)}
    </div>
  );
}

export function Grip({ handle, label }: { handle: Handle | null; label: string }) {
  if (!handle) return null;
  return (
    <span ref={handle.ref} {...handle.props} className="grip" aria-label={`Drag to reorder ${label}`} title="Drag to reorder">
      <svg viewBox="0 0 12 18" aria-hidden="true"><circle cx="3" cy="3" r="1.5" /><circle cx="9" cy="3" r="1.5" /><circle cx="3" cy="9" r="1.5" /><circle cx="9" cy="9" r="1.5" /><circle cx="3" cy="15" r="1.5" /><circle cx="9" cy="15" r="1.5" /></svg>
    </span>
  );
}
