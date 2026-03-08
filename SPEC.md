# Last Man Standing (LMS) App — Full Build Spec

Build a **Last Man Standing** football competition app from scratch using Node.js. This is a survival-pool game: each gameweek players pick one team to win, you can never reuse a team, if your pick doesn't win you're eliminated, last player standing wins.

---

## Tech Stack

- **Runtime:** Node.js 20+
- **API Framework:** Express.js with express-async-errors
- **Database:** PostgreSQL 16 via Prisma ORM
- **Auth:** JWT (access + refresh tokens), bcrypt for passwords
- **Real-time:** Socket.io for live score updates
- **Push Notifications:** Firebase Admin SDK (FCM)
- **Job Scheduling:** node-cron for fixture syncing, deadline reminders, result processing
- **Validation:** Zod schemas on all request bodies
- **Football Data (multi-provider architecture):**
  - **Primary — football-data.org** (free tier): Fixtures, results, teams, standings for the Premier League. 10 calls/min, no API cost. Used for all fixture syncing, result processing, and team data.
  - **Secondary — API-Football / api-sports.io** (free tier 100 req/day, paid $19/mo): Live scores updated every 15 seconds, match events (goals, cards, substitutions), and in-play data. Only called during active match windows to stay within free tier limits. Upgrade path to paid for production.
  - **Optional — The Odds API** (the-odds-api.com): Pre-match betting odds from UK bookmakers (h2h market). Used to show "pick difficulty" indicators on the Pick screen. Can be enabled/disabled via env var.
  - All three providers abstracted behind a common interface so any can be swapped or disabled independently.
- **Frontend:** React 18 + React Router + Tailwind CSS (mobile-first SPA, no SSR needed)
- **Deployment target:** Docker Compose (postgres + api + frontend containers)

---

## Project Structure

```
lms/
├── docker-compose.yml
├── .env.example
│
├── api/
│   ├── package.json
│   ├── tsconfig.json              # Use TypeScript throughout
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts                # Seed 20 PL teams for 2025/26
│   ├── src/
│   │   ├── index.ts               # Express app + Socket.io init
│   │   ├── config/
│   │   │   ├── env.ts             # Zod-validated env vars
│   │   │   ├── db.ts              # Prisma client singleton
│   │   │   └── firebase.ts        # Firebase Admin init
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verification middleware
│   │   │   ├── validate.ts        # Zod validation middleware factory
│   │   │   └── errorHandler.ts    # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.ts            # register, login, refresh, me
│   │   │   ├── leagues.ts         # CRUD, join, invite, public browse
│   │   │   ├── picks.ts          # submit pick, get my picks, get league picks
│   │   │   ├── fixtures.ts       # gameweek fixtures, live scores
│   │   │   └── teams.ts          # list all teams
│   │   ├── services/
│   │   │   ├── providers/
│   │   │   │   ├── types.ts           # Shared interfaces for all providers
│   │   │   │   ├── footballData.ts    # football-data.org — fixtures, results, teams
│   │   │   │   ├── apiFootball.ts     # API-Football — live scores, match events
│   │   │   │   └── oddsApi.ts         # The Odds API — pre-match betting odds
│   │   │   ├── fixtureSync.ts         # Cron: sync fixtures + results (football-data.org)
│   │   │   ├── resultProcessor.ts     # Process finished matches → eliminate players
│   │   │   ├── notifications.ts       # FCM push + deadline reminders
│   │   │   └── liveScores.ts          # Poll live scores (API-Football) → Socket.io broadcast
│   │   ├── sockets/
│   │   │   └── index.ts           # Socket.io connection + room management
│   │   └── utils/
│   │       ├── gameweek.ts        # Calculate current GW, deadlines
│   │       └── errors.ts          # Custom error classes
│   └── tests/
│       ├── picks.test.ts
│       ├── resultProcessor.test.ts
│       └── leagues.test.ts
│
└── web/
    ├── package.json
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx                 # Router + auth context
        ├── api/                    # Fetch wrapper + hooks
        │   ├── client.ts           # Axios instance with JWT interceptor
        │   └── hooks/
        │       ├── useAuth.ts
        │       ├── useLeagues.ts
        │       ├── usePicks.ts
        │       ├── useFixtures.ts       # includes odds data when available
        │       └── useLiveScores.ts     # Socket.io hook (degrades gracefully without API-Football)
        ├── context/
        │   └── AuthContext.tsx
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   ├── HomePage.tsx
        │   ├── PickPage.tsx
        │   ├── LeaguePage.tsx
        │   ├── LivePage.tsx
        │   ├── ProfilePage.tsx
        │   ├── CreateLeaguePage.tsx
        │   └── JoinLeaguePage.tsx
        ├── components/
        │   ├── NavBar.tsx
        │   ├── TeamBadge.tsx
        │   ├── FixtureCard.tsx
        │   ├── PlayerRow.tsx
        │   ├── CountdownTimer.tsx
        │   └── ConfirmModal.tsx
        └── lib/
            └── socket.ts           # Socket.io client singleton
```

