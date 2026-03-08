import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};

    if (!displayName.trim()) nextErrors.displayName = "Display name is required";
    if (!email.trim()) nextErrors.email = "Email is required";
    if (password.length < 8) nextErrors.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      await register(email.trim(), displayName.trim(), password);
      navigate("/", { replace: true });
    } catch (error) {
      const message = (error as ApiError)?.response?.data?.error ?? "Failed to create account";
      setErrors({ form: message });
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0E17] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-slate-700/80 rounded-2xl bg-slate-900/60 p-8 shadow-2xl">
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-white">Create Account</h1>
        <p className="font-dm mt-2 text-slate-400">Start your LMS season</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="font-dm block text-sm text-slate-300 mb-1">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="font-dm w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]"
              placeholder="Your name"
            />
            {errors.displayName && <p className="font-dm mt-1 text-sm text-red-400">{errors.displayName}</p>}
          </div>

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
              placeholder="At least 8 characters"
            />
            {errors.password && <p className="font-dm mt-1 text-sm text-red-400">{errors.password}</p>}
          </div>

          <div>
            <label className="font-dm block text-sm text-slate-300 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="font-dm w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]"
              placeholder="Repeat password"
            />
            {errors.confirmPassword && <p className="font-dm mt-1 text-sm text-red-400">{errors.confirmPassword}</p>}
          </div>

          {errors.form && <p className="font-dm text-sm text-red-400">{errors.form}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="font-dm w-full rounded-lg bg-[#22D3EE] text-slate-950 font-semibold py-2.5 transition hover:bg-cyan-300 disabled:opacity-70"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="font-dm mt-6 text-sm text-slate-400">
          Already registered?{" "}
          <Link to="/login" className="text-[#22D3EE] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
