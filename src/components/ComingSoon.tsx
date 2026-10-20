// Placeholder for screens planned in later milestones.

export function ComingSoon({ title, milestone, points }: { title: string; milestone: string; points: string[] }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">{title}</h1>
      <section className="mt-5 rounded-3xl bg-card p-6">
        <span className="rounded-full bg-sage-soft px-3 py-1 text-sm font-semibold text-sage-dark">{milestone}</span>
        <ul className="mt-4 space-y-2 text-[15px] text-ink/80">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-sage">•</span>
              {p}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
