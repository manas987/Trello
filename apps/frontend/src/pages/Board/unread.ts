import { useCallback, useEffect, useState } from "react";
import { session } from "../../lib/api";

const key = () => `blueline:unread:${session.userId ?? "anon"}`;

function read(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key()) ?? "[]"));
  } catch {
    return new Set();
  }
}

function write(set: Set<number>) {
  try {
    localStorage.setItem(key(), JSON.stringify([...set]));
  } catch {
    return;
  }
}

export function useUnread() {
  const [unread, setUnread] = useState<Set<number>>(() => read());

  useEffect(() => {
    write(unread);
  }, [unread]);

  const mark = useCallback((issueId: number) => {
    setUnread((current) => {
      if (current.has(issueId)) return current;
      const next = new Set(current);
      next.add(issueId);
      return next;
    });
  }, []);

  const clear = useCallback((issueId: number) => {
    setUnread((current) => {
      if (!current.has(issueId)) return current;
      const next = new Set(current);
      next.delete(issueId);
      return next;
    });
  }, []);

  return { unread, mark, clear };
}
