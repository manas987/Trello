import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
} as const;

const paths: Record<string, ReactNode> = {
  plus: <path d="M8 2.5v11M2.5 8h11" />,
  close: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.2 10.2l3.3 3.3" />
    </>
  ),
  right: <path d="M6 3l5 5-5 5" />,
  down: <path d="M3 6l5 5 5-5" />,
  left: <path d="M10 3L5 8l5 5" />,
  check: <path d="M3 8.5l3.5 3.5L13 4.5" />,
  trash: (
    <>
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
      <path d="M6.6 6.5v5M9.4 6.5v5" />
    </>
  ),
  pencil: (
    <>
      <path d="M11 2.5l2.5 2.5-8 8L2.5 14l1-3z" />
      <path d="M9.5 4l2.5 2.5" />
    </>
  ),
  out: <path d="M9.5 2.5h4v4M13.5 2.5L7 9M11 9.5v4h-9v-9h4" />,
  sheet: (
    <>
      <path d="M2.5 1.5h11v13h-11z" />
      <path d="M2.5 10.5h11M9 10.5v4" />
    </>
  ),
  people: (
    <>
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
      <path d="M11 3.2a2.5 2.5 0 010 3.6M12.5 10.6c1.3.6 2 1.8 2 3.4" />
    </>
  ),
  envelope: (
    <>
      <path d="M1.5 3.5h13v9h-13z" />
      <path d="M1.5 4l6.5 5 6.5-5" />
    </>
  ),
  cloud: <path d="M4 10a2.5 2.5 0 011-4.8A3.2 3.2 0 0111 5a2.5 2.5 0 01.5 5z" />,
};

export function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: keyof typeof paths | string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      className={"shrink-0 " + className}
      {...stroke}
    >
      {paths[name]}
    </svg>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "line" | "stamp" | "redline" | "ghost";
  busy?: boolean;
};

export function Button({
  tone = "line",
  busy,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const tones = {
    line: "pen-1 border-line text-line hover:bg-line hover:text-field",
    stamp: "pen-2 border-stamp text-stamp hover:bg-stamp hover:text-sink",
    redline: "pen-1 border-redline text-redink hover:bg-redline hover:text-sink",
    ghost: "pen-0 border-rule text-faint hover:border-line hover:text-line",
  };
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={
        "relative inline-flex items-center justify-center gap-2 px-3 py-1.5 " +
        "stencil text-[11px] leading-none transition-all duration-150 " +
        "active:translate-y-[1.5px] " +
        "disabled:border-rule disabled:bg-transparent disabled:text-rule " +
        "disabled:pointer-events-none disabled:[border-width:1px] " +
        tones[tone] +
        " " +
        className
      }
    >
      {busy ? <Plotting /> : null}
      {children}
    </button>
  );
}

