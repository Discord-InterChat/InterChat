import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import db from '../../../utils/Db.js';
import { simpleEmbed } from '../../../utils/Utils.js';
import { emojis } from '../../../utils/Constants.js';
import Logger from '../../../utils/Logger.js';

export default class Ban extends BaseCommand {
  readonly staffOnly = true;
  data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'ban',
    description: '🔨 Ban a user from using the bot. (Dev Only)',
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'user',
        description: '🔨 The user to ban.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'reason',
        description: 'Reason for the ban',
        required: true,
      },
    ],
  };
  override async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    if (user.id === interaction.user.id) {
      await interaction.reply({
        content: `Let's not go there. ${emojis.bruhcat}`,
        ephemeral: true,
      });
      return;
    }

    const alreadyBanned = await db.userData.findFirst({
      where: { id: user.id, banMeta: { isNot: null } },
    });

    if (alreadyBanned) {
      await interaction.reply({
        embeds: [simpleEmbed(`${emojis.slash} User **${user.username}** is already banned.`)],
      });
      return;
    }

    await db.userData.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        username: user.username,
        viewedNetworkWelcome: false,
        voteCount: 0,
        banMeta: { reason },
      },
      update: { banMeta: { reason } },
    });

    Logger.info(`User ${user.username} (${user.id}) banned by ${interaction.user.username}.`);

    await interaction.reply({
      embeds: [
        simpleEmbed(
          `${emojis.tick} Successfully banned \`${user.username}\`. They can no longer use the bot.`,
        ),
      ],
    });
  }
}
