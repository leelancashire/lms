import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import ConfirmModal from "../components/ConfirmModal";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Skeleton from "../components/Skeleton";
import TeamBadge from "../components/TeamBadge";
import { useToast } from "../context/ToastContext";
import { COMPETITIONS, competitionLabel } from "../lib/competitions";

interface Team {
  id: number;
  name: string;
  shortName: string;
  crestUrl?: string | null;
}

interface Fixture {
  id: string;
  competition?: string;
  gameweek: number;
  kickoffTime: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  homeTeamId: number;
  awayTeamId: number;
  homeOdds: number | null;
  awayOdds: number | null;
  homeTeam: Team;
  awayTeam: Team;
}
interface FixturesResponse {
  fixtures: Fixture[];
  deadline: string | null;
  activeDate?: string | null;
}

interface LeagueListItem {
  id: string;
  name: string;
  competition: string;
}

interface PicksMine {
  picks: Array<{ teamId: number }>;
  availableTeams: Team[];
}

interface FormStripResponse {
  strips: Array<{ teamId: number; form: Array<"W" | "D" | "L" | "P"> }>;
}

function difficultyForOdds(value: number) {
  if (value < 1.8) return { label: "Fav", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
  if (value <= 2.5) return { label: "Even", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
  return { label: "Risky", cls: "bg-red-500/20 text-red-300 border-red-500/40" };
}

function resultCls(result: "W" | "D" | "L" | "P") {
  if (result === "W") return "bg-emerald-500/20 text-emerald-300";
  if (result === "D") return "bg-amber-500/20 text-amber-300";
  if (result === "L") return "bg-red-500/20 text-red-300";
  return "bg-slate-600/20 text-slate-300";
}

function PickSkeleton() {
  return (
    <main className="page-shell space-y-4">
      <Skeleton className="h-10 w-52" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </main>
  );
}

export default function PickPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
  const [leagueCompetition, setLeagueCompetition] = useState<string>("ALL");
  const [viewCompetition, setViewCompetition] = useState<string>("ALL");
  const [gameweek, setGameweek] = useState<number>(1);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [dateFilterOnly, setDateFilterOnly] = useState(false);
  const [usedTeamIds, setUsedTeamIds] = useState<Set<number>>(new Set());
  const [formStripByTeam, setFormStripByTeam] = useState<Record<number, Array<"W" | "D" | "L" | "P">>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successTeamName, setSuccessTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (targetLeagueId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const leaguesRes = await apiClient.get<{ leagues: LeagueListItem[] }>("/api/leagues");
      const allLeagues = leaguesRes.data.leagues;
      setLeagues(allLeagues);
      if (!allLeagues.length) {
        setError("Join a league first.");
        return;
      }

      const selected =
        allLeagues.find((l) => l.id === targetLeagueId) ??
        allLeagues.find((l) => l.id === leagueId) ??
        allLeagues.find((l) => l.competition === "ALL") ??
        allLeagues.find((l) => l.competition === "PL") ??
        allLeagues[0];
      const id = selected.id;
      const competition = selected.competition;
      setLeagueId(id);
      setLeagueCompetition(competition);
      setViewCompetition((prev) => (competition === "ALL" ? prev : competition));
      const effectiveCompetition = competition === "ALL" ? viewCompetition : competition;

      const currentGwRes = await apiClient.get<{ gameweek: number; deadline: string }>(
        `/api/fixtures/next-open-gameweek?competition=${effectiveCompetition}`
      );
      const gw = currentGwRes.data.gameweek;

      const [teamsRes, mineRes, fixturesRes, formRes] = await Promise.allSettled([
        apiClient.get<{ teams: Team[] }>(`/api/teams?competition=${effectiveCompetition}`),
        apiClient.get<PicksMine>(`/api/leagues/${id}/picks/mine`),
        apiClient.get<FixturesResponse>(
          `/api/fixtures?gameweek=${gw}&competition=${effectiveCompetition}${dateFilterOnly && activeDate ? `&date=${activeDate}` : ""}`
        ),
        apiClient.get<FormStripResponse>(`/api/teams/form-strip?limit=5&competition=${effectiveCompetition}`),
      ]);

      if (teamsRes.status !== "fulfilled" || mineRes.status !== "fulfilled" || fixturesRes.status !== "fulfilled") {
        throw new Error("Failed to load required pick data");
      }

      setGameweek(gw);
      setActiveDate(fixturesRes.value.data.activeDate ?? null);
      setDeadline(fixturesRes.value.data.deadline ?? currentGwRes.data.deadline);
      setTeams(teamsRes.value.data.teams);
      setFixtures(fixturesRes.value.data.fixtures);

      const availableIds = new Set(mineRes.value.data.availableTeams.map((t) => t.id));
      const used = new Set(teamsRes.value.data.teams.filter((t) => !availableIds.has(t.id)).map((t) => t.id));
      setUsedTeamIds(used);
      if (formRes.status === "fulfilled") {
        setFormStripByTeam(
          Object.fromEntries(formRes.value.data.strips.map((entry) => [entry.teamId, entry.form]))
        );
      } else {
        setFormStripByTeam({});
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load pick data");
    } finally {
      setLoading(false);
    }
  }, [activeDate, dateFilterOnly, leagueId, viewCompetition]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === selectedTeamId) ?? null, [teams, selectedTeamId]);

  const fixtureByTeam = useMemo(() => {
    const map = new Map<number, Fixture>();
    for (const fixture of fixtures) {
      if (!map.has(fixture.homeTeamId)) map.set(fixture.homeTeamId, fixture);
      if (!map.has(fixture.awayTeamId)) map.set(fixture.awayTeamId, fixture);
    }
    return map;
  }, [fixtures]);
  const visibleTeams = useMemo(
    () => (dateFilterOnly ? teams.filter((team) => fixtureByTeam.has(team.id)) : teams),
    [dateFilterOnly, fixtureByTeam, teams]
  );

  const now = Date.now();
  const deadlinePassed = deadline ? now >= new Date(deadline).getTime() : false;

  async function confirmPick() {
    if (!leagueId || !selectedTeam) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/leagues/${leagueId}/picks`, { teamId: selectedTeam.id });
      setConfirmOpen(false);
      setSuccessTeamName(selectedTeam.name);
      showToast("Pick confirmed", "success");
      window.setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Could not submit pick";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PickSkeleton />;

  if (error && !teams.length) {
    return (
      <main className="page-shell">
        <ErrorState message={error} onRetry={() => void load()} />
      </main>
    );
  }

  if (successTeamName) {
    return (
      <main className="page-shell flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-20 w-20 rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/60 flex items-center justify-center animate-pulse">
          <span className="font-outfit text-4xl text-emerald-300">✓</span>
        </div>
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Pick Locked In!</h1>
        <p className="font-dm text-slate-400">{successTeamName} for GW{gameweek}</p>
      </main>
    );
  }

  return (
    <main className="page-shell space-y-4">
      <header>
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Make Your Pick</h1>
        <p className="font-dm mt-1 text-sm text-slate-400">
          {leagueCompetition === "ALL" ? `All Leagues · ${competitionLabel(viewCompetition)}` : competitionLabel(leagueCompetition)} · Gameweek {gameweek} · Deadline {deadline ? new Date(deadline).toLocaleString() : "TBD"}
        </p>
        {leagues.length > 1 && (
          <select
            value={leagueId ?? ""}
            onChange={(e) => void load(e.target.value)}
            className="font-dm mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name} · {competitionLabel(league.competition)}
              </option>
            ))}
          </select>
        )}
        {leagueCompetition === "ALL" && (
          <select
            value={viewCompetition}
            onChange={(e) => setViewCompetition(e.target.value)}
            className="font-dm mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200"
          >
            {COMPETITIONS.map((c) => (
              <option key={c.code} value={c.code}>
                View: {c.label}
              </option>
            ))}
          </select>
        )}
        {activeDate && (
          <button
            onClick={() => setDateFilterOnly((v) => !v)}
            className={`font-dm mt-2 rounded-lg border px-3 py-1.5 text-xs ${
              dateFilterOnly ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-300" : "border-slate-700 bg-slate-900/60 text-slate-300"
            }`}
          >
            {dateFilterOnly ? `Showing agreed date only (${activeDate})` : `Show agreed date only (${activeDate})`}
          </button>
        )}
      </header>

      <section
        className={`rounded-2xl border p-5 text-center transition ${
          selectedTeam
            ? "border-cyan-400/40 bg-gradient-to-br from-slate-900 to-cyan-950/20"
            : "border-slate-700 bg-slate-900/60"
        }`}
      >
        {selectedTeam ? (
          <div className="flex flex-col items-center gap-3">
            <TeamBadge shortName={selectedTeam.shortName} crestUrl={selectedTeam.crestUrl} size={64} />
            <h2 className="font-outfit text-2xl font-bold text-slate-100">{selectedTeam.name}</h2>
            <p className="font-dm text-sm text-slate-400">
              {(() => {
                const fixture = fixtureByTeam.get(selectedTeam.id);
                if (!fixture) return "No fixture found";
                const isHome = fixture.homeTeamId === selectedTeam.id;
                const opp = isHome ? fixture.awayTeam.name : fixture.homeTeam.name;
                return `${fixture.status === "POSTPONED" ? "Postponed · " : ""}vs ${opp} (${isHome ? "H" : "A"})`;
              })()}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-slate-800 text-3xl text-slate-500">
              ?
            </div>
            <p className="font-dm text-sm text-slate-500">Select a team below</p>
          </div>
        )}
      </section>

      {error && <p className="font-dm text-sm text-red-400">{error}</p>}

      {deadlinePassed ? (
        <section className="rounded-xl border border-red-700/40 bg-red-950/20 p-4">
          <p className="font-dm text-sm text-red-300">Deadline has passed.</p>
        </section>
      ) : visibleTeams.length === 0 ? (
        <EmptyState title="No teams available" description="Check fixtures and try again." />
      ) : (
        <section className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {visibleTeams.map((team) => {
              const used = usedTeamIds.has(team.id);
              const fixture = fixtureByTeam.get(team.id);
              const kickedOff = fixture ? new Date(fixture.kickoffTime).getTime() <= now : true;
              const disabled = used || !fixture || kickedOff;
              const selected = selectedTeamId === team.id;

              let oddsBadge: { label: string; cls: string } | null = null;
              if (fixture) {
                const isHome = fixture.homeTeamId === team.id;
                const odds = isHome ? fixture.homeOdds : fixture.awayOdds;
                if (odds != null) oddsBadge = difficultyForOdds(odds);
              }

              return (
                <button
                  key={team.id}
                  disabled={disabled}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`relative rounded-xl border p-2 text-left transition ${
                    selected ? "border-[#22D3EE] bg-cyan-950/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]" : "border-slate-700 bg-slate-900/60"
                  } ${disabled ? "opacity-25" : "hover:border-slate-500"}`}
                >
                  {oddsBadge && (
                    <span className={`absolute right-1 top-1 rounded border px-1.5 py-0.5 font-dm text-[10px] ${oddsBadge.cls}`}>
                      {oddsBadge.label}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <TeamBadge shortName={team.shortName} crestUrl={team.crestUrl} size={30} muted={disabled} />
                    <span className="font-dm text-xs font-semibold text-slate-100">{team.shortName}</span>
                  </div>
                  <p className="font-dm mt-1 text-[10px] text-slate-500">
                    {!fixture
                      ? "No fixture"
                      : fixture.status === "POSTPONED"
                        ? "Postponed"
                        : kickedOff
                          ? "Kicked off"
                          : new Date(fixture.kickoffTime).toLocaleDateString()}
                  </p>
                  {formStripByTeam[team.id]?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {formStripByTeam[team.id].slice(0, 5).map((r, idx) => (
                        <span key={`${team.id}-f-${idx}`} className={`rounded px-1 py-0.5 font-dm text-[9px] ${resultCls(r)}`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {used && <span className="absolute bottom-1 right-1 font-dm text-[10px] text-red-400">✗ used</span>}
                </button>
              );
            })}
          </div>

          {selectedTeam && (
            <div className="space-y-2">
              <button
                className="w-full rounded-xl bg-gradient-to-r from-[#22D3EE] to-cyan-400 px-4 py-3 font-outfit text-lg font-bold text-slate-950"
                onClick={() => setConfirmOpen(true)}
                disabled={submitting}
              >
                Confirm {selectedTeam.name} →
              </button>
              <p className="font-dm text-center text-xs text-slate-500">You won't be able to change this after confirmation</p>
            </div>
          )}
        </section>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={`Lock in ${selectedTeam?.name} for GW${gameweek}?`}
        description="Confirm to submit your pick."
        confirmLabel={submitting ? "Submitting..." : "Confirm"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmPick}
      />
    </main>
  );
}
