import {
  ChatInputCommandInteraction,
  CacheType,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  Snowflake,
} from 'discord.js';
import db from '../../../utils/Db.js';
import Hub from '../../slash/Main/hub.js';
import { hubs } from '@prisma/client';
import { HubSettingsBitField, HubSettingsString } from '../../../utils/BitFields.js';
import { colors, emojis } from '../../../utils/Constants.js';
import { Interaction } from '../../../decorators/Interaction.js';
import { CustomID } from '../../../structures/CustomID.js';
import { StringSelectMenuInteraction } from 'discord.js';
import { errorEmbed } from '../../../utils/Utils.js';

export default class Settings extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<unknown> {
    const hubName = interaction.options.getString('hub', true);
    const hub = await db.hubs.findUnique({
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
    const embed = Settings.buildSettingsEmbed(hub);
    const selects = Settings.settingsMenu(hubSettings, hubName, interaction.user.id);

    await interaction.reply({ embeds: [embed], components: [selects] });
  }

  @Interaction('hub_settings')
  async handleComponents(interaction: StringSelectMenuInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const hubName = customId.args[0];

    // respond to select menu
    const selected = interaction.values[0] as HubSettingsString;

    // TODO: implement BlockNSFW, only allow hubs that are explicitly marked as NSFW to have this setting
    // & only allow network channels to be marked as NSFW
    if (selected === 'BlockNSFW') {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.no} This setting cannot be changed yet. Please wait for the next update.`)],
        ephemeral: true,
      });
    }

    let hub = await db.hubs.findFirst({ where: { name: hubName } });
    if (!hub) {
      return interaction.reply({
        content: 'Hub not found.',
        ephemeral: true,
      });
    }

    const hubSettings = new HubSettingsBitField(hub.settings);
    hub = await db.hubs.update({
      where: { name: hubName },
      data: { settings: hubSettings.toggle(selected).bitfield }, // toggle the setting
    });

    const embed = Settings.buildSettingsEmbed(hub);
    const selects = Settings.settingsMenu(hubSettings, hub.name, interaction.user.id);

    await interaction.update({
      embeds: [embed],
      components: [selects],
    });
  }

  static buildSettingsEmbed(hub: hubs) {
    const settings = new HubSettingsBitField(hub.settings);
    const settingDescriptions = {
      Reactions: '**Reactions** - Allow users to react to messages.',
      HideLinks: '**Hide Links** - Redact links sent by users.',
      BlockInvites: '**Block Invites** - Prevent users from sending Discord invites.',
      BlockNSFW: '**Block NSFW** - Detect and block NSFW images (static only).',
      SpamFilter: '**Spam Filter** - Automatically blacklist spammers for 5 minutes.',
      UseNicknames: '**Use Nicknames** - Use server nicknames as the network usernames.',
    };

    return new EmbedBuilder()
      .setAuthor({ name: `${hub.name} Settings`, iconURL: hub.iconUrl })
      .setDescription(
        Object.entries(settingDescriptions)
          .map(([key, value]) => {
            const flag = settings.has(key as HubSettingsString);
            return `- ${flag ? emojis.enabled : emojis.disabled} ${value}`;
          })
          .join('\n'),
      )
      .setFooter({ text: 'Use the select menu below to toggle.' })
      .setColor(colors.interchatBlue)
      .setTimestamp();
  }

  static settingsMenu(hubSettings: HubSettingsBitField, hubName: string, userId: Snowflake) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_settings', 'settings')
            .addArgs(hubName)
            .addArgs(userId)
            .toString(),
        )
        .setPlaceholder('Select an option')
        .addOptions(
          Object.keys(HubSettingsBitField.Flags).map((key) => {
            const flag = hubSettings.has(key as HubSettingsString);
            const emoji = flag ? emojis.no : emojis.yes;
            return {
              label: `${flag ? 'Disable' : 'Enable'} ${key}`,
              value: key,
              emoji,
            };
          }),
        ),
    );
  }
}
