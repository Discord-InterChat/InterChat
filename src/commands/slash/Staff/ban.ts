import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import db from '../../../utils/Db.js';
import { simpleEmbed } from '../../../utils/Utils.js';
import { DeveloperIds, emojis } from '../../../utils/Constants.js';

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
    ],
  };
  override async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    if (!DeveloperIds.includes(interaction.user.id)) return;

    const user = interaction.options.getUser('user', true);

    if (user.id === interaction.user.id) {
      await interaction.reply({
        content: `Let's not go there. ${emojis.bruhcat}`,
        ephemeral: true,
      });
    }

    const alreadyBanned = await db.userData.findFirst({
      where: { userId: user.id, banMeta: { isSet: true } },
    });

    if (alreadyBanned) {
      await interaction.reply({
        embeds: [simpleEmbed(`${emojis.slash} User **${user.username}** is already banned.`)],
      });
      return;
    }

    await db.userData.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        username: user.username,
        viewedNetworkWelcome: false,
        voteCount: 0,
        banMeta: { reason: 'Banned for being bad' }, // FIXME: Attach reason
      },
      update: {
        banMeta: { reason: 'Banned for being bad' }, // FIXME: Attach reason
      },
    });

    await interaction.reply({
      embeds: [
        simpleEmbed(`${emojis.tick} Successfully banned \`${user.username}\`. They can no longer use the bot.`),
      ],
    });
  }
}