export function Plotting({ width = 22 }: { width?: number }) {
  return (
    <svg width={width} height={6} viewBox="0 0 22 6" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="3"
        x2="21"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeLinecap="square"
      >
        <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.6s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}

export function Box({
  label,
  children,
  className = "",
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={"relative pen-0 border-rule " + className}>
      <label
        htmlFor={htmlFor}
        className="stencil absolute -top-[7px] left-2 bg-field px-1 text-[9px] text-faint"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input({
  label,
  id,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <Box label={label} htmlFor={id} className={className}>
      <input
        id={id}
        {...rest}
        className="w-full bg-transparent px-3 pt-3 pb-2 text-[15px] text-line outline-none placeholder:text-rule"
      />
    </Box>
  );
}

export function Textarea({
  label,
  id,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) {
  return (
    <Box label={label} htmlFor={id} className={className}>
      <textarea
        id={id}
        {...rest}
        className="w-full resize-y bg-transparent px-3 pt-3 pb-2 text-[15px] leading-relaxed text-line outline-none placeholder:text-rule"
      />
    </Box>
  );
}

export function Stamp({
  email,
  role,
  size = 26,
  title,
}: {
  email: string;
  role?: "admin" | "member";
  size?: number;
  title?: string;
}) {
  const initials = email.slice(0, 2).toUpperCase();
  const admin = role === "admin";
  return (
    <span
      title={title ?? email + (role ? ` · ${role}` : "")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={
        "stencil inline-grid shrink-0 place-items-center leading-none tracking-[0.04em] " +
        (admin ? "pen-1 border-stamp text-stamp" : "pen-0 border-faint text-faint")
      }
    >
      {initials}
    </span>
  );
}

function cloudPath(w: number, h: number) {
  const bump = 13;
  const nx = Math.max(3, Math.round(w / bump));
  const ny = Math.max(2, Math.round(h / bump));
  const lx = w / nx;
  const ly = h / ny;
  const rx = lx * 0.62;
  const ry = ly * 0.62;
  const d: string[] = ["M 0 0"];
  for (let i = 1; i <= nx; i++) d.push(`A ${rx} ${rx} 0 0 1 ${(lx * i).toFixed(1)} 0`);
  for (let i = 1; i <= ny; i++) d.push(`A ${ry} ${ry} 0 0 1 ${w.toFixed(1)} ${(ly * i).toFixed(1)}`);
  for (let i = 1; i <= nx; i++)
    d.push(`A ${rx} ${rx} 0 0 1 ${(w - lx * i).toFixed(1)} ${h.toFixed(1)}`);
  for (let i = 1; i <= ny; i++) d.push(`A ${ry} ${ry} 0 0 1 0 ${(h - ly * i).toFixed(1)}`);
  return d.join(" ") + " Z";
}

export function RevisionCloud({ draining = false }: { draining?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = host.current?.parentElement;
    if (!node) return;
    const measure = () => setSize({ w: node.offsetWidth, h: node.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!size.w || !size.h) return <div ref={host} />;
  const inset = 5;
  const w = size.w + inset * 2;
  const h = size.h + inset * 2;

  return (
    <div ref={host} aria-hidden="true" className="pointer-events-none absolute inset-0">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute"
        style={{ left: -inset, top: -inset }}
      >
        <path
          d={cloudPath(w - 2, h - 2)}
          transform="translate(1,1)"
          fill="none"
          stroke="var(--color-redline)"
          strokeWidth="1.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={draining ? 1 : 0}
          style={{ transition: "stroke-dashoffset 620ms var(--ease-draft)" }}
        />
      </svg>
    </div>
  );
}

export function Notice({
  kind = "error",
  children,
  className = "",
}: {
  kind?: "error" | "note";
  children: ReactNode;
  className?: string;
}) {
  const red = kind === "error";
  return (
    <p
      role={red ? "alert" : "status"}
      className={
        "flex items-start gap-2 py-1.5 text-[13px] leading-snug " +
        (red ? "text-redink" : "text-faint") +
        " " +
        className
      }
    >
      <svg
        viewBox="0 0 12 12"
        width="12"
        height="12"
        aria-hidden="true"
        className="mt-[3px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        {red ? <path d="M6 1.5l4.5 8h-9z" /> : <path d="M1.5 6h9M6 1.5v9" />}
      </svg>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function EmptySheet({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pen-0 border-rule px-6 py-8 text-center [border-style:dashed]">
      <p className="stencil-wide text-[15px] text-faint">{title}</p>
      {children ? (
        <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-faint">{children}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Dialog({
  title,
  caption,
  onClose,
  children,
  width = "34rem",
}: {
  title: string;
  caption?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const held = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input,textarea,button")?.focus();
    return () => held?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-sink/80 p-4 sm:p-8">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width, maxWidth: "100%", animation: "sheet-in 220ms var(--ease-draft) both" }}
        className="relative my-auto bg-field pen-2 border-line"
      >
        <header className="flex items-start justify-between gap-4 pen-b-0 border-rule px-5 py-4">
          <div>
            <h2 className="stencil-wide text-[19px] leading-tight text-line">{title}</h2>
            {caption ? <p className="stencil mt-1 text-[10px] text-faint">{caption}</p> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 p-2 text-faint transition-colors hover:text-line"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
