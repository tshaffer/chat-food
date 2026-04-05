interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Phase 1</p>
          <h1>{title}</h1>
        </div>
      </header>

      <div className="empty-state">
        <h2>Coming in the next phase</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
