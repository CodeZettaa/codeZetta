import { principles } from "@/features/marketing/content";

export function WhyCodeZetta() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8">
        <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Philosophy
        </p>
        <h2 className="mt-3 max-w-lg text-3xl font-medium tracking-tight">
          Learning philosophy
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Built for people who already write software and want the engineering underneath it.
        </p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {principles.map((principle) => (
            <article key={principle.index} className="bg-background p-6 md:p-8">
              <p className="font-mono text-xs text-primary">{principle.index}</p>
              <h3 className="mt-4 text-lg font-medium">{principle.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
