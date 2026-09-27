import type { Metadata } from "next";
import { instructor } from "@/features/marketing/content";

export const metadata: Metadata = {
  title: "About",
  description: "About CodeZetta and Nourhan Saeed.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 md:px-8 md:py-20">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">About</p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">CodeZetta</h1>
      <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
        <p>
          CodeZetta is a personal learning platform for software engineering students and working
          developers. The focus is frontend engineering: JavaScript, Angular, and the decisions that
          sit underneath a user interface.
        </p>
        <p>
          The point is understanding. Syntax is easy to look up. The harder skill is knowing why a
          reactivity model, a component boundary, or an async flow was designed the way it was, and
          how to use that design instead of fighting it.
        </p>
      </div>
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="text-2xl font-medium tracking-tight">{instructor.name}</h2>
        <p className="mt-2 text-sm text-primary">{instructor.title}</p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{instructor.summary}</p>
        <ul className="mt-6 space-y-2 text-sm">
          {instructor.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
