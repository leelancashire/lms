import { useState, useEffect, useRef } from "react";

// ── Design System ──
const theme = {
  bg: "#0A0E17",
  bgCard: "#111827",
  bgCardHover: "#1a2235",
  bgElevated: "#1E293B",
  accent: "#22D3EE",
  accentGlow: "rgba(34,211,238,0.15)",
  danger: "#EF4444",
  dangerGlow: "rgba(239,68,68,0.15)",
  success: "#10B981",
  successGlow: "rgba(16,185,129,0.15)",
  warning: "#F59E0B",
  warningGlow: "rgba(245,158,11,0.15)",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  textDim: "#64748B",
  border: "#1E293B",
  borderLight: "#334155",
};

const TEAMS = [
  { id: 1, name: "Arsenal", short: "ARS", color: "#EF0107" },
  { id: 2, name: "Aston Villa", short: "AVL", color: "#95BFE5" },
  { id: 3, name: "Bournemouth", short: "BOU", color: "#DA291C" },
  { id: 4, name: "Brentford", short: "BRE", color: "#E30613" },
  { id: 5, name: "Brighton", short: "BHA", color: "#0057B8" },
  { id: 6, name: "Chelsea", short: "CHE", color: "#034694" },
  { id: 7, name: "Crystal Palace", short: "CRY", color: "#1B458F" },
  { id: 8, name: "Everton", short: "EVE", color: "#003399" },
  { id: 9, name: "Fulham", short: "FUL", color: "#000000" },
  { id: 10, name: "Ipswich Town", short: "IPS", color: "#0044AA" },
  { id: 11, name: "Leicester City", short: "LEI", color: "#003090" },
  { id: 12, name: "Liverpool", short: "LIV", color: "#C8102E" },
  { id: 13, name: "Man City", short: "MCI", color: "#6CABDD" },
  { id: 14, name: "Man United", short: "MUN", color: "#DA291C" },
  { id: 15, name: "Newcastle", short: "NEW", color: "#241F20" },
  { id: 16, name: "Nott'm Forest", short: "NFO", color: "#DD0000" },
  { id: 17, name: "Southampton", short: "SOU", color: "#D71920" },
  { id: 18, name: "Tottenham", short: "TOT", color: "#132257" },
  { id: 19, name: "West Ham", short: "WHU", color: "#7A263A" },
  { id: 20, name: "Wolves", short: "WOL", color: "#FDB913" },
];

const FIXTURES_GW28 = [
  { home: 1, away: 13, time: "Sat 12:30", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 12, away: 14, time: "Sat 15:00", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 6, away: 11, time: "Sat 15:00", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 15, away: 3, time: "Sat 15:00", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 18, away: 2, time: "Sat 17:30", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 5, away: 19, time: "Sun 14:00", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 16, away: 8, time: "Sun 14:00", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 9, away: 4, time: "Sun 16:30", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 7, away: 10, time: "Mon 20:00", homeScore: null, awayScore: null, status: "upcoming" },
  { home: 17, away: 20, time: "Mon 20:00", homeScore: null, awayScore: null, status: "upcoming" },
];

const LEAGUE_MEMBERS = [
  { name: "You", status: "alive", picks: [12, 1, 13, 6], currentPick: null },
  { name: "Jack M", status: "alive", picks: [1, 12, 15, 18], currentPick: 14 },
  { name: "Sarah K", status: "alive", picks: [13, 6, 1, 12], currentPick: 15 },
  { name: "Davey P", status: "alive", picks: [18, 13, 12, 1], currentPick: null },
  { name: "Tom W", status: "alive", picks: [6, 18, 14, 15], currentPick: 12 },
  { name: "Emma R", status: "eliminated", picks: [12, 1, 17], eliminatedGW: 27 },
  { name: "Chris B", status: "eliminated", picks: [15, 8], eliminatedGW: 26 },
  { name: "Mia L", status: "eliminated", picks: [14], eliminatedGW: 25 },
];

const teamById = (id) => TEAMS.find((t) => t.id === id);

// ── Components ──

