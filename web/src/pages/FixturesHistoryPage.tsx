import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FixtureCard from "../components/FixtureCard";
import Skeleton from "../components/Skeleton";
import { apiClient } from "../api/client";

interface TeamLite {
  id: number;
  name: string;
  shortName: string;
  crestUrl?: string | null;
}

interface FixtureRow {
  id: string;
  gameweek: number;
  kickoffTime: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
}

interface HistoryResponse {
  from: number;
  to: number;
  currentGameweek: number;
  gameweeks: Array<{
    gameweek: number;
    fixtures: FixtureRow[];
  }>;
}

interface TeamFormRow {
  fixtureId: string;
  gameweek: number;
  kickoffTime: string;
  status: "FINISHED" | "POSTPONED";
  isHome: boolean;
  opponent: TeamLite;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: "W" | "D" | "L" | "P";
}

interface TeamFormResponse {
  team: TeamLite;
  form: TeamFormRow[];
}

function resultClass(result: TeamFormRow["result"]) {
  if (result === "W") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (result === "D") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (result === "L") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-slate-600/20 text-slate-300 border-slate-600/40";
}

export default function FixturesHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamLite | null>(null);
  const [teamForm, setTeamForm] = useState<TeamFormRow[] | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await apiClient.get<{ gameweek: number }>("/api/fixtures/current-gameweek");
      const to = current.data.gameweek;
      const res = await apiClient.get<HistoryResponse>(`/api/fixtures/history?from=1&to=${to}`);
      setHistory(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load fixture history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openTeamForm(team: TeamLite) {
    setSelectedTeam(team);
    setFormLoading(true);
    setTeamForm(null);
    try {
      const res = await apiClient.get<TeamFormResponse>(`/api/teams/${team.id}/form?limit=6`);
      setTeamForm(res.data.form);
    } catch {
      setTeamForm([]);
    } finally {
      setFormLoading(false);
    }
  }

  const gameweeks = useMemo(
    () =>
      (history?.gameweeks ?? [])
        .map((gw) => ({
          ...gw,
          fixtures: [...gw.fixtures].sort(
            (a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime()
          ),
        }))
        .sort((a, b) => b.gameweek - a.gameweek),
    [history]
  );

  if (loading) {
    return (
      <main className="page-shell space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
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
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Fixture History</h1>
        <p className="font-dm mt-1 text-sm text-slate-400">
          Gameweeks 1 to {history?.to ?? "-"}.
          Click a team badge for last 6 results.
        </p>
      </header>

      {gameweeks.length === 0 ? (
        <EmptyState title="No fixtures found" description="No gameweek history available yet." />
      ) : (
        <section className="space-y-4">
          {gameweeks.map((gw) => (
            <div key={gw.gameweek} className="space-y-2">
              <h2 className="font-outfit text-xl font-bold text-slate-100">GW {gw.gameweek}</h2>
              <div className="space-y-2">
                {gw.fixtures.map((fixture) => (
                  <FixtureCard key={fixture.id} fixture={fixture} onTeamClick={openTeamForm} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {selectedTeam && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={() => setSelectedTeam(null)}>
          <div className="mx-auto mt-16 max-w-[430px] rounded-2xl border border-slate-700 bg-[#0A0E17] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-outfit text-xl font-bold text-slate-100">{selectedTeam.name} Form (Last 6)</h3>
              <button className="font-dm text-slate-400" onClick={() => setSelectedTeam(null)}>Close</button>
            </div>

            {formLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : !teamForm || teamForm.length === 0 ? (
              <EmptyState title="No recent results" description="This team has no finished fixtures yet." />
            ) : (
              <div className="space-y-2">
                {teamForm.map((row) => (
                  <div key={row.fixtureId} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
                    <div>
                      <p className="font-dm text-sm text-slate-100">
                        GW{row.gameweek} · {row.isHome ? "vs" : "@"} {row.opponent.shortName}
                      </p>
                      <p className="font-dm text-xs text-slate-500">
                        {row.status === "POSTPONED" ? "Postponed" : `${row.goalsFor ?? 0} - ${row.goalsAgainst ?? 0}`}
                      </p>
                    </div>
                    <span className={`rounded border px-2 py-0.5 font-dm text-xs font-bold ${resultClass(row.result)}`}>{row.result}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
