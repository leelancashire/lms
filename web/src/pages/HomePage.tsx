import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import CountdownTimer from "../components/CountdownTimer";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FixtureCard from "../components/FixtureCard";
import Skeleton from "../components/Skeleton";
import TeamBadge from "../components/TeamBadge";
import { useAuth } from "../context/AuthContext";

interface LeagueListItem {
  id: string;
  name: string;
}

interface MemberRow {
  user: { id: string; displayName: string };
  status: "ALIVE" | "ELIMINATED" | "WINNER";
}

interface LeagueDetail {
  league: { id: string; name: string };
  members: MemberRow[];
  currentGameweek: { gameweek: number; deadline: string } | null;
}

interface PickRow {
  id: string;
  gameweek: number;
  result: "PENDING" | "WON" | "LOST" | "DRAWN";
  team: {
    id: number;
    shortName: string;
    crestUrl?: string | null;
    name: string;
  };
}

interface PicksMineResponse {
  picks: PickRow[];
  availableTeams: Array<{ id: number }>;
}

interface Fixture {
  id: string;
  kickoffTime: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: number; shortName: string; crestUrl?: string | null; name: string };
  awayTeam: { id: number; shortName: string; crestUrl?: string | null; name: string };
}

interface TeamLite {
  id: number;
  name: string;
  shortName: string;
  crestUrl?: string | null;
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

function HomeSkeleton() {
  return (
    <main className="page-shell space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </main>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string>("Your League");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [currentGameweek, setCurrentGameweek] = useState<number>(1);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [availableTeamsCount, setAvailableTeamsCount] = useState<number>(0);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamLite | null>(null);
  const [teamForm, setTeamForm] = useState<TeamFormRow[] | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const leaguesRes = await apiClient.get<{ leagues: LeagueListItem[] }>("/api/leagues");
      const firstLeague = leaguesRes.data.leagues[0];
      if (!firstLeague) {
        setLeagueId(null);
        return;
      }

      const id = firstLeague.id;
      setLeagueId(id);

      const detailRes = await apiClient.get<LeagueDetail>(`/api/leagues/${id}`);
      const gw = detailRes.data.currentGameweek?.gameweek ?? 1;
      const gwDeadline = detailRes.data.currentGameweek?.deadline ?? null;

      const [mineRes, fixturesRes] = await Promise.all([
        apiClient.get<PicksMineResponse>(`/api/leagues/${id}/picks/mine`),
        apiClient.get<{ fixtures: Fixture[]; deadline: string | null }>(`/api/fixtures?gameweek=${gw}`),
      ]);

      setLeagueName(detailRes.data.league.name);
      setMembers(detailRes.data.members);
      setCurrentGameweek(gw);
      setDeadline(fixturesRes.data.deadline ?? gwDeadline);
      setPicks(mineRes.data.picks);
      setAvailableTeamsCount(mineRes.data.availableTeams.length);
      setFixtures(fixturesRes.data.fixtures);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load home screen");
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

  const myMember = useMemo(() => members.find((m) => m.user.id === user?.id), [members, user?.id]);
  const aliveCount = useMemo(() => members.filter((m) => m.status === "ALIVE" || m.status === "WINNER").length, [members]);

  const currentPick = useMemo(() => picks.find((p) => p.gameweek === currentGameweek), [picks, currentGameweek]);

  if (loading) return <HomeSkeleton />;
  if (error)
    return (
      <main className="page-shell">
        <ErrorState message={error} onRetry={() => void load()} />
      </main>
    );

  if (!leagueId) {
    return (
      <main className="page-shell">
        <EmptyState
          title="No leagues yet"
          description="Create or join a league to start playing."
          ctaLabel="Join League"
          onCta={() => navigate("/join")}
        />
      </main>
    );
  }

  return (
    <main className="page-shell space-y-4">
      <header className="px-1">
        <p className="font-dm text-xs uppercase tracking-[0.16em] text-slate-500">Premier League</p>
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Last Man Standing</h1>
        <p className="font-dm text-sm text-slate-400">{leagueName}</p>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-cyan-950/30 p-4">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/20 blur-2xl" />
        <p className={`font-dm text-xs uppercase tracking-[0.16em] ${myMember?.status === "ALIVE" ? "text-[#22D3EE]" : "text-red-400"}`}>
          {myMember?.status === "ALIVE" ? "You're still in" : "Eliminated"}
        </p>
        <h2 className="font-outfit mt-1 text-2xl font-extrabold text-slate-100">
          {myMember?.status === "ALIVE" ? `Gameweek ${currentGameweek}` : `Out in GW${currentGameweek}`}
        </h2>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-center">
          <p className="font-outfit text-2xl font-bold text-[#22D3EE]">
            {aliveCount}/{members.length}
          </p>
          <p className="font-dm text-[11px] uppercase tracking-[0.12em] text-slate-500">Alive</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-center">
          <p className="font-outfit text-2xl font-bold text-amber-400">{availableTeamsCount}</p>
          <p className="font-dm text-[11px] uppercase tracking-[0.12em] text-slate-500">Teams Left</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-center">
          <CountdownTimer deadline={deadline} />
          <p className="font-dm text-[11px] uppercase tracking-[0.12em] text-slate-500">Deadline</p>
        </div>
      </section>

      {currentPick ? (
        <section className="rounded-2xl border border-emerald-600/40 bg-emerald-950/20 p-4">
          <p className="font-dm text-xs uppercase tracking-[0.14em] text-emerald-300">Current Pick</p>
          <div className="mt-2 flex items-center gap-2">
            <TeamBadge shortName={currentPick.team.shortName} crestUrl={currentPick.team.crestUrl} />
            <p className="font-outfit text-lg font-bold text-slate-100">{currentPick.team.name}</p>
          </div>
        </section>
      ) : (
        <button
          className="w-full rounded-2xl bg-gradient-to-r from-[#22D3EE] to-cyan-400 px-4 py-3 font-outfit text-lg font-bold text-slate-950"
          onClick={() => navigate("/pick")}
        >
          Make Your GW{currentGameweek} Pick →
        </button>
      )}

      <section className="space-y-2">
        <h3 className="font-dm text-xs uppercase tracking-[0.16em] text-slate-500">Your Pick History</h3>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-3">
          <div className="flex flex-wrap gap-2">
            {picks.length === 0 && <p className="font-dm text-sm text-slate-500">No picks yet</p>}
            {picks.map((pick) => (
              <div key={pick.id} className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1">
                <TeamBadge shortName={pick.team.shortName} crestUrl={pick.team.crestUrl} size={24} />
                <span className="font-dm text-xs font-semibold text-slate-100">{pick.team.shortName}</span>
                <span className={`font-dm text-xs ${pick.result === "WON" ? "text-emerald-400" : pick.result === "LOST" || pick.result === "DRAWN" ? "text-red-400" : "text-slate-500"}`}>
                  {pick.result === "WON" ? "✓" : pick.result === "LOST" || pick.result === "DRAWN" ? "✗" : "•"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-dm text-xs uppercase tracking-[0.16em] text-slate-500">GW{currentGameweek} Fixtures</h3>
        {fixtures.length === 0 ? (
          <EmptyState title="No fixtures this week" description="Check back later for updates." />
        ) : (
          <>
            <div className="space-y-2">
              {fixtures.slice(0, 8).map((fixture) => (
                <FixtureCard key={fixture.id} fixture={fixture} onTeamClick={openTeamForm} />
              ))}
            </div>
            <button
              onClick={() => navigate("/fixtures-history")}
              className="w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 font-dm text-sm font-semibold text-cyan-300"
            >
              View all fixtures →
            </button>
          </>
        )}
      </section>

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