function TeamBadge({ team, size = 36, selected, used, onSelect }) {
  const isInteractive = !!onSelect;
  const opacity = used ? 0.25 : 1;
  return (
    <div
      onClick={() => isInteractive && !used && onSelect(team)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: team.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.3,
        fontWeight: 800,
        color: "#fff",
        opacity,
        cursor: isInteractive && !used ? "pointer" : "default",
        border: selected ? `2px solid ${theme.accent}` : "2px solid transparent",
        boxShadow: selected ? `0 0 12px ${theme.accentGlow}` : "none",
        transition: "all 0.2s ease",
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
    >
      {team.short.slice(0, 3)}
    </div>
  );
}

function StatusDot({ status }) {
  const color = status === "alive" ? theme.success : theme.danger;
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        background: color,
        display: "inline-block",
        boxShadow: `0 0 6px ${color}40`,
      }}
    />
  );
}

function NavBar({ screen, setScreen }) {
  const items = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "pick", label: "Pick", icon: "✦" },
    { id: "league", label: "League", icon: "☰" },
    { id: "live", label: "Live", icon: "●" },
    { id: "profile", label: "Profile", icon: "◉" },
  ];
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        background: "rgba(10,14,23,0.95)",
        backdropFilter: "blur(20px)",
        borderTop: `1px solid ${theme.border}`,
        display: "flex",
        justifyContent: "space-around",
        padding: "8px 0 env(safe-area-inset-bottom, 12px)",
        zIndex: 100,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setScreen(item.id)}
          style={{
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            padding: "4px 12px",
            transition: "all 0.2s",
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: screen === item.id ? theme.accent : theme.textDim,
              filter: screen === item.id ? `drop-shadow(0 0 6px ${theme.accent}60)` : "none",
            }}
          >
            {item.icon}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: screen === item.id ? theme.accent : theme.textDim,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