---

## Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  displayName   String
  passwordHash  String
  fcmToken      String?
  createdAt     DateTime @default(now())

  leagueMemberships LeagueMember[]
  picks             Pick[]
  createdLeagues    League[]       @relation("LeagueCreator")
}

model Team {
  id              Int      @id
  fdoId           Int      @unique          // football-data.org team ID
  apiFootballId   Int?     @unique          // API-Football team ID (nullable, mapped on first sync)
  name            String
  shortName       String                    // 3-letter code e.g. "ARS"
  crestUrl        String?
  createdAt       DateTime @default(now())

  homeFixtures  Fixture[] @relation("HomeTeam")
  awayFixtures  Fixture[] @relation("AwayTeam")
  picks         Pick[]
}

model League {
  id          String       @id @default(cuid())
  name        String
  code        String       @unique        // 6-char invite code
  season      String       @default("2025-26")
  competition String       @default("PL") // competition code
  isPublic    Boolean      @default(false)
  status      LeagueStatus @default(ACTIVE)
  creatorId   String
  creator     User         @relation("LeagueCreator", fields: [creatorId], references: [id])
  createdAt   DateTime     @default(now())

  members     LeagueMember[]
  picks       Pick[]
}

model LeagueMember {
  id                String       @id @default(cuid())
  leagueId          String
  userId            String
  status            PlayerStatus @default(ALIVE)
  eliminatedGameweek Int?
  joinedAt          DateTime     @default(now())

  league  League @relation(fields: [leagueId], references: [id])
  user    User   @relation(fields: [userId], references: [id])

  @@unique([leagueId, userId])
}

model Pick {
  id        String     @id @default(cuid())
  leagueId  String
  userId    String
  gameweek  Int
  teamId    Int
  result    PickResult @default(PENDING)
  createdAt DateTime   @default(now())

  league  League @relation(fields: [leagueId], references: [id])
  user    User   @relation(fields: [userId], references: [id])
  team    Team   @relation(fields: [teamId], references: [id])

  @@unique([leagueId, userId, gameweek])  // one pick per player per GW
  @@unique([leagueId, userId, teamId])    // can't reuse a team
}

model Fixture {
  id              String        @id @default(cuid())
  fdoId           Int           @unique     // football-data.org match ID
  apiFootballId   Int?          @unique     // API-Football fixture ID (mapped on first live sync)
  competition     String        @default("PL")
  gameweek        Int
  homeTeamId      Int
  awayTeamId      Int
  homeScore       Int?
  awayScore       Int?
  status          FixtureStatus @default(SCHEDULED)
  kickoffTime     DateTime
  minute          Int?                      // live match minute (from API-Football)
  homeOdds        Float?                    // pre-match h2h odds (from The Odds API)
  drawOdds        Float?
  awayOdds        Float?
  oddsUpdatedAt   DateTime?
  updatedAt       DateTime      @updatedAt

  homeTeam  Team @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam  Team @relation("AwayTeam", fields: [awayTeamId], references: [id])

  events    MatchEvent[]

  @@index([gameweek])
  @@index([kickoffTime])
}

