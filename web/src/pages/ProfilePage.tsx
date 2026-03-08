import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";

interface LeagueListItem {
  id: string;
  name: string;
  memberCount: number;
  aliveCount: number;
  myStatus: "ALIVE" | "ELIMINATED" | "WINNER";
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [pushGoalAlerts, setPushGoalAlerts] = useState(true);
  const [pushDeadlineAlerts, setPushDeadlineAlerts] = useState(true);

  const reload = useCallback(() => {
    setReloadTick((v) => v + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await apiClient.get<{ leagues: LeagueListItem[] }>("/api/leagues");
        if (!active) return;
        setError(null);
        setLeagues(res.data.leagues);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.error ?? "Failed to load leagues");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const initial = useMemo(() => user?.displayName?.slice(0, 1).toUpperCase() ?? "?", [user?.displayName]);

  function handleSignOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="page-shell space-y-4">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-2xl font-outfit font-bold text-slate-100">
            {initial}
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-extrabold text-slate-100">{user?.displayName ?? "User"}</h1>
            <p className="font-dm text-sm text-slate-400">{user?.email ?? ""}</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-dm text-xs uppercase tracking-[0.16em] text-slate-500">My Leagues</h2>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && leagues.length === 0 && (
          <EmptyState title="No leagues yet" description="Create a league or join one with a code." ctaLabel="Join League" onCta={() => navigate("/join")} />
        )}
        <div className="space-y-2">
          {!error &&
            leagues.map((league) => (
            <div key={league.id} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-dm text-sm font-semibold text-slate-100">{league.name}</p>
                  <p className="font-dm text-xs text-slate-500">{league.aliveCount}/{league.memberCount} alive</p>
                </div>
                <span
                  className={`font-dm rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                    league.myStatus === "ALIVE" || league.myStatus === "WINNER"
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                      : "border-red-500/40 bg-red-500/20 text-red-300"
                  }`}
                >
                  {league.myStatus === "ALIVE" || league.myStatus === "WINNER" ? "IN" : "OUT"}
                </span>
              </div>
            </div>
            ))}
        </div>
      </section>

      <section className="space-y-2.5 pt-1">
        <button onClick={() => navigate("/create-league")} className="w-full rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2.5 font-dm font-semibold text-cyan-300">
          + Create New League
        </button>
        <button onClick={() => navigate("/join")} className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2.5 font-dm text-slate-200">
          Join League with Code
        </button>
        <button onClick={() => navigate("/leagues/public")} className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2.5 font-dm text-slate-200">
          Browse Public Leagues
        </button>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
          <p className="font-dm mb-2 text-sm text-slate-200">Notification Settings</p>
          <label className="mb-2 flex items-center justify-between">
            <span className="font-dm text-sm text-slate-400">Deadline reminders</span>
            <button
              type="button"
              onClick={() => setPushDeadlineAlerts((v) => !v)}
              className={`h-7 w-12 rounded-full p-1 transition ${pushDeadlineAlerts ? "bg-cyan-400" : "bg-slate-700"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition ${pushDeadlineAlerts ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </label>
          <label className="flex items-center justify-between">
            <span className="font-dm text-sm text-slate-400">Goal/concede alerts</span>
            <button
              type="button"
              onClick={() => setPushGoalAlerts((v) => !v)}
              className={`h-7 w-12 rounded-full p-1 transition ${pushGoalAlerts ? "bg-cyan-400" : "bg-slate-700"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition ${pushGoalAlerts ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </label>
        </div>
        <button className="w-full rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2.5 font-dm text-slate-200">
          Help & Support
        </button>
        <button onClick={handleSignOut} className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 font-dm font-semibold text-red-300">
          Sign Out
        </button>
      </section>
    </main>
  );
}
