import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useToast } from "../context/ToastContext";

interface CreateLeagueResponse {
  league: {
    id: string;
    name: string;
    code: string;
    isPublic: boolean;
  };
}

export default function CreateLeaguePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [competition] = useState("PL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateLeagueResponse["league"] | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("League name is required");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.post<CreateLeagueResponse>("/api/leagues", {
        name: name.trim(),
        isPublic,
      });
      setCreated(res.data.league);
      showToast("League created", "success");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to create league");
      showToast("Failed to create league", "error");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!created?.code) return;
    try {
      await navigator.clipboard.writeText(created.code);
      showToast("Invite code copied", "success");
    } catch {
      showToast("Could not copy code", "error");
    }
  }

  return (
    <main className="page-shell space-y-4">
      <header>
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Create League</h1>
        <p className="font-dm mt-1 text-sm text-slate-400">Set up a private or public competition.</p>
      </header>

      {!created ? (
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <div>
            <label className="font-dm mb-1 block text-sm text-slate-300">League name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-dm w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]"
              placeholder="Sunday Survivors"
            />
          </div>

          <div>
            <label className="font-dm mb-1 block text-sm text-slate-300">Competition</label>
            <select
              value={competition}
              disabled
              className="font-dm w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200"
            >
              <option value="PL">Premier League</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/40 p-3">
            <div>
              <p className="font-dm text-sm font-semibold text-slate-100">Public League</p>
              <p className="font-dm text-xs text-slate-500">Visible in browse lists</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className={`h-7 w-12 rounded-full p-1 transition ${isPublic ? "bg-cyan-400" : "bg-slate-700"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition ${isPublic ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {error && <p className="font-dm text-sm text-red-400">{error}</p>}

          <button disabled={loading} className="w-full rounded-xl bg-[#22D3EE] px-4 py-2.5 font-dm font-semibold text-slate-950">
            {loading ? "Creating..." : "Create League"}
          </button>
        </form>
      ) : (
        <section className="space-y-4 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4">
          <p className="font-dm text-xs uppercase tracking-[0.14em] text-cyan-300">League Created</p>
          <h2 className="font-outfit text-2xl font-extrabold text-slate-100">{created.name}</h2>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-center">
            <p className="font-dm text-xs uppercase tracking-[0.14em] text-slate-500">Invite Code</p>
            <p className="font-outfit mt-1 text-4xl font-extrabold tracking-[0.18em] text-[#22D3EE]">{created.code}</p>
            <button onClick={copyCode} className="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 font-dm text-sm text-cyan-300">
              Copy code
            </button>
          </div>

          <button onClick={() => navigate(`/league/${created.id}`)} className="w-full rounded-xl bg-[#22D3EE] px-4 py-2.5 font-dm font-semibold text-slate-950">
            Go to League
          </button>
        </section>
      )}
    </main>
  );
}
