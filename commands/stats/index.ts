import { Context } from "grammy";

interface Rating {
  last?: { rating: number };
}

interface ChessStats {
  chess_rapid?: Rating;
  chess_blitz?: Rating;
  chess_bullet?: Rating;
  tactics?: { highest?: { rating: number } };
  puzzle_rush?: { best?: { score: number } };
}

type RatingKey = "chess_rapid" | "chess_blitz" | "chess_bullet";

export async function handleStats(ctx: Context) {
  const username = ctx.message?.text?.trim().toLowerCase();
  if (!username) return;

  try {
    const res = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
    if (!res.ok) return ctx.reply("⚠️ Could not fetch stats.");
    const stats = await res.json() as ChessStats;

    const getRating = (mode: RatingKey) => stats[mode]?.last?.rating ?? "N/A";

    await ctx.reply(
      `📊 Stats for @${username}:\n\n♟ Rapid: ${getRating("chess_rapid")}\n⚡ Blitz: ${getRating("chess_blitz")}\n💨 Bullet: ${getRating("chess_bullet")}\n🧠 Tactics: ${stats.tactics?.highest?.rating ?? "N/A"}\n📅 Puzzle Rush Best: ${stats.puzzle_rush?.best?.score ?? "N/A"}`
    );
  } catch (err) {
    console.error(err);
    ctx.reply("🚨 Error while fetching stats.");
  }
} 