import BaseCommand from '#src/core/BaseCommand.js';
import db from '#utils/Db.js';
import { escapeRegexChars } from '#utils/Utils.js';
import {
  type AutocompleteInteraction,
  PermissionsBitField,
} from 'discord.js';

export default class ConnectionCommand extends BaseCommand {
  constructor() {
    super({
      name: 'connection',
      description: 'Pause, unpause or edit your connections to hubs in this server.',
      types: { prefix: true, slash: true },
      defaultPermissions: new PermissionsBitField('SendMessages'),
      contexts: { guildOnly: true },
    });
  }

  static async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = escapeRegexChars(interaction.options.getFocused());

    const isInDb = await db.connection.findMany({
      where: {
        serverId: interaction.guild?.id,
        OR: [
          { channelId: { contains: focusedValue } },
          { hub: { name: { contains: focusedValue } } },
        ],
      },
      select: { channelId: true, hub: true },
      take: 25,
    });

    const filtered = isInDb?.map(async ({ channelId, hub }) => {
      const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
      return {
        name: `${hub?.name} | #${channel?.name ?? channelId}`,
        value: channelId,
      };
    });

    await interaction.respond(await Promise.all(filtered));
  }
}
