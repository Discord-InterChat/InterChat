import { ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { emojis } from '#utils/Constants.js';
import { isDev } from '#utils/Utils.js';

export default class Respawn extends BaseCommand {
  readonly staffOnly = true;
  readonly data = {
    name: 'recluster',
    description: 'Reboot the bot',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isDev(interaction.user.id)) {
      await interaction.reply({ content: 'No u', ephemeral: true });
      return;
    }

    await interaction.reply({ content: `${emojis.tick} I'll be back!`, ephemeral: true });
    interaction.client.cluster.send('recluster');
  }
}
