import {
  debriefEmptyCopy,
  debriefHighlights,
  type DebriefSourceAnswer,
  type DebriefQuestion,
} from "@/lib/debrief-notes";

export function DebriefHighlights({
  answers,
  questions,
  roleName,
  compact = false,
}: {
  answers: DebriefSourceAnswer[];
  questions: DebriefQuestion[];
  roleName: (id: string | null | undefined) => string;
  compact?: boolean;
}) {
  const { strengths, gaps, emptyReason } = debriefHighlights(answers, questions);
  const sharedEmpty = debriefEmptyCopy(emptyReason);
  const noteClass = compact
    ? "mt-1 text-[13px] leading-relaxed text-fg-2"
    : "mt-1.5 text-[15px] leading-relaxed text-fg-2";
  const emptyClass = compact
    ? "mt-1 text-[13px] text-muted"
    : "mt-1.5 text-[15px] leading-relaxed text-muted";
  const titleClass = compact
    ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-meta"
    : "text-[12px] font-semibold uppercase tracking-[0.1em] text-meta";

  return (
    <div className={compact ? "grid gap-2" : "grid shrink-0 gap-2 md:grid-cols-2"}>
      <DebriefColumn
        title="Strengths"
        items={strengths}
        empty={sharedEmpty || "No scored strengths on this inject."}
        roleName={roleName}
        titleClass={titleClass}
        noteClass={noteClass}
        emptyClass={emptyClass}
        compact={compact}
      />
      <DebriefColumn
        title="Gaps"
        items={gaps}
        empty={sharedEmpty || "No scored gaps on this inject."}
        roleName={roleName}
        titleClass={titleClass}
        noteClass={noteClass}
        emptyClass={emptyClass}
        compact={compact}
      />
    </div>
  );
}

function DebriefColumn({
  title,
  items,
  empty,
  roleName,
  titleClass,
  noteClass,
  emptyClass,
  compact,
}: {
  title: string;
  items: ReturnType<typeof debriefHighlights>["strengths"];
  empty: string;
  roleName: (id: string | null | undefined) => string;
  titleClass: string;
  noteClass: string;
  emptyClass: string;
  compact: boolean;
}) {
  return (
    <section className="flash-card px-4 py-3">
      <h3 className={titleClass}>{title}</h3>
      {items.length === 0 ? (
        <p className={emptyClass}>{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((item) => (
            <li key={`${item.userName}-${item.roleId}-${item.kind}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={compact ? "text-[13px] font-medium" : "text-[15px] font-semibold"}>
                  {item.userName}
                  <span className="ml-1.5 font-medium text-meta">
                    · {roleName(item.roleId)}
                  </span>
                </span>
                <span className="font-mono text-[12px] tabular-nums text-meta">
                  {item.maxPoints > 0
                    ? `${item.points}/${item.maxPoints} pts`
                    : `${item.points} pts`}
                </span>
              </div>
              {item.note ? <p className={noteClass}>{item.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
