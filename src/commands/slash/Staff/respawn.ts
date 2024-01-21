import { ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
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
      return await interaction.reply({
        content: `${emojis.dnd_anim} You are not authorized to use this command.`,
        ephemeral: true,
      });
    }

    await interaction.reply(`${emojis.tick} Request to respawn shards received. I'll be back!`);

    interaction.client.cluster.respawnAll();
  }
}
