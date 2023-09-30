import { ButtonInteraction } from 'discord.js';
import { getDb } from '../../Utils/utils';
import updateMessageReactions from '../reactions/updateMessage';
import { HubSettingsBitField } from '../../Utils/hubSettingsBitfield';
import { fetchServerBlacklist, fetchUserBlacklist } from '../../Utils/blacklist';

export default {
  async execute(interaction: ButtonInteraction) {
    const db = getDb();
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: interaction.message.id } } },
      include: { hub: { select: { connections: { where: { connected: true } }, settings: true } } },
    });

    if (
      !messageInDb?.hub ||
      !messageInDb.hubId ||
      !(new HubSettingsBitField(messageInDb.hub.settings).has('Reactions')) ||
      !interaction.inCachedGuild()
    ) return interaction.reply({ content: 'This hub does not have reactions enabled.', ephemeral: true });

    const userBlacklisted = await fetchUserBlacklist(messageInDb.hubId, interaction.user.id);
    const serverBlacklisted = await fetchServerBlacklist(messageInDb.hubId, interaction.guild.id);

    if (userBlacklisted || serverBlacklisted) {
      await interaction.reply({
        content: 'You are blacklisted from this hub.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    const connections = await db.connectedList.findMany({
      where: {
        channelId: { in: messageInDb?.channelAndMessageIds.map((c) => c.channelId) },
        connected: true,
      },
    });

    const reactedEmoji = interaction.customId.split('reaction_')[1];
    const dbReactions = messageInDb.reactions?.valueOf() as Record<string, string[]>;

    if (dbReactions[reactedEmoji]) {
      // If the user already reacted, remove the reaction
      if (dbReactions[reactedEmoji].includes(interaction.user.id)) {
        const userIndex = dbReactions[reactedEmoji].indexOf(interaction.user.id);
        dbReactions[reactedEmoji].splice(userIndex, 1);
      }
      // Add the user to the array
      else {
        dbReactions[reactedEmoji].push(interaction.user.id);
      }
    }

    await db.messageData.update({
      where: { id: messageInDb.id },
      data: { reactions: dbReactions },
    });

    // Update the message
    updateMessageReactions.execute(connections, messageInDb.channelAndMessageIds, dbReactions);
  },
};