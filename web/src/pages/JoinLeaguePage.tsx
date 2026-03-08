import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import ErrorState from "../components/ErrorState";
import { useToast } from "../context/ToastContext";

interface PreviewResponse {
  league: {
    id: string;
    name: string;
    code: string;
    status: "ACTIVE" | "COMPLETED";
    isPublic: boolean;
    memberCount: number;
  };
}

export default function JoinLeaguePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [codeInput, setCodeInput] = useState("");
  const [preview, setPreview] = useState<PreviewResponse["league"] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalizedCode = useMemo(() => codeInput.trim().toUpperCase().slice(0, 6), [codeInput]);

  async function lookupPreview() {
    if (normalizedCode.length !== 6) {
      setError("Enter a 6-character code");
      return;
    }

    setError(null);
    setLoadingPreview(true);
    setPreview(null);

    try {
      const res = await apiClient.get<PreviewResponse>(`/api/leagues/preview?code=${encodeURIComponent(normalizedCode)}`);
      setPreview(res.data.league);
      showToast("League preview loaded", "success");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "League not found");
      showToast("Could not load league preview", "error");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function joinLeague(event: FormEvent) {
    event.preventDefault();
    if (!preview) {
      await lookupPreview();
      return;
    }

    setJoining(true);
    setError(null);

    try {
      await apiClient.post(`/api/leagues/${preview.id}/join`, { code: normalizedCode });
      showToast("Joined league", "success");
      navigate(`/league/${preview.id}`, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Could not join league");
      showToast("Could not join league", "error");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="page-shell space-y-4">
      <header>
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Join League</h1>
        <p className="font-dm mt-1 text-sm text-slate-400">Enter your 6-character invite code.</p>
      </header>

      <form onSubmit={joinLeague} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <input
          ref={inputRef}
          value={normalizedCode}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-outfit w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-center text-2xl tracking-[0.3em] text-slate-100 uppercase focus:outline-none focus:ring-2 focus:ring-[#22D3EE]"
          placeholder="ABC123"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={lookupPreview}
            disabled={loadingPreview}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 font-dm text-slate-200"
          >
            {loadingPreview ? "Checking..." : "Preview"}
          </button>
          <button disabled={joining} className="flex-1 rounded-xl bg-[#22D3EE] px-3 py-2 font-dm font-semibold text-slate-950">
            {joining ? "Joining..." : "Join"}
          </button>
        </div>

        {error && (
          <ErrorState
            message={error}
            onRetry={() => {
              void lookupPreview();
            }}
          />
        )}
      </form>

      {preview && (
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4">
          <p className="font-dm text-xs uppercase tracking-[0.14em] text-cyan-300">League Preview</p>
          <h2 className="font-outfit mt-1 text-2xl font-bold text-slate-100">{preview.name}</h2>
          <p className="font-dm mt-1 text-sm text-slate-400">{preview.memberCount} players · {preview.status}</p>
        </section>
      )}
    </main>
  );
}
