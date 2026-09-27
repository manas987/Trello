import { useState } from "react";

export function Dash() {
  const [orgs, setOrgs] = useState(true);

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="flex items-center justify-between border-b border-black px-9 py-5">
        <div className="flex gap-14">
          <button
            onClick={() => setOrgs(true)}
            className={`border-b text-2xl border-black pb-1 ${orgs ? "font-bold" : ""}`}>
            Your orgs
          </button>

          <button
            onClick={() => setOrgs(false)}
            className={`pb-1 text-2xl ${!orgs ? "border-b border-black font-bold" : ""}`}>
            Invites
          </button>
        </div>

        <div className="flex items-center gap-5">
          <input
            type="text"
            placeholder="Search"
            className="w-80 rounded border border-black px-3 py-2 outline-none"
          />

          <button className="h-12 w-12 overflow-hidden rounded-full border border-black">
            <img
              src="/profile.jpg"
              alt="Profile"
              className="h-full w-full object-cover"
            />
          </button>
        </div>
      </header>

      <main className="p-9">
        {orgs ? <div>orgs list</div> : <div>invites list</div>}
      </main>
    </div>
  );
}
