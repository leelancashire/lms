import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const premierLeagueTeams2025_26 = [
  { id: 57, fdoId: 57, apiFootballId: 42, name: "Arsenal FC", shortName: "ARS", crestUrl: "https://crests.football-data.org/57.png" },
  { id: 58, fdoId: 58, apiFootballId: 66, name: "Aston Villa FC", shortName: "AVL", crestUrl: "https://crests.football-data.org/58.png" },
  { id: 1044, fdoId: 1044, apiFootballId: 35, name: "AFC Bournemouth", shortName: "BOU", crestUrl: "https://crests.football-data.org/1044.png" },
  { id: 402, fdoId: 402, apiFootballId: 55, name: "Brentford FC", shortName: "BRE", crestUrl: "https://crests.football-data.org/402.png" },
  { id: 397, fdoId: 397, apiFootballId: 51, name: "Brighton & Hove Albion FC", shortName: "BHA", crestUrl: "https://crests.football-data.org/397.png" },
  { id: 328, fdoId: 328, apiFootballId: 44, name: "Burnley FC", shortName: "BUR", crestUrl: "https://crests.football-data.org/328.png" },
  { id: 61, fdoId: 61, apiFootballId: 49, name: "Chelsea FC", shortName: "CHE", crestUrl: "https://crests.football-data.org/61.png" },
  { id: 354, fdoId: 354, apiFootballId: 52, name: "Crystal Palace FC", shortName: "CRY", crestUrl: "https://crests.football-data.org/354.png" },
  { id: 62, fdoId: 62, apiFootballId: 45, name: "Everton FC", shortName: "EVE", crestUrl: "https://crests.football-data.org/62.png" },
  { id: 63, fdoId: 63, apiFootballId: 36, name: "Fulham FC", shortName: "FUL", crestUrl: "https://crests.football-data.org/63.png" },
  { id: 341, fdoId: 341, apiFootballId: 63, name: "Leeds United FC", shortName: "LEE", crestUrl: "https://crests.football-data.org/341.png" },
  { id: 64, fdoId: 64, apiFootballId: 40, name: "Liverpool FC", shortName: "LIV", crestUrl: "https://crests.football-data.org/64.png" },
  { id: 65, fdoId: 65, apiFootballId: 50, name: "Manchester City FC", shortName: "MCI", crestUrl: "https://crests.football-data.org/65.png" },
  { id: 66, fdoId: 66, apiFootballId: 33, name: "Manchester United FC", shortName: "MUN", crestUrl: "https://crests.football-data.org/66.png" },
  { id: 67, fdoId: 67, apiFootballId: 34, name: "Newcastle United FC", shortName: "NEW", crestUrl: "https://crests.football-data.org/67.png" },
  { id: 351, fdoId: 351, apiFootballId: 65, name: "Nottingham Forest FC", shortName: "NFO", crestUrl: "https://crests.football-data.org/351.png" },
  { id: 340, fdoId: 340, apiFootballId: 41, name: "Southampton FC", shortName: "SOU", crestUrl: "https://crests.football-data.org/340.png" },
  { id: 73, fdoId: 73, apiFootballId: 47, name: "Tottenham Hotspur FC", shortName: "TOT", crestUrl: "https://crests.football-data.org/73.png" },
  { id: 563, fdoId: 563, apiFootballId: 48, name: "West Ham United FC", shortName: "WHU", crestUrl: "https://crests.football-data.org/563.png" },
  { id: 76, fdoId: 76, apiFootballId: 39, name: "Wolverhampton Wanderers FC", shortName: "WOL", crestUrl: "https://crests.football-data.org/76.png" }
];

async function main() {
  await prisma.team.createMany({
    data: premierLeagueTeams2025_26,
    skipDuplicates: true,
  });

  const count = await prisma.team.count();
  const mappedCount = await prisma.team.count({ where: { apiFootballId: { not: null } } });

  console.log(`Seeded ${count} teams (${mappedCount} with API-Football mappings)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