model MatchEvent {
  id          String   @id @default(cuid())
  fixtureId   String
  type        String                       // "goal", "red_card", "yellow_card", "substitution"
  minute      Int
  teamSide    String                       // "home" or "away"
  playerName  String?
  detail      String?                      // e.g. "Penalty", "Own Goal"
  createdAt   DateTime @default(now())

  fixture     Fixture  @relation(fields: [fixtureId], references: [id])

  @@index([fixtureId])
}

enum LeagueStatus {
  ACTIVE
  COMPLETED
}

enum PlayerStatus {
  ALIVE
  ELIMINATED
  WINNER
}

enum PickResult {
  PENDING
  WON
  LOST
  DRAWN
}

enum FixtureStatus {
  SCHEDULED
  LIVE
  FINISHED
  POSTPONED
}
```

---

## API Routes — Detailed Spec

### Auth

```
POST /api/auth/register
  Body: { email, displayName, password }
  Returns: { user, accessToken, refreshToken }

POST /api/auth/login
  Body: { email, password }
  Returns: { user, accessToken, refreshToken }

POST /api/auth/refresh
  Body: { refreshToken }
  Returns: { accessToken, refreshToken }

GET /api/auth/me
  Auth: required
  Returns: { user }

PUT /api/auth/fcm-token
  Auth: required
  Body: { fcmToken }
  Returns: { success: true }
```

### Teams

```
GET /api/teams
  Returns: { teams: Team[] }
```

### Leagues

```
POST /api/leagues
  Auth: required
  Body: { name, isPublic? }
  Logic: Generate random 6-char uppercase invite code. Creator auto-joins as member.
  Returns: { league }

GET /api/leagues
  Auth: required
  Returns: { leagues: League[] }  // leagues the user is a member of

GET /api/leagues/public
  Auth: required
  Returns: { leagues: League[] }  // public leagues user can join

GET /api/leagues/:id
  Auth: required (must be member)
  Returns: { league, members (with status + pick count), currentGameweek }

POST /api/leagues/:id/join
  Auth: required
  Body: { code }
  Logic: Validate invite code matches. Add user as ALIVE member.
         Reject if league status is COMPLETED.
  Returns: { membership }

DELETE /api/leagues/:id/leave
  Auth: required
  Logic: Remove membership. If creator leaves, assign to next member or delete league.
```

### Picks

```
POST /api/leagues/:leagueId/picks
  Auth: required
  Body: { teamId }
  Validation (ALL must pass or reject with clear error message):
    1. User is a member of this league with status = ALIVE
    2. teamId has not been used by this user in this league (@@unique handles this)
    3. Current time is before the deadline (earliest kickoff of the gameweek)
    4. teamId is playing a fixture in the current gameweek
    5. The specific fixture containing teamId has not already kicked off
  Logic: Upsert — if user already has a pick for this GW, update it (only before deadline).
  Returns: { pick }

GET /api/leagues/:leagueId/picks/mine
  Auth: required
  Returns: { picks: Pick[], availableTeams: Team[] }
  availableTeams = all teams MINUS teams user has already picked in this league

GET /api/leagues/:leagueId/picks?gameweek=N
  Auth: required (must be member)
  Logic: Only reveal other players' picks AFTER the gameweek deadline has passed.
         Before deadline, return only the requesting user's own pick.
  Returns: { picks: Pick[], revealed: boolean }
```

### Fixtures

```
GET /api/fixtures?gameweek=N
  Returns: { fixtures: Fixture[], deadline: DateTime }
  deadline = earliest kickoff time in the gameweek

GET /api/fixtures/current-gameweek
  Returns: { gameweek: number, deadline: DateTime, status: "pre" | "active" | "complete" }
```

---

## Core Services — Detailed Logic

### Football Data Sync (`fixtureSync.ts`)

```
The system uses THREE data providers, each with a specific role:

═══════════════════════════════════════════════════════════════════
PROVIDER 1: football-data.org (PRIMARY — fixtures, results, teams)
═══════════════════════════════════════════════════════════════════
Base URL: https://api.football-data.org/v4
Auth: X-Auth-Token header
Rate limit: 10 requests/minute (free tier)
Premier League competition code: "PL"

