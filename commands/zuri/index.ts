import { Context } from "grammy";

interface Game {
    end_time: number;
    time_class: string;
    white: {
        username: string;
        result: string;
    };
    black: {
        username: string;
        result: string;
    };
}

interface PlayerStats {
    username: string;
    wins: number;
    losses: number;
    netWins: number;
}

// Store user mappings in a simple object
// Key: Telegram username, Value: chess.com username
const userMap: Record<string, string> = {
    'azimjonfffff': 'adheeeem',
    'rahniz90': 'RahNiz',
    'RahmonovShuhrat': 'shuhratrahmonov',
    'aisoqov': 'guaje032',
    'Akhmedov_Sanjar': 'Sanjar_Akhmedov',
    'knajmitdinov': 'komiljon_najmitdinov',
    'nuriddin_yakubovich': 'Nuriddin_2004',
    'Alisherrik': 'alisherrik'
}

const COMMAND_DESCRIPTIONS = {
    default: "Shows overall monthly leaderboard for all game types",
    bugin: "Shows today's top players across all game types",
    blitz: "Shows monthly leaderboard for blitz games (3-5 minutes)",
    bullet: "Shows monthly leaderboard for bullet games (1-2 minutes)",
    rapid: "Shows monthly leaderboard for rapid games (10+ minutes)"
};

function getCommandHelp(): string {
    return [
        "📋 Available /zuri commands:",
        "",
        "🎮 /zuri - " + COMMAND_DESCRIPTIONS.default,
        "🌅 /zuri bugin - " + COMMAND_DESCRIPTIONS.bugin,
        "⚡ /zuri blitz - " + COMMAND_DESCRIPTIONS.blitz,
        "🔫 /zuri bullet - " + COMMAND_DESCRIPTIONS.bullet,
        "🏃 /zuri rapid - " + COMMAND_DESCRIPTIONS.rapid,
        "",
        "Use any command to see the corresponding leaderboard!"
    ].join('\n');
}

export async function handleZuri(ctx: Context) {
    try {
        // Parse command arguments
        const args = ctx.message?.text?.split(' ') || [];
        const option = args[1]?.toLowerCase();

        // Show help if "help" is requested
        if (option === 'help') {
            return ctx.reply(getCommandHelp());
        }

        // Check if we have any registered users
        if (Object.keys(userMap).length === 0) {
            return ctx.reply("⚠️ No registered users found.");
        }

        // Initialize stats for all players
        const playerStats = new Map<string, PlayerStats>();
        for (const [tgUsername, chessUsername] of Object.entries(userMap)) {
            playerStats.set(chessUsername, {
                username: tgUsername,
                wins: 0,
                losses: 0,
                netWins: 0
            });
        }

        // Set date range based on command with GMT+5 timezone offset
        const timezoneOffset = 5; // GMT+5
        const now = new Date();
        
        let startDate: Date;
        let title: string;
        let description: string;

        if (option === 'bugin') {
            // Calculate start of today in GMT+5
            const todayGMT5 = new Date(now.getTime() + (timezoneOffset * 60 * 60 * 1000));
            startDate = new Date(
                todayGMT5.getFullYear(),
                todayGMT5.getMonth(),
                todayGMT5.getDate(),
                -timezoneOffset, // This sets it to 00:00 GMT+5 in UTC time
                0,
                0,
                0
            );
            title = "🏆 Today's Leaderboard";
            description = COMMAND_DESCRIPTIONS.bugin;
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            title = "🏆 Monthly Leaderboard";
            description = option ? COMMAND_DESCRIPTIONS[option as keyof typeof COMMAND_DESCRIPTIONS] : COMMAND_DESCRIPTIONS.default;
        }

        // Fetch and process games for each player
        await Promise.all(Object.values(userMap).map(async (chessUsername) => {
            try {
                // Get archives
                const archivesRes = await fetch(`https://api.chess.com/pub/player/${chessUsername}/games/archives`);
                if (!archivesRes.ok) return;
                
                const archives = await archivesRes.json();
                const currentMonth = archives.archives[archives.archives.length - 1];

                // Get games from current month
                const gamesRes = await fetch(currentMonth);
                if (!gamesRes.ok) return;

                const { games } = await gamesRes.json();
                
                // Process each game
                games.forEach((game: Game) => {
                    // Convert game end time to GMT+5
                    const gameEndTimeUTC = new Date(game.end_time * 1000);
                    const gameEndTimeGMT5 = new Date(gameEndTimeUTC.getTime() + (timezoneOffset * 60 * 60 * 1000));
                    
                    // Filter by date
                    if (gameEndTimeGMT5 < startDate) return;

                    // Filter by game type if specified
                    if (option && ['blitz', 'bullet', 'rapid'].includes(option) && game.time_class !== option) {
                        return;
                    }

                    const stats = processGame(game, chessUsername);
                    updatePlayerStats(chessUsername, stats, playerStats);
                });
            } catch (error) {
                console.error(`Error processing games for ${chessUsername}:`, error);
            }
        }));

        // Sort players by net wins
        const sortedPlayers = [...playerStats.values()]
            .sort((a, b) => b.netWins - a.netWins)
            .filter(player => player.wins > 0 || player.losses > 0);

        if (sortedPlayers.length === 0) {
            const timeFrame = option === 'bugin' ? 'today' : 'this month';
            const gameType = ['blitz', 'bullet', 'rapid'].includes(option || '') ? ` for ${option} games` : '';
            return ctx.reply(`📊 No games found${gameType} ${timeFrame}.\n\nType /zuri help to see all available commands.`);
        }

        // Format response without @ symbol
        const response = [
            title,
            description,
            "",
            ...sortedPlayers.map((player, index) => 
                `${getPositionEmoji(index + 1)} ${player.username}: ${player.netWins >= 0 ? '+' : ''}${player.netWins} (W: ${player.wins} L: ${player.losses})`
            ),
            "",
            "Type /zuri help to see all available commands."
        ].join('\n');

        await ctx.reply(response);

    } catch (err) {
        console.error(err);
        ctx.reply("🚨 Error generating leaderboard. Type /zuri help to see available commands.");
    }
}

function processGame(game: Game, username: string): { wins: number; losses: number } {
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
    const playerResult = isWhite ? game.white.result : game.black.result;
    const opponentResult = isWhite ? game.black.result : game.white.result;

    let wins = 0;
    let losses = 0;

    if (playerResult === 'win' || opponentResult === 'resigned' || 
        opponentResult === 'timeout' || opponentResult === 'abandoned') {
        wins++;
    } else if (opponentResult === 'win' || playerResult === 'resigned' || 
               playerResult === 'timeout' || playerResult === 'abandoned') {
        losses++;
    }

    return { wins, losses };
}

function updatePlayerStats(username: string, { wins, losses }: { wins: number; losses: number }, playerStats: Map<string, PlayerStats>) {
    const stats = playerStats.get(username);
    if (stats) {
        stats.wins += wins;
        stats.losses += losses;
        stats.netWins = stats.wins - stats.losses;
    }
}

function getPositionEmoji(position: number): string {
    switch (position) {
        case 1: return "🥇";
        case 2: return "🥈";
        case 3: return "🥉";
        default: return `${position}.`;
    }
} 