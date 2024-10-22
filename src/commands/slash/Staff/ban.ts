import BaseCommand from '#main/core/BaseCommand.js';
import { handleBan } from '#utils/BanUtils.js';
import {
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  ApplicationCommandOptionType,
} from 'discord.js';

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
  override async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    await handleBan(interaction, user.id, user, reason);
  }
}
