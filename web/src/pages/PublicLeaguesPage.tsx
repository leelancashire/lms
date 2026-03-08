import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Skeleton from "../components/Skeleton";
import { useToast } from "../context/ToastContext";

interface PublicLeague {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "COMPLETED";
  memberCount: number;
}

export default function PublicLeaguesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<PublicLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ leagues: PublicLeague[] }>("/api/leagues/public");
      setLeagues(res.data.leagues);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load public leagues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function joinLeague(league: PublicLeague) {
    setJoiningId(league.id);
    try {
      await apiClient.post(`/api/leagues/${league.id}/join`, { code: league.code });
      showToast(`Joined ${league.name}`, "success");
      navigate(`/league/${league.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? "Could not join league", "error");
    } finally {
      setJoiningId(null);
    }
  }

  if (loading) {
    return (
      <main className="page-shell space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <ErrorState message={error} onRetry={() => void load()} />
      </main>
    );
  }

  return (
    <main className="page-shell space-y-4">
      <header>
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Public Leagues</h1>
        <p className="font-dm mt-1 text-sm text-slate-400">Browse open leagues and join instantly.</p>
      </header>

      {leagues.length === 0 ? (
        <EmptyState title="No public leagues right now" description="Check back later or create your own league." />
      ) : (
        <div className="space-y-2">
          {leagues.map((league) => (
            <div key={league.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-dm text-sm font-semibold text-slate-100">{league.name}</p>
                  <p className="font-dm text-xs text-slate-500">{league.memberCount} members</p>
                </div>
                <button
                  onClick={() => void joinLeague(league)}
                  disabled={joiningId === league.id}
                  className="rounded-lg bg-[#22D3EE] px-3 py-1.5 font-dm text-xs font-semibold text-slate-950"
                >
                  {joiningId === league.id ? "Joining..." : "Join"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
