import { ActionRowBuilder, ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getDb, yesOrNoEmoji } from '../../Utils/functions/utils';
import { hubs } from '@prisma/client';
import { stripIndents } from 'common-tags';

const genSettingsEmbed = (hub: hubs, yesEmoji: string, noEmoji: string) => {
  return new EmbedBuilder()
    .setAuthor({ name: 'Settings', iconURL: hub.iconUrl })
    .setDescription(stripIndents`
      - ${yesOrNoEmoji(hub.settings?.useNicknames, yesEmoji, noEmoji)} **Use Nicknames** - Use server nicknames as the network usernames.
      - ${yesOrNoEmoji(hub.settings?.allowReactions, yesEmoji, noEmoji)} **Allow Reactions** - Allow users to react to messages.
      - ${yesOrNoEmoji(hub.settings?.allowInvites, yesEmoji, noEmoji)} **Allow Invites** - Allow users to send discord invites.
      - ${yesOrNoEmoji(hub.settings?.allowLinks, yesEmoji, noEmoji)} **Allow Links** - Allow messages to contain links.
      - ${yesOrNoEmoji(hub.settings?.profanityFilter, yesEmoji, noEmoji)} **Profanity Filter** - Censor profanity with asterisks (\*\*\*\*).
      - ${yesOrNoEmoji(hub.settings?.spamFilter, yesEmoji, noEmoji)} **Spam Filter** - Automatically blacklist users for 5 minutes who spam the chat.

    `)
    .setFooter({ text: 'Use the select menu below to toggle.' })
    .setColor('Random')
    .setTimestamp();
};
export async function execute(interaction: ChatInputCommandInteraction) {
  const hubName = interaction.options.getString('hub', true);

  const db = getDb();
  const hub = await db.hubs.findUnique({ where: { name: hubName } });

  if (!hub || !hub.settings) {
    return interaction.reply({
      content: 'Hub not found.',
      ephemeral: true,
    });
  }

  const emotes = interaction.client.emotes.normal;
  const embed = genSettingsEmbed(hub, emotes.enabled, emotes.disabled);
  const hubSettingsArr = Object.entries(hub.settings);

  const selects = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('hub_settings')
      .setPlaceholder('Select an option')
      .addOptions(
        hubSettingsArr.map(([key, value]) => ({
          label: `${value ? 'Disable' : 'Enable'} ${key}`,
          value: key,
          emoji: value ? emotes.disabled : emotes.enabled,
        })),
      ),
  );


  return interaction.reply({ embeds: [embed], components: [selects] });
}