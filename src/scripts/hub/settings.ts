import { ActionRowBuilder, EmbedBuilder, Snowflake, StringSelectMenuBuilder } from 'discord.js';
import { HubSettingsBitField, HubSettingsString } from '../../utils/BitFields.js';
import { emojis, colors } from '../../utils/Constants.js';
import { hubs } from '@prisma/client';
import { CustomID } from '../../utils/CustomID.js';

export function buildSettingsEmbed(hub: hubs) {
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

export function buildSettingsMenu(hubSettings: HubSettingsBitField, hubName: string, userId: Snowflake) {
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
