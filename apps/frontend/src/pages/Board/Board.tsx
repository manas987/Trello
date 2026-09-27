import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, type Issue, type Section } from "../../lib/api";
import { message } from "../../lib/use";
import { live, useLive } from "../../lib/ws";
import { Search, TopStrip } from "../../chrome";
import {
  Button,
  Dialog,
  Icon,
  Input,
  Notice,
  Plotting,
  RevisionCloud,
  Stamp,
} from "../../ui";
import { useConfirm } from "../../lib/confirm";
import { useOrg } from "../Org/context";
import { useUnread } from "./unread";
import { SheetView } from "./SheetView";

type Issues = Record<number, Issue[]>;

const bandName = (section: Section) => section.title?.trim() || "Untitled band";

function LoadRule({ count }: { count: number }) {
  const gap = count === 0 ? 0 : Math.max(3, 11 - Math.min(count, 8));
  return (
    <div
      aria-hidden="true"
      className={"h-2 w-full " + (count === 0 ? "" : "hatch")}
      style={{ ["--hatch-gap" as string]: `${gap}px` }}
    />
  );
}

export function Board() {
  const { boardId } = useParams();
  const id = Number(boardId);
  if (!Number.isFinite(id)) return null;
  return <BoardView key={id} id={id} />;
}

