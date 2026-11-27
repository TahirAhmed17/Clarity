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
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">{title}</p>
      <ul className="space-y-1.5">
        {items.map((e) => (
          <li key={e.chunkId} className="text-sm">
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-ink underline decoration-teal/40 underline-offset-2 hover:decoration-teal-ink">
              {e.title}
            </a>
            <span className="text-ink-faint">
              {" "}
              · {e.publisher}
              {e.date ? ` · ${e.date}` : ""}
            </span>
            <span className="block text-xs text-ink-soft">{e.heading}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