function Header({ title, subtitle, rightAction }) {
  return (
    <div
      style={{
        padding: "20px 20px 12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: theme.text,
            margin: 0,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: theme.textMuted,
              margin: "4px 0 0",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightAction}
    </div>
  );
}

function Card({ children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: theme.bgCard,
        borderRadius: 16,
        border: `1px solid ${theme.border}`,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Screens ──

function HomeScreen({ setScreen }) {
  const alive = LEAGUE_MEMBERS.filter((m) => m.status === "alive").length;
  const total = LEAGUE_MEMBERS.length;
  const pct = ((alive / total) * 100).toFixed(0);

  return (
    <div style={{ paddingBottom: 90 }}>
      <Header title="Last Man Standing" subtitle="Premier League 2025/26" />

      {/* Status Hero */}
      <div style={{ padding: "0 20px", marginBottom: 20 }}>
        <Card
          style={{
            background: `linear-gradient(135deg, ${theme.bgCard} 0%, rgba(34,211,238,0.08) 100%)`,
            border: `1px solid rgba(34,211,238,0.2)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.accentGlow} 0%, transparent 70%)`,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: `linear-gradient(135deg, ${theme.accent}, #06B6D4)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 900,
                color: theme.bg,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              ✓
            </div>
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: theme.accent,
                  margin: 0,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                You're still in
              </p>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: theme.text,
                  margin: "2px 0 0",
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                Gameweek 28
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div style={{ padding: "0 20px", display: "flex", gap: 10, marginBottom: 20 }}>
        <Card style={{ flex: 1, padding: 14, textAlign: "center" }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: theme.accent, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
            {alive}
            <span style={{ fontSize: 14, color: theme.textDim }}>/{total}</span>
          </p>
          <p style={{ fontSize: 11, color: theme.textMuted, margin: "4px 0 0", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Alive
          </p>
        </Card>
        <Card style={{ flex: 1, padding: 14, textAlign: "center" }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: theme.warning, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
            16
          </p>
          <p style={{ fontSize: 11, color: theme.textMuted, margin: "4px 0 0", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Teams Left
          </p>
        </Card>
        <Card style={{ flex: 1, padding: 14, textAlign: "center" }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: theme.danger, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
            1d 4h
          </p>
          <p style={{ fontSize: 11, color: theme.textMuted, margin: "4px 0 0", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Deadline
          </p>
        </Card>
      </div>

      {/* Make Your Pick CTA */}
      <div style={{ padding: "0 20px", marginBottom: 20 }}>
        <button
          onClick={() => setScreen("pick")}
          style={{
            width: "100%",
            padding: "16px 20px",
            borderRadius: 14,
            border: "none",
            background: `linear-gradient(135deg, ${theme.accent}, #06B6D4)`,
            color: theme.bg,
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "-0.01em",
            boxShadow: `0 4px 24px ${theme.accent}40`,
            transition: "all 0.2s",
          }}
        >
          Make Your GW28 Pick →
        </button>
      </div>

      {/* Your Pick History */}
      <div style={{ padding: "0 20px", marginBottom: 20 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.textDim,
            margin: "0 0 10px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Your Picks
        </p>
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[12, 1, 13, 6].map((id, i) => {
              const team = teamById(id);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: theme.bgElevated,
                    borderRadius: 20,
                    padding: "6px 12px 6px 6px",
                  }}
                >
                  <TeamBadge team={team} size={24} />
                  <span style={{ fontSize: 12, color: theme.text, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                    {team.short}
                  </span>
                  <span style={{ fontSize: 10, color: theme.success }}>✓</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Upcoming Fixtures */}
      <div style={{ padding: "0 20px" }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.textDim,
            margin: "0 0 10px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          GW28 Fixtures
        </p>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {FIXTURES_GW28.slice(0, 5).map((fix, i) => {
            const home = teamById(fix.home);
            const away = teamById(fix.away);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: i < 4 ? `1px solid ${theme.border}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <TeamBadge team={home} size={28} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>
                    {home.short}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: theme.textDim,
                    fontFamily: "'DM Mono', monospace",
                    padding: "4px 10px",
                    background: theme.bgElevated,
                    borderRadius: 6,
                    fontWeight: 500,
                  }}
                >
                  {fix.time}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>
                    {away.short}
                  </span>
                  <TeamBadge team={away} size={28} />
                </div>
              </div>
            );
          })}
          <div
            style={{
              padding: "10px 16px",
              textAlign: "center",
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            <span
              onClick={() => setScreen("live")}
              style={{ fontSize: 12, color: theme.accent, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              View all fixtures →
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PickScreen({ setScreen }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const usedTeams = [12, 1, 13, 6]; // previously picked

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => setScreen("home"), 1500);
  };

  if (confirmed) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 40,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: `linear-gradient(135deg, ${theme.success}, #059669)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            boxShadow: `0 0 40px ${theme.successGlow}`,
            animation: "pulse 1s ease-in-out infinite",
          }}
        >
          ✓
        </div>
        <p style={{ fontSize: 22, fontWeight: 800, color: theme.text, fontFamily: "'Outfit', sans-serif" }}>
          Pick Locked In!
        </p>
        <p style={{ fontSize: 14, color: theme.textMuted, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
          {selectedTeam.name} for Gameweek 28
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 90 }}>
      <Header title="Make Your Pick" subtitle="Gameweek 28 · Deadline: Sat 12:30" />

      {/* Selection Area */}
      <div style={{ padding: "0 20px", marginBottom: 16 }}>
        <Card
          style={{
            background: selectedTeam
              ? `linear-gradient(135deg, ${theme.bgCard}, ${selectedTeam.color}15)`
              : theme.bgCard,
            border: selectedTeam ? `1px solid ${selectedTeam.color}40` : `1px solid ${theme.border}`,
            textAlign: "center",
            padding: 24,
            transition: "all 0.3s ease",
          }}
        >
          {selectedTeam ? (
            <>
              <TeamBadge team={selectedTeam} size={64} />
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: theme.text,
                  margin: "12px 0 4px",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                {selectedTeam.name}
              </p>
              <p style={{ fontSize: 12, color: theme.textMuted, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
                vs{" "}
                {(() => {
                  const fix = FIXTURES_GW28.find(
                    (f) => f.home === selectedTeam.id || f.away === selectedTeam.id
                  );
                  if (!fix) return "TBD";
                  const oppId = fix.home === selectedTeam.id ? fix.away : fix.home;
                  return teamById(oppId).name + (fix.home === selectedTeam.id ? " (H)" : " (A)");
                })()}
              </p>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: theme.bgElevated,
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: theme.textDim,
                  border: `2px dashed ${theme.borderLight}`,
                }}
              >
                ?
              </div>
              <p style={{ fontSize: 14, color: theme.textDim, margin: "12px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
                Select a team below
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Team Grid */}
      <div style={{ padding: "0 20px", marginBottom: 16 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.textDim,
            margin: "0 0 10px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Available Teams
          <span style={{ color: theme.textDim, fontWeight: 400, marginLeft: 6 }}>
            (used teams greyed out)
          </span>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {TEAMS.map((team) => {
            const used = usedTeams.includes(team.id);
            const isSelected = selectedTeam?.id === team.id;
            const fixture = FIXTURES_GW28.find((f) => f.home === team.id || f.away === team.id);
            return (
              <button
                key={team.id}
                onClick={() => !used && setSelectedTeam(team)}
                style={{
                  background: isSelected ? `${team.color}20` : theme.bgCard,
                  border: isSelected ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "12px 4px 10px",
                  cursor: used ? "not-allowed" : "pointer",
                  opacity: used ? 0.3 : 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? `0 0 16px ${theme.accentGlow}` : "none",
                  position: "relative",
                }}
              >
                {used && (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      fontSize: 8,
                      color: theme.textDim,
                    }}
                  >
                    ✗
                  </div>
                )}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: team.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {team.short.slice(0, 3)}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isSelected ? theme.accent : theme.text,
                    fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {team.short}
                </span>
                {fixture && (
                  <span style={{ fontSize: 8, color: theme.textDim, fontFamily: "'DM Sans', sans-serif" }}>
                    {fixture.home === team.id ? "H" : "A"} · {fixture.time.split(" ")[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm Button */}
      {selectedTeam && (
        <div style={{ padding: "0 20px" }}>
          <button
            onClick={handleConfirm}
            style={{
              width: "100%",
              padding: "16px 20px",
              borderRadius: 14,
              border: "none",
              background: `linear-gradient(135deg, ${theme.accent}, #06B6D4)`,
              color: theme.bg,
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "'Outfit', sans-serif",
              boxShadow: `0 4px 24px ${theme.accent}40`,
            }}
          >
            Confirm {selectedTeam.name} →
          </button>
          <p
            style={{
              fontSize: 11,
              color: theme.textDim,
              textAlign: "center",
              margin: "8px 0 0",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            You won't be able to change this after confirmation
          </p>
        </div>
      )}
    </div>
  );
}

function LeagueScreen() {
  const [tab, setTab] = useState("standings");
  const alive = LEAGUE_MEMBERS.filter((m) => m.status === "alive");
  const eliminated = LEAGUE_MEMBERS.filter((m) => m.status === "eliminated");

  return (
    <div style={{ paddingBottom: 90 }}>
      <Header
        title="Office LMS 2025"
        subtitle="8 players · Gameweek 28"
        rightAction={
          <button
            style={{
              background: theme.bgElevated,
              border: `1px solid ${theme.borderLight}`,
              borderRadius: 10,
              padding: "8px 14px",
              color: theme.accent,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Invite
          </button>
        }
      />

      {/* Tabs */}
      <div style={{ padding: "0 20px", display: "flex", gap: 0, marginBottom: 16 }}>
        {["standings", "history"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: tab === t ? theme.bgElevated : "transparent",
              border: `1px solid ${tab === t ? theme.borderLight : theme.border}`,
              borderRadius: t === "standings" ? "10px 0 0 10px" : "0 10px 10px 0",
              color: tab === t ? theme.text : theme.textDim,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "standings" && (
        <div style={{ padding: "0 20px" }}>
          {/* Alive */}
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: theme.success,
              margin: "0 0 8px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <StatusDot status="alive" /> Still Standing ({alive.length})
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {alive.map((m, i) => (
              <Card key={i} style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        background: `linear-gradient(135deg, ${theme.bgElevated}, ${theme.borderLight})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 800,
                        color: theme.text,
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: theme.text,
                          margin: 0,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {m.name}
                      </p>
                      <p style={{ fontSize: 11, color: theme.textDim, margin: "2px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
                        {m.picks.length} picks used
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {m.picks.slice(-3).map((id, j) => (
                      <TeamBadge key={j} team={teamById(id)} size={22} />
                    ))}
                  </div>
                </div>
                {m.currentPick && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "6px 10px",
                      background: theme.bgElevated,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      color: theme.textMuted,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <span style={{ color: theme.accent }}>GW28:</span>
                    <TeamBadge team={teamById(m.currentPick)} size={18} />
                    <span style={{ fontWeight: 600, color: theme.text }}>{teamById(m.currentPick).name}</span>
                  </div>
                )}
                {m.name === "You" && !m.currentPick && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      background: theme.dangerGlow,
                      borderRadius: 8,
                      border: `1px solid ${theme.danger}30`,
                      fontSize: 11,
                      color: theme.danger,
                      fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      textAlign: "center",
                    }}
                  >
                    ⚠ You haven't picked yet for GW28!
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Eliminated */}
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: theme.danger,
              margin: "0 0 8px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <StatusDot status="eliminated" /> Eliminated ({eliminated.length})
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eliminated.map((m, i) => (
              <Card key={i} style={{ padding: 14, opacity: 0.6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        background: theme.bgElevated,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 800,
                        color: theme.textDim,
                        fontFamily: "'Outfit', sans-serif",
                        textDecoration: "line-through",
                      }}
                    >
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: theme.textMuted, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                        {m.name}
                      </p>
                      <p style={{ fontSize: 11, color: theme.textDim, margin: "2px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
                        Out GW{m.eliminatedGW} · {m.picks.length} picks
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: theme.danger }}>✗</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ padding: "0 20px" }}>
          {[27, 26, 25].map((gw) => (
            <div key={gw} style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: theme.textDim,
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Gameweek {gw}
              </p>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {LEAGUE_MEMBERS.filter((m) => m.picks.length >= 28 - gw).map((m, i, arr) => {
                  const pickIdx = gw - 25;
                  const tid = m.picks[pickIdx];
                  if (!tid) return null;
                  const survived = !(m.status === "eliminated" && m.eliminatedGW === gw);
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 16px",
                        borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif", width: 80 }}>
                        {m.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <TeamBadge team={teamById(tid)} size={22} />
                        <span style={{ fontSize: 12, color: theme.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
                          {teamById(tid).name}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, color: survived ? theme.success : theme.danger }}>
                        {survived ? "✓" : "✗"}
                      </span>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveScreen() {
  const [activeFixture, setActiveFixture] = useState(null);
  
  // Simulated live fixtures
  const liveFixtures = [
    { ...FIXTURES_GW28[0], homeScore: 1, awayScore: 0, status: "live", minute: 34, events: [
      { type: "goal", team: "home", player: "Saka", minute: 22 },
    ]},
    { ...FIXTURES_GW28[1], homeScore: 2, awayScore: 2, status: "live", minute: 67, events: [
      { type: "goal", team: "home", player: "Salah", minute: 12 },
      { type: "goal", team: "away", player: "Fernandes", minute: 31 },
      { type: "goal", team: "home", player: "Díaz", minute: 45 },
      { type: "goal", team: "away", player: "Rashford", minute: 58 },
    ]},
  ];

  return (
    <div style={{ paddingBottom: 90 }}>
      <Header title="Live Scores" subtitle="Gameweek 28" />

      {/* Live Now */}
      <div style={{ padding: "0 20px", marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: theme.danger,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: theme.danger,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Live Now
          </p>
        </div>

        {liveFixtures.map((fix, i) => {
          const home = teamById(fix.home);
          const away = teamById(fix.away);
          return (
            <Card
              key={i}
              onClick={() => setActiveFixture(activeFixture === i ? null : i)}
              style={{
                marginBottom: 8,
                padding: 0,
                overflow: "hidden",
                border: `1px solid ${theme.danger}20`,
                cursor: "pointer",
              }}
            >
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <TeamBadge team={home} size={36} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>
                      {home.short}
                    </span>
                  </div>
                  <div style={{ textAlign: "center", minWidth: 80 }}>
                    <p
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: theme.text,
                        margin: 0,
                        fontFamily: "'Outfit', sans-serif",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {fix.homeScore} - {fix.awayScore}
                    </p>
                    <span
                      style={{
                        fontSize: 11,
                        color: theme.danger,
                        fontWeight: 700,
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {fix.minute}'
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>
                      {away.short}
                    </span>
                    <TeamBadge team={away} size={36} />
                  </div>
                </div>
              </div>

              {/* Expanded match events */}
              {activeFixture === i && fix.events && (
                <div
                  style={{
                    borderTop: `1px solid ${theme.border}`,
                    padding: "12px 16px",
                    background: theme.bgElevated,
                  }}
                >
                  {fix.events.map((evt, j) => (
                    <div
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 0",
                        justifyContent: evt.team === "home" ? "flex-start" : "flex-end",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: theme.textDim,
                          fontFamily: "'DM Mono', monospace",
                          minWidth: 28,
                          textAlign: evt.team === "home" ? "left" : "right",
                        }}
                      >
                        {evt.minute}'
                      </span>
                      <span style={{ fontSize: 12 }}>⚽</span>
                      <span style={{ fontSize: 12, color: theme.text, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                        {evt.player}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Upcoming */}
      <div style={{ padding: "0 20px" }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.textDim,
            margin: "0 0 10px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Upcoming
        </p>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {FIXTURES_GW28.slice(2).map((fix, i, arr) => {
            const home = teamById(fix.home);
            const away = teamById(fix.away);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <TeamBadge team={home} size={26} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>
                    {home.short}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: theme.textDim,
                    fontFamily: "'DM Mono', monospace",
                    padding: "3px 8px",
                    background: theme.bgElevated,
                    borderRadius: 4,
                  }}
                >
                  {fix.time}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>
                    {away.short}
                  </span>
                  <TeamBadge team={away} size={26} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function ProfileScreen() {
  return (
    <div style={{ paddingBottom: 90 }}>
      <Header title="Profile" />

      <div style={{ padding: "0 20px" }}>
        {/* Profile Card */}
        <Card style={{ textAlign: "center", padding: 28, marginBottom: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: `linear-gradient(135deg, ${theme.accent}, #06B6D4)`,
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: theme.bg,
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            L
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
            Lee
          </p>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
            lee@example.com
          </p>
        </Card>

        {/* My Leagues */}
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: theme.textDim,
            margin: "0 0 10px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          My Leagues
        </p>

        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
          {[
            { name: "Office LMS 2025", players: 8, alive: 5, status: "alive" },
            { name: "Sunday League Lads", players: 24, alive: 3, status: "alive" },
            { name: "Family Xmas LMS", players: 6, alive: 1, status: "eliminated" },
          ].map((league, i, arr) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none",
                cursor: "pointer",
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: theme.text, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                  {league.name}
                </p>
                <p style={{ fontSize: 11, color: theme.textDim, margin: "2px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
                  {league.alive}/{league.players} alive
                </p>
              </div>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  background: league.status === "alive" ? theme.successGlow : theme.dangerGlow,
                  color: league.status === "alive" ? theme.success : theme.danger,
                  border: `1px solid ${league.status === "alive" ? theme.success : theme.danger}30`,
                }}
              >
                {league.status === "alive" ? "IN" : "OUT"}
              </div>
            </div>
          ))}
        </Card>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.accent}40`,
              background: theme.accentGlow,
              color: theme.accent,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textAlign: "left",
            }}
          >
            + Create New League
          </button>
          <button
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.borderLight}`,
              background: theme.bgCard,
              color: theme.text,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textAlign: "left",
            }}
          >
            Join League with Code
          </button>
          <button
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.borderLight}`,
              background: theme.bgCard,
              color: theme.text,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textAlign: "left",
            }}
          >
            Browse Public Leagues
          </button>
          <button
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.borderLight}`,
              background: theme.bgCard,
              color: theme.textMuted,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textAlign: "left",
            }}
          >
            Notification Settings
          </button>
          <button
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.borderLight}`,
              background: theme.bgCard,
              color: theme.textMuted,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textAlign: "left",
            }}
          >
            Help & Support
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App Shell ──

export default function LMSApp() {
  const [screen, setScreen] = useState("home");

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: theme.bg,
        position: "relative",
        fontFamily: "'DM Sans', sans-serif",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;600;700;800;900&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${theme.bg}; margin: 0; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        ::-webkit-scrollbar { width: 0; }
        
        button:active { transform: scale(0.97); }
      `}</style>

      {screen === "home" && <HomeScreen setScreen={setScreen} />}
      {screen === "pick" && <PickScreen setScreen={setScreen} />}
      {screen === "league" && <LeagueScreen />}
      {screen === "live" && <LiveScreen />}
      {screen === "profile" && <ProfileScreen />}

      <NavBar screen={screen} setScreen={setScreen} />
    </div>
  );
}
