import { ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import { emojis } from '../../../utils/Constants.js';
import { isDev } from '../../../utils/Utils.js';

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
