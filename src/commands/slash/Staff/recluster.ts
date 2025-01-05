import type { ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';

import { isDev } from '#utils/Utils.js';

export default class Respawn extends BaseCommand {
  readonly staffOnly = true;
  readonly data = {
    name: 'recluster',
    description: 'Reboot the bot',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isDev(interaction.user.id)) {
      await interaction.reply({ content: 'No u', flags: ['Ephemeral'] });
      return;
    }

    await interaction.reply({
      content: `${this.getEmoji('tick')} I'll be back!`,
      flags: ['Ephemeral'],
    });
    interaction.client.cluster.send('recluster');
  }
}
