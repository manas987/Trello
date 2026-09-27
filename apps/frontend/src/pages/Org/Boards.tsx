import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Board } from "../../lib/api";
import { message } from "../../lib/use";
import { Search, TopStrip } from "../../chrome";
import {
  Button,
  Dialog,
  EmptySheet,
  Icon,
  Input,
  Notice,
  Textarea,
} from "../../ui";
import { useConfirm } from "../../lib/confirm";
import { useOrg } from "./context";

function BoardSheet({ board, orgId }: { board: Board; orgId: number }) {
  return (
    <Link
      to={`/org/${orgId}/board/${board.id}`}
      className="group flex min-h-[8.5rem] flex-col justify-between bg-field pen-1 border-faint p-4 no-underline transition-all duration-150 hover:border-line hover:bg-raise"
    >
      <h3 className="stencil-wide text-[1.1rem] leading-tight text-line">{board.title}</h3>
      <div className="flex items-end justify-between pen-t-0 border-rule pt-2">
        <span className="stencil text-[9px] text-faint">
          Sheet set <span className="text-line">{String(board.id).padStart(3, "0")}</span>
        </span>
        <Icon name="right" size={14} className="text-faint transition-colors group-hover:text-line" />
      </div>
    </Link>
  );
}

export function Boards() {
  const { org, isAdmin, boards, reloadBoards } = useOrg();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [naming, setNaming] = useState<null | { id?: number; value: string }>(null);
  const [record, setRecord] = useState(false);
  const { confirm, confirmNode } = useConfirm();
  const navigate = useNavigate();

  const needle = query.trim().toLowerCase();
  const shown = boards.filter((b) => !needle || b.title.toLowerCase().includes(needle));

  async function saveBoard(event: FormEvent) {
    event.preventDefault();
    if (!naming) return;
    setError("");
    try {
      if (naming.id) await api.updateBoard(naming.id, naming.value.trim());
      else await api.createBoard(org.id, naming.value.trim());
      setNaming(null);
      reloadBoards();
    } catch (caught) {
      setError(message(caught));
    }
  }

  function removeBoard(board: Board) {
    confirm({
      title: "Delete board",
      verb: "Delete board",
      body: (
        <>
          <strong className="text-line">{board.title}</strong> and every section, issue
          and comment on it will be deleted. This cannot be undone.
        </>
      ),
      run: async () => {
        setError("");
        try {
          await api.deleteBoard(board.id);
          reloadBoards();
        } catch (caught) {
          setError(message(caught));
        }
      },
    });
  }

  return (
    <div className="min-h-screen">
      <TopStrip over={`Organisation ${String(org.id).padStart(3, "0")}`} title={org.name}>
        <Search value={query} onChange={setQuery} placeholder="Filter boards" />
      </TopStrip>

      <main className="px-5 py-8 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4 pen-b-0 border-rule pb-3">
          <h2 className="stencil text-[11px] text-line">
            Boards <span className="text-faint">{String(boards.length).padStart(2, "0")}</span>
          </h2>
          {isAdmin ? (
            <div className="flex gap-2">
              <Button tone="ghost" onClick={() => setRecord(true)}>
                <Icon name="pencil" size={13} />
                Organisation record
              </Button>
              <Button tone="stamp" onClick={() => setNaming({ value: "" })}>
                <Icon name="plus" size={13} />
                New board
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <Notice className="mt-4">{error}</Notice> : null}

        {shown.length === 0 ? (
          <div className="mt-6">
            <EmptySheet
              title={needle ? "No board matches that filter" : "No boards on this set"}
              action={
                isAdmin && !needle ? (
                  <Button tone="stamp" onClick={() => setNaming({ value: "" })}>
                    <Icon name="plus" size={13} />
                    New board
                  </Button>
                ) : undefined
              }
            >
              {needle
                ? "Filtering happens here in the browser; the API has no search endpoint."
                : isAdmin
                  ? "A board holds the bands work moves through. Make the first one."
                  : "Only an admin can create boards. Ask one to open the first board."}
            </EmptySheet>
          </div>
        ) : (
          <ul className="mt-6 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 p-0">
            {shown.map((board) => (
              <li key={board.id} className="relative">
                <BoardSheet board={board} orgId={org.id} />
                {isAdmin ? (
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      onClick={() => setNaming({ id: board.id, value: board.title })}
                      aria-label={`Rename ${board.title}`}
                      className="bg-field p-1.5 pen-0 border-rule text-faint transition-colors hover:border-line hover:text-line"
                    >
                      <Icon name="pencil" size={13} />
                    </button>
                    <button
                      onClick={() => removeBoard(board)}
                      aria-label={`Delete ${board.title}`}
                      className="bg-field p-1.5 pen-0 border-rule text-faint transition-colors hover:border-redline hover:text-redink"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>

      {naming ? (
        <Dialog
          title={naming.id ? "Rename board" : "New board"}
          onClose={() => setNaming(null)}
          width="28rem"
        >
          <form onSubmit={saveBoard} className="flex flex-col gap-6">
            <Input
              id="board-name"
              label="Board name"
              required
              value={naming.value}
              onChange={(e) => setNaming({ ...naming, value: e.target.value })}
              placeholder="Platform"
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

      {record ? (
        <OrgRecord
          onClose={() => setRecord(false)}
          onDeleted={() => navigate("/dashboard", { replace: true })}
        />
      ) : null}

      {confirmNode}
    </div>
  );
}

function OrgRecord({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const { org } = useOrg();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, confirmNode } = useConfirm();

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.updateOrg(org.id, { name: name.trim(), description });
      onClose();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog title="Organisation record" caption={org.name} onClose={onClose}>
        <form onSubmit={save} className="flex flex-col gap-6">
          <Input
            id="record-name"
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            id="record-description"
            label="Description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              tone="redline"
              onClick={() =>
                confirm({
                  title: "Delete organisation",
                  verb: "Delete everything",
                  body: (
                    <>
                      Deleting <strong className="text-line">{org.name}</strong> removes
                      every board, section, issue and comment in it, and every
                      membership. This cannot be undone.
                    </>
                  ),
                  run: async () => {
                    try {
                      await api.deleteOrg(org.id);
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
            <div className="flex gap-2">
              <Button type="button" tone="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" tone="stamp" busy={busy} disabled={!name.trim()}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
      {confirmNode}
    </>
  );
}
