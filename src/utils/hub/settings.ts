import { ActionRowBuilder, type Client, type Snowflake, StringSelectMenuBuilder } from 'discord.js';
import type { SerializedHubSettings } from '#main/modules/BitFields.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import { CustomID } from '#utils/CustomID.js';

export const buildSettingsMenu = (
  rawSettings: SerializedHubSettings,
  hubId: string,
  userId: Snowflake,
  client: Client,
) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('hubEdit', 'settingsSelect')
          .setArgs(userId)
          .setArgs(hubId)
          .toString(),
      )
      .setPlaceholder('Select an option')
      .addOptions(
        Object.entries(rawSettings).map(([setting, isEnabled]) => {
          const emoji = isEnabled ? getEmoji('x_icon', client) : getEmoji('tick_icon', client);
          return {
            label: `${isEnabled ? 'Disable' : 'Enable'} ${setting}`,
            value: setting,
            emoji,
          };
        }),
      ),
  );