function BoardView({ id }: { id: number }) {
  const { org, isAdmin, boards, members } = useOrg();
  const board = boards.find((candidate) => candidate.id === id);

  const [sections, setSections] = useState<Section[] | null>(null);
  const [issues, setIssues] = useState<Issues>({});
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [present, setPresent] = useState<string[]>([]);
  const [open, setOpen] = useState<Issue | null>(null);
  const [dragging, setDragging] = useState<Issue | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [refusal, setRefusal] = useState<{ section: number; text: string } | null>(null);
  const [naming, setNaming] = useState<null | { id?: number; value: string }>(null);
  const [composing, setComposing] = useState<number | null>(null);
  const [moving, setMoving] = useState<Issue | null>(null);
  const { unread, mark, clear } = useUnread();
  const { confirm, confirmNode } = useConfirm();
  const openId = useRef<number | null>(null);

  useEffect(() => {
    openId.current = open?.id ?? null;
  }, [open]);

  const loadSection = useCallback(async (sectionId: number) => {
    const list = await api.issues(sectionId).catch(() => null);
    if (list) setIssues((current) => ({ ...current, [sectionId]: list }));
  }, []);

  const loadBoard = useCallback(async () => {
    try {
      const list = await api.sections(id);
      setSections(list);
      const loaded = await Promise.all(
        list.map((section) => api.issues(section.id).then((rows) => [section.id, rows] as const)),
      );
      setIssues(Object.fromEntries(loaded));
      setError("");
    } catch (caught) {
      setError(message(caught));
      setSections([]);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBoard();
    live.joinBoard(id);
    return () => live.joinBoard(null);
  }, [id, loadBoard]);

  useLive(["section:updated"], loadBoard);
  useLive(["issue:updated", "issue:deleted"], (frame) => {
    const sectionId = Number(frame.sectionId);
    if (Number.isFinite(sectionId)) loadSection(sectionId);
  });
  useLive(["issue:moved"], (frame) => {
    [frame.fromSectionId, frame.toSectionId].forEach((value) => {
      const sectionId = Number(value);
      if (Number.isFinite(sectionId)) loadSection(sectionId);
    });
  });
  useLive(["comment:updated"], (frame) => {
    const issueId = Number(frame.issueId);
    if (Number.isFinite(issueId) && issueId !== openId.current) mark(issueId);
  });
  useLive(["liveMembers:changed"], (frame) => {
    const list = frame.members as { email: string }[] | undefined;
    setPresent(Array.isArray(list) ? list.map((m) => m.email) : []);
  });

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const filter = (list: Issue[]) =>
      !needle
        ? list
        : list.filter(
            (issue) =>
              issue.title.toLowerCase().includes(needle) ||
              (issue.description ?? "").toLowerCase().includes(needle) ||
              issue.assignees.some((person) => person.email.toLowerCase().includes(needle)),
          );
    return Object.fromEntries(
      Object.entries(issues).map(([key, list]) => [key, filter(list)]),
    ) as Issues;
  }, [issues, needle]);

  const total = Object.values(issues).reduce((sum, list) => sum + list.length, 0);

  async function move(issue: Issue, toSection: number) {
    setRefusal(null);
    if (issue.sectionid === toSection) {
      setRefusal({ section: toSection, text: "Already in this band." });
      return;
    }
    const from = issue.sectionid;
    setIssues((current) => ({
      ...current,
      [from]: (current[from] ?? []).filter((candidate) => candidate.id !== issue.id),
      [toSection]: [...(current[toSection] ?? []), { ...issue, sectionid: toSection }],
    }));
    try {
      await api.moveIssue(issue.id, toSection);
    } catch (caught) {
      setRefusal({ section: toSection, text: message(caught) });
      loadSection(from);
      loadSection(toSection);
    }
  }

  async function saveSection(event: FormEvent) {
    event.preventDefault();
    if (!naming) return;
    setError("");
    try {
      if (naming.id) await api.updateSection(naming.id, naming.value.trim());
      else await api.createSection(id, naming.value.trim());
      setNaming(null);
      loadBoard();
    } catch (caught) {
      setError(message(caught));
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <TopStrip over={org.name} title={board?.title ?? "Board"} to={`/org/${org.id}`}>
        <Search value={query} onChange={setQuery} placeholder="Filter sheets on this board" />
        <div className="flex items-center gap-3">
          {present.length > 0 ? (
            <div className="flex items-center gap-2" title={`At the board: ${present.join(", ")}`}>
              <span className="stencil hidden text-[9px] text-faint sm:block">At the board</span>
              <div className="flex -space-x-1.5">
                {present.slice(0, 5).map((email) => (
                  <Stamp key={email} email={email} size={26} />
                ))}
                {present.length > 5 ? (
                  <span className="stencil grid h-[26px] w-[26px] place-items-center pen-0 border-rule text-[9px] text-faint">
                    +{present.length - 5}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          <span className="stencil hidden text-[9px] text-faint md:block">
            Sheets <span className="text-line">{String(total).padStart(3, "0")}</span>
          </span>
        </div>
      </TopStrip>

      {error ? (
        <div className="px-5 pt-4 sm:px-7">
          <Notice>{error}</Notice>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        {sections === null ? (
          <p className="flex items-center gap-3 p-8 stencil text-[10px] text-faint">
            <Plotting /> Reading the board
          </p>
        ) : sections.length === 0 ? (
          <div className="max-w-xl p-8">
            <h2 className="stencil-wide text-[1.5rem] leading-tight text-line">
              No bands on this board
            </h2>
            <p className="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-faint">
              A band is a stage work passes through — drafted, checked, issued. Sheets
              live inside bands, and moving a sheet between them is the whole job.
            </p>
            {isAdmin ? (
              <Button tone="stamp" className="mt-6" onClick={() => setNaming({ value: "" })}>
                <Icon name="plus" size={13} />
                Add the first band
              </Button>
            ) : (
              <p className="mt-6 stencil text-[10px] text-faint">
                Only an admin can add bands.
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-full min-w-max items-stretch">
            {sections.map((section) => {
              const list = visible[section.id] ?? [];
              const count = (issues[section.id] ?? []).length;
              const isOver = over === section.id;
              return (
                <section
                  key={section.id}
                  onDragOver={(event) => {
                    if (!dragging) return;
                    event.preventDefault();
                    setOver(section.id);
                  }}
                  onDragLeave={() => setOver((current) => (current === section.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setOver(null);
                    if (dragging) move(dragging, section.id);
                    setDragging(null);
                  }}
                  className={
                    "flex w-[19.5rem] shrink-0 flex-col pen-r-0 border-rule transition-colors " +
                    (isOver ? "bg-raise/50" : "")
                  }
                >
                  <header className="sticky top-0 bg-field px-4 pb-0 pt-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="stencil truncate text-[11px] text-line">
                        {bandName(section)}
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="stencil text-[10px] text-faint">
                          {String(count).padStart(2, "0")}
                        </span>
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => setNaming({ id: section.id, value: bandName(section) })}
                              aria-label={`Rename ${bandName(section)}`}
                              className="text-rule transition-colors hover:text-line"
                            >
                              <Icon name="pencil" size={13} />
                            </button>
                            <button
                              aria-label={`Delete ${bandName(section)}`}
                              onClick={() =>
                                confirm({
                                  title: "Delete band",
                                  verb: "Delete band",
                                  body: (
                                    <>
                                      <strong className="text-line">{bandName(section)}</strong>{" "}
                                      and the {count} sheet{count === 1 ? "" : "s"} in it will
                                      be deleted. If the database still has the original
                                      RESTRICT constraint, a band holding sheets will refuse.
                                    </>
                                  ),
                                  run: async () => {
                                    setError("");
                                    try {
                                      await api.deleteSection(section.id);
                                      loadBoard();
                                    } catch (caught) {
                                      setError(message(caught));
                                    }
                                  },
                                })
                              }
                              className="text-rule transition-colors hover:text-redink"
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 pen-b-2 border-line pb-1">
                      <LoadRule count={count} />
                    </div>
                    {refusal?.section === section.id ? (
                      <Notice className="mt-2 text-[12px]">{refusal.text}</Notice>
                    ) : null}
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
                    {list.length === 0 ? (
                      <p className="py-6 text-center text-[12px] text-rule">
                        {needle ? "No match in this band" : "Empty"}
                      </p>
                    ) : (
                      <ul className="flex list-none flex-col gap-3 p-0">
                        {list.map((issue) => (
                          <li key={issue.id}>
                            <Sheet
                              issue={issue}
                              clouded={unread.has(issue.id)}
                              draggable={isAdmin}
                              onDragStart={() => setDragging(issue)}
                              onDragEnd={() => {
                                setDragging(null);
                                setOver(null);
                              }}
                              onOpen={() => {
                                clear(issue.id);
                                setOpen(issue);
                              }}
                              onMove={isAdmin ? () => setMoving(issue) : undefined}
                            />
                          </li>
                        ))}
                      </ul>
                    )}

                    {isAdmin ? (
                      <button
                        onClick={() => setComposing(section.id)}
                        className="mt-3 flex w-full items-center justify-center gap-2 py-4 stencil pen-0 border-rule text-[10px] text-faint transition-colors [border-style:dashed] hover:border-line hover:text-line"
                      >
                        <Icon name="plus" size={13} />
                        New sheet
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}

            {isAdmin ? (
              <div className="w-[19.5rem] shrink-0 p-4">
                <button
                  onClick={() => setNaming({ value: "" })}
                  className="flex h-28 w-full items-center justify-center gap-2 stencil pen-0 border-rule text-[10px] text-faint transition-colors [border-style:dashed] hover:border-line hover:text-line"
                >
                  <Icon name="plus" size={13} />
                  New band
                </button>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {naming ? (
        <Dialog
          title={naming.id ? "Rename band" : "New band"}
          onClose={() => setNaming(null)}
          width="26rem"
        >
          <form onSubmit={saveSection} className="flex flex-col gap-6">
            <Input
              id="band-name"
              label="Band name"
              required
              value={naming.value}
              onChange={(e) => setNaming({ ...naming, value: e.target.value })}
              placeholder="For checking"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" tone="ghost" onClick={() => setNaming(null)}>
                Cancel
              </Button>
              <Button type="submit" tone="stamp" disabled={!naming.value.trim()}>
                {naming.id ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {composing !== null ? (
        <SheetView
          mode="new"
          sectionId={composing}
          members={members}
          isAdmin={isAdmin}
          onClose={() => setComposing(null)}
          onChanged={() => loadSection(composing)}
        />
      ) : null}

      {open ? (
        <SheetView
          mode="open"
          issue={open}
          sectionName={bandName(
            sections?.find((section) => section.id === open.sectionid) ?? ({} as Section),
          )}
          members={members}
          isAdmin={isAdmin}
          onClose={() => setOpen(null)}
          onChanged={() => loadSection(open.sectionid)}
          onDeleted={() => {
            setOpen(null);
            loadSection(open.sectionid);
          }}
        />
      ) : null}

      {moving ? (
        <Dialog title="Move sheet" caption={moving.title} onClose={() => setMoving(null)} width="24rem">
          <ul className="flex list-none flex-col gap-px bg-rule p-0 pen-0 border-rule">
            {(sections ?? []).map((section) => (
              <li key={section.id}>
                <button
                  disabled={section.id === moving.sectionid}
                  onClick={() => {
                    move(moving, section.id);
                    setMoving(null);
                  }}
                  className="stencil flex w-full items-center justify-between bg-field px-4 py-3 text-[10px] text-line transition-colors hover:bg-raise disabled:text-rule"
                >
                  {bandName(section)}
                  {section.id === moving.sectionid ? (
                    <span className="text-[9px] text-rule">current</span>
                  ) : (
                    <Icon name="right" size={13} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}

      {confirmNode}
    </div>
  );
}

function Sheet({
  issue,
  clouded,
  draggable,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
}: {
  issue: Issue;
  clouded: boolean;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onMove?: () => void;
}) {
  const [draining, setDraining] = useState(false);

  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(issue.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="relative bg-field pen-1 border-faint transition-colors hover:border-line"
      style={{ animation: "sheet-in 200ms var(--ease-draft) both" }}
    >
      {clouded || draining ? <RevisionCloud draining={draining} /> : null}

      <button
        onClick={() => {
          if (clouded) {
            setDraining(true);
            window.setTimeout(() => setDraining(false), 640);
          }
          onOpen();
        }}
        className="block w-full px-3.5 py-3 text-left"
      >
        <h3 className="stencil-wide text-[15px] leading-snug text-line">{issue.title}</h3>
        {issue.description ? (
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-faint">
            {issue.description}
          </p>
        ) : null}
      </button>

      <div className="flex items-center justify-between gap-2 pen-t-0 border-rule px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="stencil text-[9px] text-rule">Drawn</span>
          {issue.assignees.length === 0 ? (
            <span className="text-[11px] text-rule">unassigned</span>
          ) : (
            <div className="flex -space-x-1">
              {issue.assignees.slice(0, 4).map((person) => (
                <Stamp key={person.id} email={person.email} size={22} />
              ))}
              {issue.assignees.length > 4 ? (
                <span className="stencil grid h-[22px] w-[22px] place-items-center pen-0 border-rule text-[8px] text-faint">
                  +{issue.assignees.length - 4}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onMove ? (
            <button
              onClick={onMove}
              aria-label={`Move ${issue.title} to another band`}
              className="stencil px-1.5 py-0.5 text-[9px] text-rule transition-colors hover:text-line"
            >
              Move
            </button>
          ) : null}
          <span className="stencil text-[9px] text-faint">
            {String(issue.id).padStart(3, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
