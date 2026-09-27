import { useState, type ReactNode } from "react";
import { Button, Dialog } from "../ui";

export function useConfirm() {
  const [ask, setAsk] = useState<{
    title: string;
    body: ReactNode;
    verb: string;
    run: () => void;
  } | null>(null);

  const confirmNode = ask ? (
    <Dialog title={ask.title} onClose={() => setAsk(null)} width="28rem">
      <div className="text-[14px] leading-relaxed text-faint">{ask.body}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button tone="ghost" onClick={() => setAsk(null)}>
          Cancel
        </Button>
        <Button
          tone="redline"
          onClick={() => {
            ask.run();
            setAsk(null);
          }}
        >
          {ask.verb}
        </Button>
      </div>
    </Dialog>
  ) : null;

  return { confirm: setAsk, confirmNode };
}
