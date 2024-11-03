import { SerializedHubSettings } from '#main/modules/BitFields.js';
import { emojis } from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { ActionRowBuilder, Snowflake, StringSelectMenuBuilder } from 'discord.js';

export const buildSettingsMenu = (
  rawSettings: SerializedHubSettings,
  hubId: string,
  userId: Snowflake,
) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('hub_edit', 'settingsSelect')
          .addArgs(userId)
          .addArgs(hubId)
          .toString(),
      )
      .setPlaceholder('Select an option')
      .addOptions(
        Object.entries(rawSettings).map(([setting, isEnabled]) => {
          const emoji = isEnabled ? emojis.no : emojis.yes;
          return {
            label: `${isEnabled ? 'Disable' : 'Enable'} ${setting}`,
            value: setting,
            emoji,
          };
        }),
      ),
  );
