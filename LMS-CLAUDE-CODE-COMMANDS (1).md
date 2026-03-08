# LMS App — Claude Code Commands (Step by Step)

Save `SPEC.md` (the build spec) in your project root first, then paste each command into Claude Code one at a time. Wait for each step to be fully working before moving to the next.

---

## Step 1 — Project Scaffolding

```
Read SPEC.md. Do step 1 only: project scaffolding. Create a monorepo with an `api/` folder (Node.js + TypeScript + Express) and a `web/` folder (React 18 + Vite + TypeScript + Tailwind CSS). Set up tsconfig.json in both. Create a docker-compose.yml with a PostgreSQL 16 container (user: lms, password: lms, db: lms, port 5432). Create .env.example with all the env vars from the spec — note there are three football data providers (football-data.org, API-Football, The Odds API) with the secondary ones being optional. Add a root package.json with scripts to start both api and web. Don't build any features yet — just the skeleton that compiles and runs.
```

## Step 2 — Database + Prisma

```
Read SPEC.md. Do step 2 only: database and Prisma setup. Install Prisma in the api/ folder. Create the full schema.prisma exactly as specified in the spec — this includes User, Team, League, LeagueMember, Pick, Fixture, and MatchEvent models with all enums. Note the Team model has both fdoId (football-data.org) and apiFootballId (nullable) fields. The Fixture model has fdoId, apiFootballId (nullable), minute, homeOdds/drawOdds/awayOdds (nullable), and a relation to MatchEvent. Run the migration. Then create prisma/seed.ts that seeds all 20 Premier League 2025/26 teams with their real football-data.org IDs (fdoId), full names, 3-letter short codes, and crest URLs. Also include a mapping of API-Football team IDs for each PL team (league 39) so we can populate apiFootballId. Run the seed and verify.
```

## Step 3 — Auth System

```
Read SPEC.md. Do step 3 only: auth system. Build these files: config/env.ts (Zod-validated env vars — all three provider API keys should be optional), config/db.ts (Prisma client singleton), middleware/auth.ts (JWT verification middleware), middleware/errorHandler.ts (global error handler), routes/auth.ts. Implement all 4 auth endpoints from the spec: POST /api/auth/register, POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me. Use bcrypt for passwords and JWT access + refresh tokens. Wire everything into index.ts with CORS. Test with curl commands and show me the curl commands to verify.
```

## Step 4 — Provider Interfaces + football-data.org

```
Read SPEC.md. Do step 4: provider interfaces and the primary football-data.org integration. Build services/providers/types.ts with three interfaces: FixtureProvider (getSeasonFixtures, getGameweekFixtures, getTeams), LiveScoreProvider (getLiveMatches, getMatchEvents), and OddsProvider (getPreMatchOdds). Then implement services/providers/footballData.ts as the FixtureProvider using the football-data.org v4 API. Map their match.status values to our FixtureStatus enum as specified in the spec. Build services/fixtureSync.ts with cron jobs: daily full sync at 04:00 UTC, every-5-minutes check for FINISHED matches during match windows, and full sync on startup. Build utils/gameweek.ts to calculate current gameweek and deadline. Build routes/teams.ts (GET /api/teams) and routes/fixtures.ts (GET /api/fixtures?gameweek=N, GET /api/fixtures/current-gameweek). If FOOTBALL_DATA_ORG_API_KEY is not set, generate and seed 10 gameweeks of realistic mock fixtures so development works without an API key. Wire up all routes and test.
```

## Step 5 — League CRUD

```
Read SPEC.md. Do step 5: league CRUD. Build routes/leagues.ts with all league endpoints from the spec: POST /api/leagues (create with random 6-char code, auto-join creator), GET /api/leagues (user's leagues), GET /api/leagues/public (browsable public leagues), GET /api/leagues/:id (full details with members and statuses), POST /api/leagues/:id/join (validate invite code), DELETE /api/leagues/:id/leave. Add the Zod validation middleware. All routes require auth. Test by creating a league, getting the invite code, registering a second user, and joining with the code. Show me the curl commands.
```

## Step 6 — Pick System

```
Read SPEC.md. Do step 6: the pick system. Build routes/picks.ts with all three pick endpoints. For POST /api/leagues/:leagueId/picks — implement ALL 5 validations: (1) user is ALIVE member, (2) team not already used via the unique constraint, (3) before the gameweek deadline, (4) team is playing this gameweek, (5) the specific fixture hasn't kicked off yet. Use a Prisma transaction for the full validation + insert. Implement upsert so picks can be changed before deadline. For GET picks/mine, return picks plus availableTeams (all teams minus used ones). For GET picks with gameweek param, implement deadline-gated reveal — only show other players' picks after deadline. Write Vitest unit tests for: used team rejection, deadline enforcement, team not playing, and successful pick.
```

