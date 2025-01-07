import BaseCommand from '#main/core/BaseCommand.js';
import { ApplicationCommandOptionType, ChatInputCommandInteraction, Colors, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
export default class Leaderboard extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'leaderboard',
    description: 'Shows the leaderboard',
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
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const type = (interaction.options.getString('type') ?? 'xp') as 'xp' | 'level' | 'messages';
    const leaderboard = await interaction.client.userLevels.getLeaderboard(type);

    const description = await Promise.all(
      leaderboard.map(async (user, index) => {
        const discordUser = await interaction.client.users.fetch(user.id);
        switch (type) {
          default:
          case 'xp':
            return `${index + 1}. ${discordUser.username} - Level ${user.level} (${user.xp} XP)`;
          case 'level':
            return `${index + 1}. ${discordUser.username} - Level ${user.level}`;
          case 'messages':
            return `${index + 1}. ${discordUser.username} - ${user.messageCount} messages`;
        }
      }),
    );

    const titles = {
      xp: '🏆 Global XP Leaderboard',
      level: '⭐ Global Level Leaderboard',
      messages: '💬 Global Message Count Leaderboard',
    };

    await interaction.reply({
      embeds: [{
        title: titles[type],
        description: description.join('\n'),
        color: Colors.Yellow,
      }],
    });
  }
}
