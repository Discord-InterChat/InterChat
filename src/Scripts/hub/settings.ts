import { ActionRowBuilder, ChatInputCommandInteraction, ComponentType, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { colors, getDb } from '../../Utils/functions/utils';
import { hubs } from '@prisma/client';
import { HubSettingsBitField, HubSettingsString } from '../../Utils/hubs/hubSettingsBitfield';

const genSettingsEmbed = (hub: hubs, yesEmoji: string, noEmoji: string) => {
  const settings = new HubSettingsBitField(hub.settings);
  const settingDescriptions = {
    HideLinks: '**Hide Links** - Redact links sent by users.',
    Reactions: '**Reactions** - Allow users to react to messages.',
    BlockInvites: '**Block Invites** - Prevent users from sending Discord invites.',
    SpamFilter: '**Spam Filter** - Automatically blacklist spammers for 5 minutes.',
    UseNicknames: '**Use Nicknames** - Use server nicknames as the network usernames.',
  };

  return new EmbedBuilder()
    .setAuthor({ name: `${hub.name} Settings`, iconURL: hub.iconUrl })
    .setDescription(Object.entries(settingDescriptions).map(([key, value]) => {
      const flag = settings.has(key as HubSettingsString);
      return `- ${flag ? yesEmoji : noEmoji} ${value}`;
    }).join('\n'))
    .setFooter({ text: 'Use the select menu below to toggle.' })
    .setColor(colors('chatbot'))
    .setTimestamp();
};

const genSelectMenu = (
  hubSettings: HubSettingsBitField,
  disabledEmote: string,
  enabledEmote: string,
) => {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('hub_settings')
      .setPlaceholder('Select an option')
      .addOptions(
        Object.keys(HubSettingsBitField.Flags).map((key) => {
          const flag = hubSettings.has(key as HubSettingsString);
          const emoji = flag ? disabledEmote : enabledEmote;
          return {
            label: `${flag ? 'Disable' : 'Enable'} ${key}`,
            value: key,
            emoji,
          };
        }),
      ),
  );
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const hubName = interaction.options.getString('hub', true);

  const db = getDb();
  let hub = await db.hubs.findUnique({
    where: {
      name: hubName,
      OR: [
        {
          moderators: { some: { userId: interaction.user.id, position: 'manager' } },
        },
        { ownerId: interaction.user.id },
      ],
    },
  });

  if (!hub) {
    return interaction.reply({
      content: 'Hub not found.',
      ephemeral: true,
    });
  }

  const hubSettings = new HubSettingsBitField(hub.settings);
  const emotes = interaction.client.emotes.normal;
  const embed = genSettingsEmbed(hub, emotes.enabled, emotes.disabled);
  const selects = genSelectMenu(hubSettings, emotes.disabled, emotes.enabled);

  const initReply = await interaction.reply({ embeds: [embed], components: [selects] });

  const collector = initReply.createMessageComponentCollector({
    time: 60 * 1000,
    filter: (i) => i.user.id === interaction.user.id,
    componentType: ComponentType.StringSelect,
  });

  // respond to select menu
  collector.on('collect', async (i) => {
    const selected = i.values[0] as HubSettingsString;

    hub = await db.hubs.update({
      where: { name: hub?.name },
      data: { settings: hubSettings.toggle(selected).bitfield },
    });

    const newEmbed = genSettingsEmbed(hub, emotes.enabled, emotes.disabled);
    const newSelects = genSelectMenu(hubSettings, emotes.disabled, emotes.enabled);

    await i.update({
      embeds: [newEmbed],
      components: [newSelects],
    });
  });
}