## Step 7 — Result Processor

```
Read SPEC.md. Do step 7: result processor. Build services/resultProcessor.ts exactly matching the pseudocode in the spec. It must: (1) only run when ALL fixtures in the gameweek are FINISHED, (2) loop through all active leagues, (3) for each alive member check their pick, (4) no pick = eliminated, (5) calculate WON/LOST/DRAWN, (6) eliminate on loss or draw, (7) detect single winner and set WINNER status + COMPLETED league, (8) handle all-eliminated (no winner), (9) postponed matches = survive. Hook it into fixtureSync so it triggers automatically when the last fixture in a GW transitions to FINISHED. Write thorough Vitest tests covering: team wins (survive), team loses (eliminated), team draws (eliminated), no pick submitted (eliminated), postponed match (survive), all remaining players eliminated same GW (no winner), exactly one survivor (winner declared), and last-two-standing where one loses and one wins.
```

## Step 8 — Notifications

```
Read SPEC.md. Do step 8: push notifications. Build config/firebase.ts — initialise Firebase Admin SDK but make it OPTIONAL. If Firebase env vars are not set, log a warning on startup and make all push functions log to console instead. Build services/notifications.ts with: (1) a sendPush(userId, {title, body}) helper, (2) the three reminder crons (Friday 09:00 UTC, 2h before deadline, 30min before deadline) targeting ALIVE members who haven't picked, (3) event-driven push functions for: pick confirmed, match kick off, eliminated, survived, league winner declared. Note: goal alerts (your team scores/concedes) will be wired up in step 9 since they depend on API-Football. Wire the event-driven pushes into the result processor.
```

## Step 9 — API-Football Live Scores

```
Read SPEC.md. Do step 9: API-Football live score integration. Build services/providers/apiFootball.ts implementing the LiveScoreProvider interface. Use the api-sports.io v3 API — PL league ID is 39. Map their fixture IDs to our Fixture.apiFootballId. Build services/liveScores.ts with CONDITIONAL polling: only poll every 60 seconds when there are active matches (kickoff in last 3 hours, not yet FINISHED). Implement daily budget tracking — log request count, warn at 80/day, stop at 95/day on free tier. When scores change, update the DB and broadcast via Socket.io. When new events come in (goals, cards), upsert into the MatchEvent table and broadcast "matchEvent". Build sockets/index.ts with JWT-authenticated connections, room management (joinLeague, leaveLeague, followGameweek), and event emission. CRITICAL: if API_FOOTBALL_KEY is not set, the entire live score service should be a no-op — the app falls back to football-data.org's 5-minute polling for score updates. Also wire up the goal notification pushes (your team scores/concedes) here. Test the Socket.io connection with a simple client script.
```

## Step 10 — The Odds API (Optional)

```
Read SPEC.md. Do step 10: The Odds API integration for pre-match betting odds. Build services/providers/oddsApi.ts implementing the OddsProvider interface. Use the v4 API with sport key "soccer_epl" and regions "uk" for UK bookmaker odds. Fetch h2h (moneyline) market which returns home/draw/away prices in decimal format. Add a cron job that runs once daily at 08:00 UTC on the day before each gameweek deadline — fetch EPL odds, average across bookmakers for each outcome, match to our fixtures by team names + kickoff proximity, and update Fixture.homeOdds/drawOdds/awayOdds/oddsUpdatedAt. If ODDS_API_KEY is not set, skip entirely — the service should be a complete no-op with a startup log message saying "Odds API not configured, odds features disabled". Add a GET /api/fixtures/:gameweek/odds endpoint that returns odds data (or empty if not available). Test with curl.
```

## Step 11 — Frontend: Auth + Routing

```
Read SPEC.md. Do step 11: frontend auth and routing. In the web/ folder, set up React Router with these routes: /login, /register, / (home), /pick, /league/:id, /live, /profile, /create-league, /join. Build context/AuthContext.tsx with JWT token management (store in memory, not localStorage), auto-refresh, and a useAuth hook. Build api/client.ts as an Axios instance with a JWT interceptor that attaches the access token and auto-refreshes on 401. Build LoginPage and RegisterPage — clean centered forms on dark background (#0A0E17), Outfit font for title, DM Sans for body, cyan accent (#22D3EE). Show validation errors inline. After login/register redirect to home. Add a ProtectedRoute wrapper.
```

