export interface EvidenceRef {
  chunkId: string;
  heading: string;
  publisher: string;
  title: string;
  url: string;
  date?: string | null;
}

/** Compact list of curated sources, each linking to the original page. */
export function EvidenceList({ items, title = "Sources" }: { items: EvidenceRef[]; title?: string }) {
  if (items.length === 0) return null;
  // One entry per source page, listing each section of it that was used.
  const groups = new Map<string, { ref: EvidenceRef; headings: string[] }>();
  for (const e of items) {
    const g = groups.get(e.url);
    if (!g) groups.set(e.url, { ref: e, headings: e.heading ? [e.heading] : [] });
    else if (e.heading && !g.headings.includes(e.heading)) g.headings.push(e.heading);
  }
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-soft">{title}</p>
      <ul className="space-y-1.5">
        {[...groups.values()].map(({ ref: e, headings }) => (
          <li key={e.url} className="text-sm">
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-ink underline decoration-teal/40 underline-offset-2 hover:decoration-teal-ink">
              {e.title}
            </a>
            <span className="text-ink-faint">
              {", "}
              {e.publisher}
              {e.date ? ` (${e.date})` : ""}
            </span>
            {headings.length > 0 && <span className="block text-xs text-ink-soft">{headings.join("; ")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