Key endpoints used:
  GET /v4/competitions/PL/matches?season=2025  → all fixtures for season
  GET /v4/competitions/PL/matches?matchday=N   → fixtures for a gameweek
  GET /v4/competitions/PL/teams?season=2025     → all teams with crests
  GET /v4/competitions/PL/standings             → league table

Response mapping:
  match.id         → Fixture.fdoId
  match.matchday   → Fixture.gameweek
  match.homeTeam.id → lookup Team by fdoId
  match.score.fullTime.home → Fixture.homeScore
  match.status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED"
    Map: SCHEDULED/TIMED → SCHEDULED, IN_PLAY/PAUSED → LIVE, FINISHED → FINISHED, POSTPONED → POSTPONED

Cron Jobs:
  1. Daily at 04:00 UTC — Full season fixture sync (upsert all matches by fdoId)
  2. Every 5 minutes during match windows — Check for newly FINISHED matches
     A "match window" = any day where a fixture has kickoffTime within last 4 hours
     When a fixture transitions to FINISHED → update scores → trigger resultProcessor
  3. On startup — Full fixture + team sync

═══════════════════════════════════════════════════════════════════
PROVIDER 2: API-Football / api-sports.io (LIVE SCORES + EVENTS)
═══════════════════════════════════════════════════════════════════
Base URL: https://v3.football.api-sports.io
Auth: x-apisports-key header
Rate limit: 100 requests/day (free), 7500/day ($19/mo)

Key endpoints used:
  GET /fixtures?league=39&season=2025&live=all  → all live PL matches
  GET /fixtures?league=39&season=2025&round=Regular Season - 28  → GW fixtures
  GET /fixtures/events?fixture={id}             → match events (goals, cards)

Response mapping:
  fixture.fixture.id      → Fixture.apiFootballId
  fixture.goals.home      → live homeScore
  fixture.goals.away      → live awayScore
  fixture.fixture.status.elapsed → Fixture.minute
  events[].type           → MatchEvent.type ("Goal", "Card", "subst")
  events[].player.name    → MatchEvent.playerName
  events[].time.elapsed   → MatchEvent.minute
  events[].team.id        → determine teamSide by matching to home/away

Team ID mapping:
  On first sync, match API-Football teams to our Team records by name similarity.
  Store the mapping in Team.apiFootballId so future lookups are instant.
  PL league ID in API-Football = 39.

Budget management (free tier):
  - Only poll when there are LIVE or recently-started matches
  - Poll every 60 seconds during active matches (max ~90 calls per match window)
  - Skip polling entirely on non-match days
  - Log daily request count; warn at 80 requests, stop at 95
  - If LIVE_SCORES_PROVIDER env var is unset, skip entirely and rely on football-data.org
    for delayed score updates (5-minute lag but still functional)

Cron: Every 60 seconds (conditionally):
  1. Check: are there any fixtures with kickoffTime in last 3 hours that aren't FINISHED?
  2. If no → skip (save API calls)
  3. If yes → fetch live scores from API-Football
  4. For each match with changed score → update DB + broadcast via Socket.io
  5. For each new event (goal, card) → upsert MatchEvent + broadcast "matchEvent"

═══════════════════════════════════════════════════════════════════
PROVIDER 3: The Odds API (OPTIONAL — pre-match betting odds)
═══════════════════════════════════════════════════════════════════
Base URL: https://api.the-odds-api.com/v4
Auth: apiKey query parameter
Sport key: soccer_epl

Key endpoints used:
  GET /v4/sports/soccer_epl/odds?regions=uk&markets=h2h  → odds from UK bookmakers

Response mapping:
  Each game has bookmakers[].markets[].outcomes with name + price (decimal odds)
  Average across bookmakers for each outcome (home/draw/away) → store on Fixture

Cron: Once daily at 08:00 UTC on the day before each gameweek deadline
  1. Fetch EPL odds
  2. Match to our fixtures by team names + kickoff time
  3. Update Fixture.homeOdds, drawOdds, awayOdds, oddsUpdatedAt
  4. If ODDS_API_KEY env var is unset, skip entirely — odds are a nice-to-have

