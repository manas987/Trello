import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function Auth() {
  const [login, setlogin] = useState(true);
  const [email, setemail] = useState("");
  const [password, setpassword] = useState("");
  const [error, seterror] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  async function signin(email: string, password: string) {
    seterror("");

    const response = await fetch("http://localhost:3000/auth/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      seterror("Login failed");
      return;
    }

    const data = await response.json();

    localStorage.setItem("token", data);

    navigate("/dashboard");
  }

  async function signup(email: string, password: string) {
    seterror("");

    const response = await fetch("http://localhost:3000/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      seterror("Signup failed");
      return;
    }

    await signin(email, password);
  }

  function switchToSignup() {
    seterror("");
    setlogin(false);
  }

  function switchToSignin() {
    seterror("");
    setlogin(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {login ? "Sign in" : "Create account"}
          </h1>

          <p className="text-sm text-gray-500">
            {login
              ? "Sign in to your account"
              : "Sign up to create a new account"}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setemail(e.target.value);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2.5 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setpassword(e.target.value);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-12 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
            {error}
          </p>
        )}

        {login ? (
          <button
            className="rounded-lg bg-black px-4 py-2.5 font-medium text-white transition hover:bg-gray-800 active:scale-[0.98]"
            onClick={() => signin(email, password)}>
            Sign in
          </button>
        ) : (
          <button
            className="rounded-lg bg-black px-4 py-2.5 font-medium text-white transition hover:bg-gray-800 active:scale-[0.98]"
            onClick={() => signup(email, password)}>
            Sign up
          </button>
        )}

        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
          {login ? (
            <div className="flex flex-col items-center">
              <p>New user?</p>
              <button
                className="font-medium text-black hover:underline"
                onClick={switchToSignup}>
                Sign up
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <p>Already have an account?</p>
              <button
                className="font-medium text-black hover:underline"
                onClick={switchToSignin}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
