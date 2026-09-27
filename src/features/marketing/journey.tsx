const stages = [
  { title: "Create an account", body: "Your progress is tied to you, not to a browser." },
  { title: "Get access", body: "The instructor enrolls you. Payment will use the same step later." },
  { title: "Work through the lessons", body: "Mark a lesson complete when you understand it, then take the next one." },
  { title: "Come back", body: "The dashboard resumes the lesson you were in, including the module you are on." },
];

export function Journey() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8">
        <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Student journey</p>
        <h2 className="mt-3 max-w-lg text-3xl font-medium tracking-tight">From the first lesson to the last one you finished.</h2>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage, index) => (
            <li key={stage.title} className="bg-background p-6">
              <p className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-4 text-base font-medium">{stage.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