Frontend usage:
  On the Pick screen, show odds as a "difficulty" indicator next to each team:
  - Odds < 1.80 → green "Favourite" badge
  - Odds 1.80-2.50 → amber "Even" badge  
  - Odds > 2.50 → red "Risky" badge
  This helps players make informed picks without needing to check bookmaker sites.
```

### Provider Interface (`services/providers/types.ts`)

```typescript
// All providers implement focused interfaces — no god-object

interface FixtureProvider {
  getSeasonFixtures(competition: string, season: string): Promise<RawFixture[]>
  getGameweekFixtures(competition: string, gameweek: number): Promise<RawFixture[]>
  getTeams(competition: string, season: string): Promise<RawTeam[]>
}

interface LiveScoreProvider {
  getLiveMatches(competition: string): Promise<RawLiveMatch[]>
  getMatchEvents(externalMatchId: number): Promise<RawMatchEvent[]>
}

interface OddsProvider {
  getPreMatchOdds(sportKey: string, regions: string): Promise<RawOddsMatch[]>
}

// Each provider file exports a class implementing its interface.
// The fixtureSync service uses FixtureProvider (football-data.org).
// The liveScores service uses LiveScoreProvider (API-Football).
// The odds sync uses OddsProvider (The Odds API).
// If a provider's API key is missing, the service logs a warning and becomes a no-op.
```

### Result Processor (`resultProcessor.ts`)

```
function processGameweekResults(gameweek: number):
  
  // Only run when ALL fixtures in the gameweek are FINISHED
  const fixtures = await getFixturesByGameweek(gameweek)
  if (fixtures.some(f => f.status !== FINISHED)) return // not ready yet
  
  const activeLeagues = await getActiveLeagues()
  
  for each league:
    const aliveMembers = await getAliveMembers(league.id)
    
    for each member:
      const pick = await getPick(league.id, member.userId, gameweek)
      
      if (!pick):
        // NO PICK = ELIMINATED (missed the deadline)
        eliminate(member, gameweek)
        sendPush(member, "You were eliminated for not making a pick in GW{gameweek}")
        continue
      
      const fixture = findFixtureForTeam(pick.teamId, gameweek)
      const result = calculateResult(fixture, pick.teamId)
      // WON = team won the match, LOST = team lost, DRAWN = match drawn
      
      updatePickResult(pick.id, result)
      
      if (result !== WON):
        eliminate(member, gameweek)
        sendPush(member, "{teamName} didn't win — you've been eliminated from {leagueName}")
      else:
        sendPush(member, "{teamName} won! You survive to GW{gameweek + 1}")
    
    // Check end conditions
    const remainingAlive = countAlive(league.id)
    
    if (remainingAlive === 1):
      // WE HAVE A WINNER
      const winner = getAliveMembers(league.id)[0]
      setWinner(winner)
      setLeagueStatus(league.id, COMPLETED)
      sendPush(winner, "You won {leagueName}! Last Man Standing!")
      notifyAllMembers(league.id, "{winnerName} has won the league!")
    
    if (remainingAlive === 0):
      // EVERYONE ELIMINATED IN SAME GAMEWEEK
      // Rule: league ends with no winner (or restart — make this configurable)
      setLeagueStatus(league.id, COMPLETED)
      notifyAllMembers(league.id, "All remaining players eliminated — no winner this time!")

function calculateResult(fixture, teamId):
  if fixture.status === POSTPONED: return WON  // survive postponed matches
  const isHome = fixture.homeTeamId === teamId
  const teamScore = isHome ? fixture.homeScore : fixture.awayScore
  const oppScore = isHome ? fixture.awayScore : fixture.homeScore
  if teamScore > oppScore: return WON
  if teamScore === oppScore: return DRAWN
  return LOST
```

### Notifications (`notifications.ts`)

```
Cron Jobs:
  1. Friday 09:00 UTC — "Reminder: Make your GW{N} pick! Deadline: {deadline}"
     Target: All ALIVE members across all active leagues who haven't picked yet
  
  2. 2 hours before deadline — "Last chance! Pick closes at {deadline}"
     Target: Same as above
  
  3. 30 minutes before deadline — "Final warning! {time} left to make your pick"
     Target: Same as above

