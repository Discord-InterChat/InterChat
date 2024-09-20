import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Guild,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { isDev, resolveEval } from '#main/utils/Utils.js';
import { emojis } from '#main/config/Constants.js';

export default class Respawn extends BaseCommand {
  readonly staffOnly = true;
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'leave',
    description: 'Make me leave a server (Dev\'s toy only)',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'server_id',
        description: 'The ID of the server to leave.',
        required: true,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isDev(interaction.user.id)) {
      await interaction.reply({
        content: `${emojis.dnd_anim} You are not authorized to use this command.`,
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.options.getString('server_id', true);
    const leftGuild = resolveEval(
      (await interaction.client.cluster.broadcastEval(
        async (client, _serverId) => {
          const guild = client.guilds.cache.get(_serverId);

          return guild ? await guild.leave() : undefined;
        },
        { guildId, context: guildId },
      )) as (Guild | undefined)[],
    );

    await interaction.reply(
      `${emojis.tick} Successfully Left guild ${leftGuild?.name} (${leftGuild?.id})`,
    );
  }
}
