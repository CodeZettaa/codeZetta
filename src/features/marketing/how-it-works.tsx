const steps = [
  {
    index: "01",
    title: "A curriculum you can scan",
    body: "Each course is modules and lessons. Preview lessons are marked. The rest open after you are enrolled.",
  },
  {
    index: "02",
    title: "Study in the player",
    body: "The lesson, the curriculum, and your place in the course stay on one screen. On a phone, the curriculum is a drawer.",
  },
  {
    index: "03",
    title: "Leave, then resume",
    body: "Position and completion are stored against your account. The dashboard opens the lesson you should continue.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8">
      <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">How courses work</p>
      <h2 className="mt-3 max-w-xl text-3xl font-medium tracking-tight">
        A path through the material, not a pile of videos.
      </h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <li key={step.index} className="rounded-2xl border border-border p-6">
            <p className="font-mono text-xs text-primary">{step.index}</p>
            <h3 className="mt-4 text-base font-medium">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
