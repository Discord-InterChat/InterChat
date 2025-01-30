import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { ApplicationCommandOptionType, Colors } from 'discord.js';

export default class Leaderboard extends BaseCommand {
  constructor() {
    super({
      name: 'leaderboard',
      description: 'Shows the leaderboard',
      types: { slash: true, prefix: true },
      options: [
        {
          name: 'type',
          description: 'The type of leaderboard to show',
          required: false,
          type: ApplicationCommandOptionType.String,
          choices: [
            { name: 'XP', value: 'xp' },
            { name: 'Level', value: 'level' },
            { name: 'Messages', value: 'messages' },
          ],
        },
      ],
    });
  }

  async execute(ctx: Context) {
    const type = (ctx.options.getString('type') ?? 'xp') as 'xp' | 'level' | 'messages';
    const leaderboard = await ctx.client.userLevels.getLeaderboard(type);

    const description = await Promise.all(
      leaderboard.map(async (user, index) => {
        const discordUser = await ctx.client.users.fetch(user.id);
        switch (type) {
          case 'level':
            return `${index + 1}. ${discordUser.username} - Level ${user.level}`;
          case 'messages':
            return `${index + 1}. ${discordUser.username} - ${user.messageCount} messages`;
          default:
            return `${index + 1}. ${discordUser.username} - Level ${user.level} (${user.xp} XP)`;
        }
      }),
    );

    const titles = {
      xp: '🏆 Global XP Leaderboard',
      level: '⭐ Global Level Leaderboard',
      messages: '💬 Global Message Count Leaderboard',
    };

    await ctx.reply({
      embeds: [{
        title: titles[type],
        description: description.join('\n'),
        color: Colors.Yellow,
      }],
    });
  }
}
