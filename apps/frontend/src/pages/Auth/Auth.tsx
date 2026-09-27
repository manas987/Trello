import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, session } from "../../lib/api";
import { live } from "../../lib/ws";
import { Button, Input, Notice } from "../../ui";

function SheetPlate() {
  const zonesX = ["4", "3", "2", "1"];
  const zonesY = ["A", "B", "C", "D"];
  return (
    <svg
      viewBox="0 0 420 300"
      className="w-full max-w-[520px] text-rule"
      role="img"
      aria-label="A drawing sheet with a title block and one clouded revision."
    >
      <g fill="none" stroke="currentColor" strokeLinecap="square">
        <rect x="6" y="6" width="408" height="288" strokeWidth="1" />
        <rect x="22" y="22" width="376" height="256" strokeWidth="2" />
        {zonesX.map((z, i) => (
          <g key={z}>
            <path d={`M${22 + (i + 1) * 94} 6v16M${22 + (i + 1) * 94} 278v16`} strokeWidth="1" />
            <text
              x={22 + i * 94 + 47}
              y="18"
              fill="currentColor"
              stroke="none"
              fontSize="9"
              textAnchor="middle"
              className="stencil"
            >
              {z}
            </text>
          </g>
        ))}
        {zonesY.map((z, i) => (
          <g key={z}>
            <path d={`M6 ${22 + (i + 1) * 64}h16M398 ${22 + (i + 1) * 64}h16`} strokeWidth="1" />
            <text
              x="14"
              y={22 + i * 64 + 36}
              fill="currentColor"
              stroke="none"
              fontSize="9"
              textAnchor="middle"
              className="stencil"
            >
              {z}
            </text>
          </g>
        ))}

        <g strokeWidth="1.5" stroke="var(--color-faint)">
          <rect x="44" y="52" width="100" height="54" />
          <rect x="44" y="118" width="100" height="38" />
          <rect x="160" y="52" width="100" height="44" />
          <rect x="276" y="52" width="100" height="66" />
        </g>
        <g strokeWidth="1" stroke="var(--color-rule)">
          <path d="M44 88h100M44 142h100M160 82h100M276 104h100" />
        </g>

        <path
          d="M272 48 a7 7 0 0 1 14 0 a7 7 0 0 1 14 0 a7 7 0 0 1 14 0 a7 7 0 0 1 14 0 a7 7 0 0 1 14 0 a7 7 0 0 1 14 0 a7 7 0 0 1 14 0 a7 7 0 0 1 0 14 a7 7 0 0 1 0 14 a7 7 0 0 1 0 14 a7 7 0 0 1 0 14 a7 7 0 0 1 0 14 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 a7 7 0 0 1 -14 0 a7 7 0 0 1 0 -14 a7 7 0 0 1 0 -14 a7 7 0 0 1 0 -14 a7 7 0 0 1 0 -14 a7 7 0 0 1 0 -14 Z"
          stroke="var(--color-redline)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <g stroke="var(--color-redline)" strokeWidth="1.5">
          <path d="M386 40l10 17h-20z" />
        </g>
        <text
          x="386"
          y="54"
          fill="var(--color-redline)"
          stroke="none"
          fontSize="9"
          textAnchor="middle"
          className="stencil"
        >
          B
        </text>

        <g strokeWidth="1.5" stroke="var(--color-line)">
          <rect x="230" y="196" width="168" height="82" />
          <path d="M230 224h168M230 252h168M314 224v54M356 252v26" />
        </g>
      </g>
      <g fill="var(--color-faint)" fontSize="8" className="stencil">
        <text x="238" y="212">
          Blueline
        </text>
        <text x="238" y="240">
          Drawn
        </text>
        <text x="322" y="240">
          Checked
        </text>
        <text x="238" y="268">
          Sheet
        </text>
        <text x="322" y="268">
          Rev
        </text>
        <text x="364" y="268">
          Scale
        </text>
      </g>
    </svg>
  );
}

function humanError(error: unknown, mode: "in" | "up"): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again.";
  if (error.status === 0) return error.message + ". Start the backend and try again.";
  if (error.status === 409) return "That email already has an account. Switch to sign in.";
  if (error.status === 401) return "That email and password do not match an account.";
  if (error.status === 400)
    return mode === "up"
      ? "Use a valid email address and a password of at least 8 characters."
      : "Check the email address and password.";
  return error.message;
}

export function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const short = password.length > 0 && password.length < 8;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "up") await api.signup(email, password);
      const { token } = await api.signin(email, password);
      session.open(token, email);
      live.start();
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(humanError(caught, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden flex-col justify-between border-rule pen-r-0 p-12 lg:flex">
        <p className="stencil text-[10px] text-faint">Document control</p>
        <div className="flex flex-col items-start gap-10">
          <h1 className="stencil-wide text-[clamp(3rem,5vw,4.5rem)] leading-[0.92] text-line">
            Blueline
          </h1>
          <p className="max-w-[38ch] text-[17px] leading-relaxed text-faint">
            Every issue is a sheet. It carries a title block, it is stamped by whoever
            drew it and whoever checked it, and every change is clouded in red until
            someone reads it.
          </p>
          <SheetPlate />
        </div>
        <dl className="grid grid-cols-3 gap-px bg-rule pen-0 border-rule">
          {[
            ["Sheets", "issues"],
            ["Bands", "sections"],
            ["Revisions", "comments"],
          ].map(([term, meaning]) => (
            <div key={term} className="bg-field px-4 py-3">
              <dt className="stencil text-[10px] text-line">{term}</dt>
              <dd className="mt-1 text-[12px] text-faint">{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[26rem]">
          <h1 className="stencil-wide text-[2.4rem] leading-none text-line lg:hidden">Blueline</h1>

          <div
            role="tablist"
            aria-label="Sign in or create an account"
            className="mt-8 flex gap-6 pen-b-0 border-rule lg:mt-0"
          >
            {(
              [
                ["in", "Sign in"],
                ["up", "Create account"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={mode === value}
                onClick={() => {
                  setMode(value);
                  setError("");
                }}
                className={
                  "stencil -mb-px pb-3 text-[11px] transition-colors " +
                  (mode === value
                    ? "pen-b-2 border-line text-line"
                    : "border-transparent pen-b-2 text-faint hover:text-line")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-9 flex flex-col gap-6" noValidate>
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
            />

            <div>
              <div className="relative">
                <Input
                  id="password"
                  label="Password"
                  type={show ? "text" : "password"}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="password-note"
                  className="pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="stencil absolute right-0 top-0 h-full px-3 text-[10px] text-faint transition-colors hover:text-line"
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              <p
                id="password-note"
                className={
                  "mt-2 text-[12px] " + (short ? "text-redink" : "text-faint")
                }
              >
                {short
                  ? `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"} needed — the server requires 8.`
                  : "At least 8 characters."}
              </p>
            </div>

            {error ? <Notice>{error}</Notice> : null}

            <Button
              type="submit"
              tone="stamp"
              busy={busy}
              disabled={!email || password.length < 8}
              className="w-full py-3"
            >
              {busy ? "Working" : mode === "up" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-[12px] leading-relaxed text-faint">
            Sessions are kept in this browser only. There is no password reset yet, and
            signing out clears the token from local storage.
          </p>
        </div>
      </section>
    </div>
  );
}
