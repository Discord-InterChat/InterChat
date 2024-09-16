import { HubSettingsBitField, HubSettingsString } from '#main/utils/BitFields.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import { ActionRowBuilder, EmbedBuilder, Snowflake, StringSelectMenuBuilder } from 'discord.js';

export const buildSettingsEmbed = (name: string, iconURL: string, rawSettings: number) => {
  const settings = new HubSettingsBitField(rawSettings);
  const settingDescriptions = {
    Reactions: '**Reactions** - Allow users to react to messages.',
    HideLinks: '**Hide Links** - Redact links sent by users.',
    BlockInvites: '**Block Invites** - Prevent users from sending Discord invites.',
    BlockNSFW: '**Block NSFW** - Detect and block NSFW images (static only).',
    SpamFilter: '**Spam Filter** - Automatically blacklist spammers for 5 minutes.',
    UseNicknames: '**Use Nicknames** - Use server nicknames as the network usernames.',
  };

  return new EmbedBuilder()
    .setAuthor({ name: `${name} Settings`, iconURL })
    .setDescription(
      Object.entries(settingDescriptions)
        .map(([key, value]) => {
          const flag = settings.has(key as HubSettingsString);
          return `- ${flag ? emojis.enabled : emojis.disabled} ${value}`;
        })
        .join('\n'),
    )
    .setFooter({ text: 'Use the select menu below to toggle.' })
    .setColor(Constants.Colors.interchatBlue)
    .setTimestamp();
};

export const buildSettingsMenu = (rawSettings: number, hubId: string, userId: Snowflake) => {
  const hubSettings = new HubSettingsBitField(rawSettings);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('hub_manage', 'settingsSelect')
          .addArgs(userId)
          .addArgs(hubId)
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
};