Event-driven pushes (goal/concede alerts require API-Football to be configured):
  - Pick confirmed: "Locked in: {teamName} for GW{N}"
  - Match kicks off with your pick: "{teamName} vs {opponent} has kicked off — good luck!"
  - Your pick team scores: "GOAL! {teamName} {score} - {oppScore} {opponent}" (API-Football only)
  - Your pick team concedes: "{opponent} equalise! {teamName} {score} - {oppScore} {opponent}" (API-Football only)
  - Result: eliminated or survived (see resultProcessor above)
  - League winner declared

Note: If Firebase credentials are not configured, all notifications should log to console
instead of sending push notifications. This keeps development frictionless.
```

### Live Scores Socket.io (`sockets/index.ts`)

```
Server events (emitted TO clients):
  "scoreUpdate"     → { fixtureId, homeScore, awayScore, minute, status }
  "matchEvent"      → { fixtureId, type: "goal"|"red_card"|"halftime"|"fulltime", detail }
  "pickResult"      → { leagueId, gameweek, userId, result }  // when match finishes

Client events (received FROM clients):
  "joinLeague"      → subscribe to league room for pick reveals
  "leaveLeague"     → unsubscribe
  "followGameweek"  → subscribe to all fixtures in a gameweek

Rooms:
  "league:{leagueId}"       — league-specific events
  "fixture:{fixtureId}"     — single match updates
  "gameweek:{gw}"           — all matches in a gameweek
