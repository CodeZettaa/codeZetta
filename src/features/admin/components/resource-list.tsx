"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addLessonResource, deleteLessonResource, reorderLessonResources } from "@/features/admin/actions";
import { BoundForm } from "@/features/admin/components/bound-form";
import { fieldControl } from "@/features/admin/components/course-fields";

const kinds = [
  ["PDF", "PDF"],
  ["SLIDES", "Slides"],
  ["SOURCE", "Source code"],
  ["EXERCISE", "Exercise"],
  ["LINK", "External link"],
  ["OTHER", "Other"],
] as const;

type Resource = { id: string; title: string; url: string; kind: (typeof kinds)[number][0] };

function label(resource: Resource) {
  if (resource.kind === "SOURCE" && resource.url.toLowerCase().includes("github")) return "GitHub";
  return kinds.find((item) => item[0] === resource.kind)?.[1] ?? "Link";
}

export function ResourceList({
  courseId,
  lessonId,
  resources,
}: {
  courseId: string;
  lessonId: string;
  resources: Resource[];
}) {
  const [items, setItems] = useState(resources);
  const [error, setError] = useState<string | null>(null);
  const signature = resources.map((resource) => resource.id).join(",");
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setItems(resources);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    const [row] = next.splice(index, 1);
    if (!row) return;
    next.splice(target, 0, row);
    setItems(next);
    setError(null);
    const result = await reorderLessonResources(lessonId, next.map((resource) => resource.id));
    if (!result.ok) {
      setItems(previous);
      setError("We couldn't save the new order. Please try again.");
    }
  }

  return (
    <section className="mt-12 max-w-xl">
      <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Resources</h2>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <ul className="mt-3">
        {items.length === 0 ? (
          <li className="py-2 text-sm text-muted-foreground">No resources yet.</li>
        ) : (
          items.map((resource, index) => (
            <li key={resource.id} className="flex items-center gap-3 border-t border-border py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">≡</span>
              <span className="min-w-0 flex-1 truncate">{resource.title}</span>
              <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">{label(resource)}</span>
              <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={index === 0} onClick={() => void move(index, -1)}>
                Up
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={index === items.length - 1} onClick={() => void move(index, 1)}>
                Down
              </button>
              <form action={deleteLessonResource.bind(null, resource.id, lessonId)}>
                <button type="submit" className="text-muted-foreground hover:text-foreground">
                  Remove
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
      <BoundForm action={addLessonResource} submitLabel="Add resource" className="mt-4 grid gap-3">
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="courseId" value={courseId} />
        <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="resource-kind">Type</Label>
            <select id="resource-kind" name="kind" defaultValue="PDF" className={fieldControl}>
              {kinds.map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resource-title">Title</Label>
            <Input id="resource-title" name="title" required className="h-10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resource-url">URL</Label>
            <Input id="resource-url" name="url" required type="url" className="h-10" />
          </div>
        </div>
      </BoundForm>
    </section>
  );
}
