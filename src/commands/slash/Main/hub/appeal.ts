import type HubManager from '#main/managers/HubManager.js';

import type { ChatInputCommandInteraction } from 'discord.js';
import ms from 'ms';
import { ErrorEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import HubCommand from './index.js';
import { fetchUserLocale } from '#main/utils/Utils.js';

export default class AppealCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    const hub = await this.runHubChecks(interaction);
    if (!hub) return;

    if (subcommand === 'set_cooldown') {
      await this.handleAppealCooldown(interaction, hub);
    }
  }

  private async handleAppealCooldown(interaction: ChatInputCommandInteraction, hub: HubManager) {
    const cooldown = interaction.options.getString('cooldown', true);
    const appealCooldownHours = ms(cooldown) / 1000 / 60 / 60;
    if (!appealCooldownHours || appealCooldownHours < 1) {
      const embed = new ErrorEmbed(interaction.client).setDescription(
        'Cooldown must be atleast **1 hour** long.',
      );
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }
    if (appealCooldownHours > 8766) {
      const embed = new ErrorEmbed(interaction.client).setDescription(
        'Cooldown cannot be longer than **1 year**.',
      );
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    await hub.update({ appealCooldownHours });

    await interaction.reply({
      content: `${this.getEmoji('clock_icon')} Appeal cooldown has been set to **${appealCooldownHours}** hour(s).`,
      flags: ['Ephemeral'],
    });
  }

  private async runHubChecks(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub', true);
    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    if (!hub || !(await hub.isMod(interaction.user.id))) {
      await this.replyEmbed(
        interaction,
        t(
          'hub.notFound_mod',
          await fetchUserLocale(interaction.user.id),
          { emoji: this.getEmoji('x_icon') },
        ),
        { flags: ['Ephemeral'] },
      );
      return null;
    }

    return hub;
  }
}