## Step 12 — Frontend: Home + Pick Screens

```
Read SPEC.md. Do step 12: Home and Pick screens — the two most important screens. Build them exactly matching the spec. For HomePage: status hero card, three stat cards (alive count, teams left, countdown timer that ticks live), CTA button (or current pick if already picked), pick history as team badge pills, fixtures list. For PickPage: selection preview card, 4-column team grid with greyed-out used teams, confirm button with modal, success animation. If odds data exists on the fixtures (homeOdds/awayOdds are not null), show a difficulty badge on each team tile: green "Fav" for odds < 1.80, amber "Even" for 1.80-2.50, red "Risky" for > 2.50. If odds data is null, simply don't show the badge — no empty states. Build shared components: NavBar (fixed bottom, 5 tabs, frosted glass), TeamBadge, FixtureCard, CountdownTimer, ConfirmModal. Style with Tailwind, mobile-first, max-width 430px centered.
```

## Step 13 — Frontend: League Screen

```
Read SPEC.md. Do step 13: League screen. Build LeaguePage matching the spec. Two tabs: Standings and History. Standings tab shows "Still Standing" section (green dot, alive player cards with avatar initial, name, picks used, last 3 team badges, current GW pick if revealed after deadline) and "Eliminated" section (red dot, faded cards). For the current user, show orange warning if they haven't picked. History tab shows gameweek-by-gameweek picks with ✓/✗ results. Build the invite button that copies league code to clipboard with toast. Build PlayerRow component. Fetch data with a useLeague hook.
```

## Step 14 — Frontend: Live Screen

```
Read SPEC.md. Do step 14: Live screen with Socket.io integration. Build lib/socket.ts as a Socket.io client singleton that authenticates with JWT. Build useLiveScores hook that joins the current gameweek room and listens for scoreUpdate and matchEvent events. The page has three sections: "Live Now" (expanded match cards with score + minute + tappable events timeline from MatchEvent data), "Upcoming" (compact rows — show odds as small decimal numbers under each fixture if available), "Full Time" (finished with bold scores). Flash-animate score changes. IMPORTANT: if the API isn't sending live data (no API-Football configured), the page should still work — show fixtures with scores from the DB updated every 5 minutes via polling, and instead of the pulsing red live dot, show a subtle note "Scores update every few minutes". The events timeline should gracefully show "No event data available" if MatchEvent table is empty for that fixture.
```

## Step 15 — Frontend: Profile + League Management

```
Read SPEC.md. Do step 15: Profile and league management screens. Build ProfilePage: avatar circle with initial, name, email, list of user's leagues with alive/eliminated status badges, and action buttons (create league, join with code, browse public, notification settings, help, sign out). Build CreateLeaguePage: form with league name, public/private toggle, submit. On success show invite code with copy button. Build JoinLeaguePage: single input for 6-char code (auto-uppercase, auto-focus), league preview before confirm. Sign out clears auth context and redirects to /login.
```

## Step 16 — Polish + PWA

```
Read SPEC.md. Do step 16: polish. Go through every screen and add: (1) loading skeleton states while data fetches — pulsing grey placeholders matching card layouts, (2) error states with retry buttons, (3) empty states — "No leagues yet" with CTA, "No fixtures this week", etc, (4) smooth page transitions, (5) a toast notification system for success/error (pick confirmed, invite copied, etc), (6) PWA manifest.json with app name "LMS", theme colour #0A0E17, icons for home screen, (7) service worker for offline caching of static assets. Also verify these graceful degradation scenarios: (a) no API-Football key → live page shows delayed scores with note, no events timeline, (b) no Odds API key → pick screen hides difficulty badges, live page hides odds under fixtures, (c) no Firebase credentials → notifications log to console. Review all edge cases from the spec: postponed matches shown with label, deadline-passed state on pick page, mid-season join flow.
```

---

## Bonus: Final Review

```
Read SPEC.md one final time. Review the entire codebase against the spec. Check: (1) all API routes exist and match the spec signatures, (2) all 5 pick validations are implemented, (3) the result processor handles every edge case, (4) the three-provider architecture works correctly — football-data.org as primary, API-Football as optional live scores, The Odds API as optional odds, (5) each optional provider gracefully degrades to a no-op when its API key is missing, (6) Socket.io rooms and events match the spec, (7) every frontend screen matches the screen-by-screen spec, (8) odds difficulty badges appear on Pick screen only when odds data exists. List anything missing or broken, then fix it.
```
