import { useEffect, useSyncExternalStore } from "react";
import { wsUrl, session } from "./api";

type Frame = { event: string; [k: string]: unknown };
type Handler = (frame: Frame) => void;

export type LineState = "down" | "joining" | "live" | "refused";

const handlers = new Set<Handler>();
const lineWatchers = new Set<() => void>();

let socket: WebSocket | null = null;
let wantOrg: number | null = null;
let wantBoard: number | null = null;
let retry = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let line: LineState = "down";

function setLine(next: LineState) {
  if (line === next) return;
  line = next;
  lineWatchers.forEach((notify) => notify());
}

function send(msg: object) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function joinWanted() {
  if (wantOrg !== null) send({ type: "join:Org", orgId: wantOrg });
  if (wantBoard !== null) send({ type: "join:Board", boardId: wantBoard });
}

function connect() {
  if (socket || !session.token) return;
  setLine("joining");
  const ws = new WebSocket(wsUrl());
  socket = ws;

  ws.onopen = () => {
    retry = 0;
    setLine("live");
    joinWanted();
  };

  ws.onmessage = (event) => {
    let frame: Frame;
    try {
      frame = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!frame.event) return;
    handlers.forEach((h) => h(frame));
  };

  ws.onclose = (event) => {
    socket = null;
    if (event.code === 1008) {
      setLine("refused");
      return;
    }
    setLine("down");
    if (!session.token) return;
    const wait = Math.min(1000 * 2 ** retry++, 15000);
    timer = setTimeout(connect, wait);
  };
}

export const live = {
  start() {
    if (timer) clearTimeout(timer);
    retry = 0;
    connect();
  },
  stop() {
    if (timer) clearTimeout(timer);
    wantOrg = wantBoard = null;
    const open = socket;
    socket = null;
    open?.close();
    setLine("down");
  },
  joinOrg(orgId: number | null) {
    if (wantOrg === orgId) return;
    if (wantOrg !== null) send({ type: "leave:Org", orgId: wantOrg });
    wantOrg = orgId;
    if (orgId !== null) send({ type: "join:Org", orgId });
  },
  joinBoard(boardId: number | null) {
    if (wantBoard === boardId) return;
    if (wantBoard !== null) send({ type: "leave:Board", boardId: wantBoard });
    wantBoard = boardId;
    if (boardId !== null) send({ type: "join:Board", boardId });
  },
};

export function useLive(events: string[], onFrame: (frame: Frame) => void) {
  const key = events.join(",");
  useEffect(() => {
    const set = new Set(key.split(","));
    const handler = (frame: Frame) => {
      if (set.has(frame.event)) onFrame(frame);
    };
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  });
  void key;
}

export function useLineState(): LineState {
  return useSyncExternalStore(
    (notify) => {
      lineWatchers.add(notify);
      return () => {
        lineWatchers.delete(notify);
      };
    },
    () => line,
  );
}
