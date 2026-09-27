"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourseThumbnail } from "@/features/dashboard/components/course-thumbnail";

export function ThumbnailField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const valid = value.startsWith("https://");

  return (
    <div className="grid gap-2">
      <Label htmlFor="thumbnail">Thumbnail</Label>
      <Input
        id="thumbnail"
        name="thumbnail"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://…"
        className="h-10"
      />
      <p className="text-xs text-muted-foreground">16:9 image. Paste an https URL. The file itself is not stored in the database.</p>
      {value && !valid ? <p className="text-sm text-destructive">Use an https image URL.</p> : null}
      {valid ? <CourseThumbnail title="Thumbnail" thumbnail={value} className="aspect-video max-w-xs object-cover" /> : null}
      {value ? (
        <button type="button" className="w-fit text-sm text-muted-foreground hover:text-foreground" onClick={() => setValue("")}>
          Remove
        </button>
      ) : null}
    </div>
  );
}