```

---

## Frontend — Screen-by-Screen Spec

The UI is a dark-themed mobile-first SPA at max-width 430px, centered on desktop. Dark navy background (#0A0E17), card backgrounds (#111827), cyan accent (#22D3EE). Fonts: Outfit for headings (800 weight), DM Sans for body text. All cards have 16px border-radius, subtle 1px borders.

### Bottom Navigation Bar
5 tabs: Home (⌂), Pick (✦), League (☰), Live (●), Profile (◉). Fixed at bottom. Active tab highlighted in cyan. Frosted glass background effect.

### 1. Home Screen (`/`)
- **Status hero card** at top: gradient border, shows "You're still in — Gameweek {N}" with a large checkmark icon if alive, or "Eliminated — GW{N}" in red if out.
- **Three stat cards** in a row: "Alive" (X/Y players), "Teams Left" (how many you can still pick), "Deadline" (countdown timer to next deadline, live ticking).
- **CTA button**: "Make Your GW{N} Pick →" — full-width cyan gradient button. Only shows if user hasn't picked yet for current GW. If already picked, show the pick instead with a checkmark.
- **Your pick history**: Horizontal row of team badge pills showing every team you've used this season, in order. Each pill has the team crest/color badge + 3-letter code + green tick or red X.
- **Upcoming fixtures**: List of current gameweek fixtures. Each row: home badge + code, kickoff time in the center, away badge + code. "View all fixtures →" link at bottom.

### 2. Pick Screen (`/pick`)
- **Header**: "Make Your Pick — Gameweek {N}" with deadline shown.
- **Selection preview card**: Large card at top. Before selection: dashed circle with "?" and "Select a team below". After selection: shows the team badge large (64px), team name, and the opponent + H/A indicator.
- **Team grid**: 4-column grid of all 20 teams. Each tile shows: coloured circle badge, 3-letter code, H/A indicator, day of match. **Already-used teams are greyed out at 25% opacity with a ✗ mark and are not tappable.** Selected team has cyan border glow. **If odds data is available** (The Odds API enabled), show a small difficulty badge on each tile: green "Fav" for odds < 1.80, amber "Even" for 1.80–2.50, red "Risky" for > 2.50. If odds are not available, omit the badge entirely — never show empty or broken states.
- **Confirm button**: Only appears after selecting a team. "Confirm {TeamName} →" — cyan gradient. Below it: "You won't be able to change this after confirmation" in muted text.
- **Confirmation flow**: On tap, show a modal: "Lock in {TeamName} for GW{N}?" with Cancel and Confirm buttons. On confirm, show a success animation (large green tick, "Pick Locked In!", team name) for 1.5 seconds, then redirect to Home.
- **Deadline enforcement**: If deadline has passed, show "Deadline has passed" message instead of the grid. If a specific fixture has kicked off but the GW deadline hasn't passed yet, grey out those teams with "Kicked off" label.

### 3. League Screen (`/league/:id`)
- **Header**: League name, player count, invite button (copies invite code to clipboard with toast notification).
- **Two tabs**: "Standings" and "History".
- **Standings tab**:
  - "Still Standing (N)" section with green dot: Cards for each alive player showing avatar initial, name, picks used count, last 3 team badges. If they've picked for current GW and deadline has passed, show their current pick. If they haven't picked yet, show nothing (don't reveal).
  - For the current user: if no pick made, show orange warning banner "⚠ You haven't picked yet for GW{N}!"
  - "Eliminated (N)" section with red dot: Same cards but faded at 60% opacity with ✗ icon, showing "Out GW{N}" and pick count.
- **History tab**: Gameweek-by-gameweek breakdown. Each GW section shows all players' picks for that week with team badge, name, and ✓/✗ result. Scrollable, most recent GW at top.

### 4. Live Screen (`/live`)
- **Header**: "Live Scores — Gameweek {N}".
- **"Live Now" section** (pulsing red dot): Expanded match cards for in-progress matches. Each shows: home/away badges and codes, large bold score (e.g. "2 - 1"), match minute with red text (sourced from API-Football when available, otherwise omitted). Tappable to expand and show match events timeline from the MatchEvent table (goals, cards, substitutions) with player name, minute, and event icon. Events aligned to left (home) or right (away) side. If API-Football is not configured, the Live screen still works but shows scores from football-data.org with a ~5 minute delay and no events timeline — display a subtle note: "Scores update every few minutes" instead of the pulsing live dot.
- **"Upcoming" section**: Compact fixture list for matches not yet started. Same format as Home screen fixtures. If odds data is available, show odds as small decimal numbers (e.g. "1.57 — 4.00 — 5.50") under each fixture.
- **"Full Time" section**: Finished matches with final scores in bold.
- **Real-time updates**: Scores update via Socket.io without page refresh. Brief flash animation on score change.

### 5. Profile Screen (`/profile`)
- **Profile card**: Avatar circle with initial, display name, email.
- **My Leagues list**: All leagues the user belongs to. Each row: league name, "X/Y alive" subtitle, and status badge — green "IN" pill if alive, red "OUT" pill if eliminated.
- **Action buttons** (full-width, stacked):
  - "+ Create New League" — cyan outline style
  - "Join League with Code" — opens input modal for 6-char code
  - "Browse Public Leagues" — navigates to public league listing
  - "Notification Settings" — toggle switches for different notification types
  - "Help & Support"
  - "Sign Out" — at the very bottom, muted/danger style

### 6. Create League Page (`/create-league`)
- Form with: League name input, Public/Private toggle, competition selector (default: Premier League).
- On create: Show the generated invite code prominently with a copy button and share options.

### 7. Join League Page (`/join`)
- Single input field for 6-character invite code (auto-uppercase, auto-focus).
- Shows league preview (name, player count, status) before confirming join.

### 8. Auth Pages (`/login`, `/register`)
- Clean, centered forms on the dark background. Logo/title at top.
- Login: email + password + "Sign In" button + link to register.
- Register: email + display name + password + confirm password + "Create Account" + link to login.
- Show validation errors inline below each field.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://lms:lms@localhost:5432/lms

# Auth
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ── Football Data Providers ──

# PRIMARY: football-data.org (fixtures, results, teams) — REQUIRED
# Free tier: 10 req/min, PL included. Get key at: https://www.football-data.org/client/register
FOOTBALL_DATA_ORG_API_KEY=your-fdo-api-key
FOOTBALL_DATA_ORG_BASE_URL=https://api.football-data.org/v4

# SECONDARY: API-Football (live scores, match events) — OPTIONAL
# Free tier: 100 req/day. Paid: $19/mo for 7500/day. Get key at: https://dashboard.api-football.com
# If unset, live scores fall back to football-data.org polling (5-min delay instead of 60-sec)
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_DAILY_LIMIT=100

# OPTIONAL: The Odds API (pre-match betting odds for pick difficulty indicators)
# Free tier: 500 req/mo. Get key at: https://the-odds-api.com
# If unset, odds features are hidden in the UI
ODDS_API_KEY=
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4

# Firebase (for push notifications) — OPTIONAL
# If unset, notifications are logged to console instead of sent
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# App
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

---

## Implementation Order

Build and test in this sequence. Each step should be fully working before moving on.

1. **Project scaffolding** — Init both `api/` and `web/` packages, configure TypeScript, set up Docker Compose with PostgreSQL.
2. **Database + Prisma** — Schema (including MatchEvent model), migrations, seed script (20 PL teams with real football-data.org IDs, names, short codes, crest URLs). Include a team mapping file that also holds API-Football IDs for each PL team.
3. **Auth system** — Register, login, refresh, JWT middleware. Test with Postman/curl.
4. **Provider interfaces + football-data.org** — Build `services/providers/types.ts` with FixtureProvider, LiveScoreProvider, and OddsProvider interfaces. Implement `footballData.ts` (football-data.org) for FixtureProvider. Build `fixtureSync.ts` cron jobs and `utils/gameweek.ts`. Build routes for teams and fixtures. If no API key is set, seed 10 gameweeks of realistic test fixtures so we can develop against mock data.
5. **League CRUD** — Create, list, get details, join with code, public browse.
6. **Pick system** — Submit pick with all validations, get my picks + available teams, get league picks with deadline-gated reveal.
7. **Result processor** — Process gameweek results, eliminate players, detect winners. Write thorough unit tests for edge cases (postponements, all-eliminated, etc).
8. **Notifications** — FCM setup (optional — log to console if no Firebase credentials), reminder crons, event-driven pushes.
9. **API-Football live scores** — Implement `apiFootball.ts` as LiveScoreProvider. Build `liveScores.ts` service with conditional polling (only during match windows), daily budget tracking, and graceful fallback to football-data.org if API_FOOTBALL_KEY is unset. Build Socket.io room management and score broadcasting. Store match events in MatchEvent table.
10. **The Odds API (optional)** — Implement `oddsApi.ts` as OddsProvider. Add daily odds sync cron. Update fixture records with homeOdds/drawOdds/awayOdds. Skip entirely if ODDS_API_KEY is unset.
11. **Frontend: Auth + routing** — Login/register pages, JWT context, protected routes.
12. **Frontend: Home + Pick screens** — The core user experience. Include odds-based difficulty badges on Pick screen (conditionally rendered only when odds data exists).
13. **Frontend: League screen** — Standings + history.
14. **Frontend: Live screen** — Socket.io integration, real-time scores, match events timeline.
15. **Frontend: Profile + league management** — Create, join, browse leagues.
16. **Polish** — Loading states, error handling, empty states, animations, PWA manifest.

---

## Edge Cases to Handle

- **Postponed matches**: If a fixture is postponed, anyone who picked that team SURVIVES (treated as a win for survival purposes). The pick still counts as "used" for that team.
- **Double gameweeks**: A team may play twice. The pick applies to the FIRST fixture in the gameweek only.
- **Blank gameweeks**: A team may not play. Prevent picking a team with no fixture.
- **All eliminated**: If all remaining players are knocked out in the same GW, the league ends with no winner.
- **Late fixture updates**: The API might be slow to update. Only process results when ALL fixtures in the GW are FINISHED. Add a manual override endpoint for admins.
- **Mid-season joiners**: Allow joining before a configurable cutoff (e.g. GW5). They can pick any team in their first week — they don't retroactively need to have unique picks for earlier weeks.
- **Concurrent picks**: The unique constraint `@@unique([leagueId, userId, gameweek])` handles race conditions at the DB level. Use a transaction for the full pick validation.

---

## Testing Requirements

- Unit tests for `resultProcessor` covering: win, loss, draw, no pick, postponed match, all eliminated, single winner, last-two-standing where one loses.
- Unit tests for pick validation: used team rejection, deadline enforcement, fixture existence check.
- Integration tests for the pick → result → elimination flow end-to-end.
- Use Vitest for both API and frontend tests.
