import { instructor } from "@/features/marketing/content";

export function Instructor() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 md:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div>
        <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Instructor
        </p>
        <h2 className="mt-3 text-4xl font-medium tracking-tight">{instructor.name}</h2>
        <p className="mt-2 text-sm text-primary">{instructor.title}</p>
      </div>
      <div>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">{instructor.summary}</p>
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {instructor.highlights.map((item) => (
            <li key={item} className="py-3 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
