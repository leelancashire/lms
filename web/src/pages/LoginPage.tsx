import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) nextErrors.email = "Email is required";
    if (!password) nextErrors.password = "Password is required";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (error) {
      const message = (error as ApiError)?.response?.data?.error ?? "Failed to sign in";
      setErrors({ form: message });
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0E17] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-slate-700/80 rounded-2xl bg-slate-900/60 p-8 shadow-2xl">
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-white">Sign In</h1>
        <p className="font-dm mt-2 text-slate-400">Welcome back to Last Man Standing</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="font-dm block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-dm w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]"
              placeholder="you@example.com"
            />
            {errors.email && <p className="font-dm mt-1 text-sm text-red-400">{errors.email}</p>}
          </div>

          <div>
            <label className="font-dm block text-sm text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-dm w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]"
              placeholder="••••••••"
            />
            {errors.password && <p className="font-dm mt-1 text-sm text-red-400">{errors.password}</p>}
          </div>

          {errors.form && <p className="font-dm text-sm text-red-400">{errors.form}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="font-dm w-full rounded-lg bg-[#22D3EE] text-slate-950 font-semibold py-2.5 transition hover:bg-cyan-300 disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="font-dm mt-6 text-sm text-slate-400">
          Need an account?{" "}
          <Link to="/register" className="text-[#22D3EE] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
