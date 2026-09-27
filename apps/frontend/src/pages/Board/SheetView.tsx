import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, session, type Comment, type Issue, type Member } from "../../lib/api";
import { message, useLoad } from "../../lib/use";
import { useLive } from "../../lib/ws";
import {
  Button,
  Dialog,
  Icon,
  Input,
  Notice,
  Plotting,
  Stamp,
  Textarea,
} from "../../ui";
import { useConfirm } from "../../lib/confirm";

const revLetter = (count: number) =>
  count === 0 ? "—" : count <= 26 ? String.fromCharCode(64 + count) : String(count);

function AssigneePicker({
  members,
  picked,
  onChange,
}: {
  members: Member[];
  picked: number[];
  onChange: (next: number[]) => void;
}) {
  return (
    <fieldset className="pen-0 border-rule p-3">
      <legend className="stencil px-1 text-[9px] text-faint">Drawn by</legend>
      {members.length === 0 ? (
        <p className="text-[12px] text-faint">No members loaded.</p>
      ) : (
        <ul className="flex max-h-44 list-none flex-col gap-px overflow-y-auto p-0">
          {members.map((member) => {
            const on = picked.includes(member.id);
            return (
              <li key={member.id}>
                <label className="flex cursor-pointer items-center gap-3 px-1 py-1.5 transition-colors hover:bg-raise">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      onChange(
                        on ? picked.filter((id) => id !== member.id) : [...picked, member.id],
                      )
                    }
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={
                      "grid h-4 w-4 shrink-0 place-items-center pen-0 " +
                      (on ? "border-stamp text-stamp" : "border-rule text-transparent")
                    }
                  >
                    <Icon name="check" size={10} />
                  </span>
                  <Stamp email={member.email} role={member.role} size={22} />
                  <span className="truncate text-[13px] text-line">{member.email}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

function Revisions({
  issueId,
  members,
  isAdmin,
  onCount,
}: {
  issueId: number;
  members: Member[];
  isAdmin: boolean;
  onCount: (n: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const { confirm, confirmNode } = useConfirm();
  const me = session.userId;

  const comments = useLoad(() => api.comments(issueId), [issueId]);
  useLive(["comment:updated"], (frame) => {
    if (Number(frame.issueId) === issueId) comments.reload();
  });

  const list = comments.data ?? [];
  const countRef = useRef(-1);
  useEffect(() => {
    if (comments.data && countRef.current !== list.length) {
      countRef.current = list.length;
      onCount(list.length);
    }
  }, [comments.data, list.length, onCount]);

  const author = (userid: number) =>
    members.find((member) => member.id === userid)?.email ??
    `User ${String(userid).padStart(3, "0")}`;

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createComment(issueId, draft.trim());
      setDraft("");
      comments.reload();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await api.updateComment(editing.id, editing.text.trim());
      setEditing(null);
      comments.reload();
    } catch (caught) {
      setError(message(caught));
    }
  }

  function remove(comment: Comment) {
    confirm({
      title: "Delete revision",
      verb: "Delete",
      body: "This revision will be removed from the sheet's history.",
      run: async () => {
        setError("");
        try {
          await api.deleteComment(comment.id);
          comments.reload();
        } catch (caught) {
          setError(message(caught));
        }
      },
    });
  }

  return (
    <div className="flex min-h-0 flex-col">
      <h3 className="stencil pen-b-0 border-rule pb-2 text-[10px] text-line">
        Revisions <span className="text-faint">{String(list.length).padStart(2, "0")}</span>
      </h3>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {comments.loading && !comments.data ? (
          <p className="flex items-center gap-3 stencil text-[10px] text-faint">
            <Plotting /> Reading
          </p>
        ) : comments.error ? (
          <Notice>{comments.error}</Notice>
        ) : list.length === 0 ? (
          <p className="py-4 text-[13px] leading-relaxed text-faint">
            No revisions yet. Anyone in the organisation can add one — comments are the
            only thing a member can write.
          </p>
        ) : (
          <ol className="flex list-none flex-col gap-px bg-rule p-0 pen-0 border-rule">
            {list.map((comment, index) => {
              const mine = comment.userid === me;
              return (
                <li key={comment.id} className="bg-field px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="stencil w-5 shrink-0 text-[10px] text-stamp">
                      {revLetter(index + 1)}
                    </span>
                    <Stamp email={author(comment.userid)} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-faint">
                      {author(comment.userid)}
                    </span>
                    {mine || isAdmin ? (
                      <span className="flex gap-1.5">
                        <button
                          onClick={() => setEditing({ id: comment.id, text: comment.comment })}
                          aria-label="Edit revision"
                          className="text-rule transition-colors hover:text-line"
                        >
                          <Icon name="pencil" size={12} />
                        </button>
                        <button
                          onClick={() => remove(comment)}
                          aria-label="Delete revision"
                          className="text-rule transition-colors hover:text-redink"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </span>
                    ) : null}
                  </div>

                  {editing?.id === comment.id ? (
                    <form onSubmit={saveEdit} className="mt-2 flex flex-col gap-2 pl-7">
                      <textarea
                        value={editing.text}
                        onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                        rows={3}
                        className="w-full resize-y bg-transparent p-2 pen-0 border-rule text-[13px] text-line outline-none focus:border-line"
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" tone="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button type="submit" tone="stamp" disabled={!editing.text.trim()}>
                          Save
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-1.5 whitespace-pre-wrap pl-7 text-[13.5px] leading-relaxed text-line">
                      {comment.comment}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {error ? <Notice className="mb-3">{error}</Notice> : null}

      <form onSubmit={add} className="flex flex-col gap-3 pen-t-0 border-rule pt-3">
        <label htmlFor="new-revision" className="sr-only">
          Add a revision
        </label>
        <textarea
          id="new-revision"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Mark up this sheet…"
          className="w-full resize-y bg-transparent p-3 pen-0 border-rule text-[13.5px] leading-relaxed text-line outline-none transition-colors focus:border-line placeholder:text-rule"
        />
        <Button type="submit" tone="stamp" busy={busy} disabled={!draft.trim()} className="self-end">
          Add revision
        </Button>
      </form>

      {confirmNode}
    </div>
  );
}

type Props = {
  members: Member[];
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
} & (
  | { mode: "new"; sectionId: number; issue?: never; sectionName?: never; onDeleted?: never }
  | {
      mode: "open";
      issue: Issue;
      sectionName: string;
      sectionId?: never;
      onDeleted: () => void;
    }
);

export function SheetView(props: Props) {
  const { members, isAdmin, onClose, onChanged } = props;
  const existing = props.mode === "open" ? props.issue : null;
  const onDeleted = props.mode === "open" ? props.onDeleted : onClose;

  const [editing, setEditing] = useState(props.mode === "new");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [assignees, setAssignees] = useState<number[]>(
    existing?.assignees.map((person) => person.id) ?? [],
  );
  const [revisions, setRevisions] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, confirmNode } = useConfirm();

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (props.mode === "new") {
        await api.createIssue(props.sectionId, title.trim(), description.trim(), assignees);
        onChanged();
        onClose();
      } else {
        await api.updateIssue(existing!.id, {
          name: title.trim(),
          description: description.trim(),
          assignees,
        });
        onChanged();
        setEditing(false);
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  const stampRow = existing?.assignees ?? [];

  return (
    <Dialog
      title={props.mode === "new" ? "New sheet" : existing!.title}
      caption={
        props.mode === "new"
          ? "It will be drafted into this band"
          : `${props.sectionName} · Sheet ${String(existing!.id).padStart(3, "0")} · Rev ${revLetter(revisions)}`
      }
      onClose={onClose}
      width="min(64rem, 100%)"
    >
      <div
        className={
          props.mode === "open"
            ? "grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start"
            : ""
        }
      >
        <div className="min-w-0">
          {editing ? (
            <form onSubmit={save} className="flex flex-col gap-5">
              <Input
                id="sheet-title"
                label="Drawing title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Rebuild the export queue"
              />
              <Textarea
                id="sheet-description"
                label="Description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What has to be true when this sheet is issued."
              />
              <AssigneePicker members={members} picked={assignees} onChange={setAssignees} />
              {error ? <Notice>{error}</Notice> : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  tone="ghost"
                  onClick={() => {
                    if (props.mode === "new") onClose();
                    else {
                      setEditing(false);
                      setTitle(existing!.title);
                      setDescription(existing!.description ?? "");
                      setAssignees(existing!.assignees.map((person) => person.id));
                      setError("");
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" tone="stamp" busy={busy} disabled={!title.trim()}>
                  {props.mode === "new" ? "Draft sheet" : "Save"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-line">
                {existing!.description || (
                  <span className="text-faint">No description on this sheet.</span>
                )}
              </p>

              <dl className="mt-7 grid grid-cols-2 gap-px bg-rule pen-0 border-rule sm:grid-cols-3">
                <div className="bg-field px-3 py-3">
                  <dt className="stencil text-[9px] text-faint">Sheet</dt>
                  <dd className="mt-1.5 text-[14px] text-line">
                    {String(existing!.id).padStart(3, "0")}
                  </dd>
                </div>
                <div className="bg-field px-3 py-3">
                  <dt className="stencil text-[9px] text-faint">Rev</dt>
                  <dd className="mt-1.5 text-[14px] text-line">{revLetter(revisions)}</dd>
                </div>
                <div className="col-span-2 bg-field px-3 py-3 sm:col-span-1">
                  <dt className="stencil text-[9px] text-faint">Band</dt>
                  <dd className="mt-1.5 truncate text-[14px] text-line">{props.sectionName}</dd>
                </div>
                <div className="col-span-2 bg-field px-3 py-3 sm:col-span-3">
                  <dt className="stencil text-[9px] text-faint">Drawn by</dt>
                  <dd className="mt-2 flex flex-wrap items-center gap-2">
                    {stampRow.length === 0 ? (
                      <span className="text-[13px] text-faint">Nobody yet.</span>
                    ) : (
                      stampRow.map((person) => (
                        <span key={person.id} className="flex items-center gap-2 pen-0 border-rule px-2 py-1">
                          <Stamp email={person.email} size={20} />
                          <span className="text-[12.5px] text-line">{person.email}</span>
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              </dl>

              {error ? <Notice className="mt-4">{error}</Notice> : null}

              {isAdmin ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button tone="line" onClick={() => setEditing(true)}>
                    <Icon name="pencil" size={13} />
                    Amend sheet
                  </Button>
                  <Button
                    tone="redline"
                    onClick={() =>
                      confirm({
                        title: "Delete sheet",
                        verb: "Delete sheet",
                        body: (
                          <>
                            <strong className="text-line">{existing!.title}</strong>, its
                            assignees and every revision on it will be deleted. This cannot
                            be undone.
                          </>
                        ),
                        run: async () => {
                          setError("");
                          try {
                            await api.deleteIssue(existing!.id);
                            onDeleted();
                          } catch (caught) {
                            setError(message(caught));
                          }
                        },
                      })
                    }
                  >
                    <Icon name="trash" size={13} />
                    Delete
                  </Button>
                </div>
              ) : (
                <p className="mt-6 stencil text-[9px] text-faint">
                  Members can add revisions. Amending the sheet is an admin action.
                </p>
              )}
            </>
          )}
        </div>

        {props.mode === "open" ? (
          <div className="min-w-0 lg:max-h-[68vh]">
            <Revisions
              issueId={existing!.id}
              members={members}
              isAdmin={isAdmin}
              onCount={setRevisions}
            />
          </div>
        ) : null}
      </div>

      {confirmNode}
    </Dialog>
  );
}
