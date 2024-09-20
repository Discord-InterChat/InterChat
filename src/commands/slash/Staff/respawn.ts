import { ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { emojis } from '#main/config/Constants.js';
import { isDev } from '#main/utils/Utils.js';

export default class Respawn extends BaseCommand {
  readonly staffOnly = true;
  readonly data = {
    name: 'respawn',
    description: 'Respawn all shards',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isDev(interaction.user.id)) {
      await interaction.reply({
        content: 'No u',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `${emojis.tick} Respawning all shards. I'll be back!`,
      ephemeral: true,
    });

    interaction.client.cluster.respawnAll();
  }
}
