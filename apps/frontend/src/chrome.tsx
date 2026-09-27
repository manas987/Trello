import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { session } from "./lib/api";
import { live, useLineState } from "./lib/ws";
import { Icon, Stamp } from "./ui";

export function LineLamp() {
  const state = useLineState();
  const copy = {
    live: "Line live",
    joining: "Joining",
    down: "Reconnecting",
    refused: "Token refused",
  }[state];

  return (
    <span className="flex items-center gap-2" title={`Websocket: ${copy}`}>
      <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true" className="text-faint">
        <line
          x1="1"
          y1="5"
          x2="21"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeDasharray={state === "live" ? undefined : "3 3"}
        />
        {state === "refused" ? (
          <line x1="4" y1="9" x2="18" y2="1" stroke="currentColor" strokeWidth="1.5" />
        ) : null}
      </svg>
      <span className="stencil text-[9px] text-faint">{copy}</span>
    </span>
  );
}

export function Account() {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={host} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${session.email}`}
        className="block transition-transform active:translate-y-[1.5px]"
      >
        <Stamp email={session.email} size={32} title={session.email} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-40 w-64 bg-field pen-1 border-line"
          style={{ animation: "sheet-in 160ms var(--ease-draft) both" }}
        >
          <p className="pen-b-0 border-rule px-4 py-3">
            <span className="stencil block text-[9px] text-faint">Signed in</span>
            <span className="mt-1 block truncate text-[13px] text-line">{session.email}</span>
          </p>
          <Link
            to="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="stencil flex items-center gap-2 px-4 py-3 text-[10px] text-faint transition-colors hover:bg-raise hover:text-line"
          >
            <Icon name="sheet" size={14} />
            All organisations
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              live.stop();
              session.close();
              navigate("/login", { replace: true });
            }}
            className="stencil flex w-full items-center gap-2 pen-t-0 border-rule px-4 py-3 text-[10px] text-faint transition-colors hover:bg-raise hover:text-line"
          >
            <Icon name="out" size={14} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TopStrip({
  over,
  title,
  to,
  children,
}: {
  over?: ReactNode;
  title: string;
  to?: string;
  children?: ReactNode;
}) {
  const heading = (
    <h1 className="stencil-wide truncate text-[clamp(1.35rem,2.4vw,1.9rem)] leading-none text-line">
      {title}
    </h1>
  );

  return (
    <header className="sticky top-0 z-30 bg-field/95 pen-b-2 border-line backdrop-blur-[2px]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-7">
        <div className="min-w-0 flex-1">
          {over ? <div className="stencil mb-1 text-[9px] text-faint">{over}</div> : null}
          {to ? (
            <Link to={to} className="block no-underline hover:underline">
              {heading}
            </Link>
          ) : (
            heading
          )}
        </div>
        {children}
        <div className="flex items-center gap-4">
          <span className="hidden sm:block">
            <LineLamp />
          </span>
          <Account />
        </div>
      </div>
    </header>
  );
}

export function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[12rem] flex-1 sm:max-w-[22rem]">
      <Icon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent pen-0 border-rule py-2 pl-9 pr-3 text-[14px] text-line outline-none transition-colors focus:border-line"
      />
    </div>
  );
}
