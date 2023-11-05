import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { ChatInputCommandInteraction, CacheType } from 'discord.js';
import { HubSettingsBitField, HubSettingsString } from '../../../../utils/BitFields.js';
import { emojis } from '../../../../utils/Constants.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { CustomID } from '../../../../structures/CustomID.js';
import { StringSelectMenuInteraction } from 'discord.js';
import { errorEmbed } from '../../../../utils/Utils.js';
import { buildSettingsEmbed, buildSettingsMenu } from '../../../../scripts/hub/settings.js';

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
    const embed = buildSettingsEmbed(hub);
    const selects = buildSettingsMenu(hubSettings, hubName, interaction.user.id);

    await interaction.reply({ embeds: [embed], components: [selects] });
  }

  @RegisterInteractionHandler('hub_settings')
  async handleComponents(interaction: StringSelectMenuInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const hubName = customId.args[0];

    if (interaction.user.id !== customId.args[1]) {
      return interaction.reply({
        embeds: [
          errorEmbed('Sorry, you can\'t perform this action. Please run the command yourself.'),
        ],
        ephemeral: true,
      });
    }

    // respond to select menu
    const selected = interaction.values[0] as HubSettingsString;

    // TODO: implement BlockNSFW, only allow hubs that are explicitly marked as NSFW to have this setting
    // & only allow network channels to be marked as NSFW
    if (selected === 'BlockNSFW') {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `${emojis.no} This setting cannot be changed yet. Please wait for the next update.`,
          ),
        ],
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

    const embed = buildSettingsEmbed(hub);
    const selects = buildSettingsMenu(hubSettings, hub.name, interaction.user.id);

    await interaction.update({
      embeds: [embed],
      components: [selects],
    });
  }
}
