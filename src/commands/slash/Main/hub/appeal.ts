import { emojis } from '#main/config/Constants.js';
import db from '#utils/Db.js';
import { ErrorEmbed } from '#utils/EmbedUtils.js';
import { isHubMod } from '#utils/hub/utils.js';
import { t } from '#utils/Locale.js';
import { Hub } from '@prisma/client';
import { ChatInputCommandInteraction } from 'discord.js';
import ms from 'ms';
import HubCommand from './index.js';

export default class AppealCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    const hub = await this.runHubChecks(interaction);
    if (!hub) return;

    if (subcommand === 'set_cooldown') {
      await this.handleAppealCooldown(interaction, hub);
    }
  }

  private async handleAppealCooldown(interaction: ChatInputCommandInteraction, hub: Hub) {
    const cooldown = interaction.options.getString('cooldown', true);
    const appealCooldownHours = ms(cooldown) / 1000 / 60 / 60;
    if (!appealCooldownHours || appealCooldownHours < 1) {
      const embed = new ErrorEmbed().setDescription('Cooldown must be atleast **1 hour** long.');
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
    else if (appealCooldownHours > 8766) {
      const embed = new ErrorEmbed().setDescription('Cooldown cannot be longer than **1 year**.');
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await db.hub.update({ where: { id: hub.id }, data: { appealCooldownHours } });

    await interaction.reply({
      content: `${emojis.clock_icon} Appeal cooldown has been set to **${appealCooldownHours}** hour(s).`,
      ephemeral: true,
    });
  }

  private async runHubChecks(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub', true);
    const hub = await db.hub.findFirst({ where: { name: hubName } });

    if (!hub || !isHubMod(interaction.user.id, hub)) {
      await this.replyEmbed(
        interaction,
        t(
          'hub.notFound_mod',
          await interaction.client.userManager.getUserLocale(interaction.user.id),
          { emoji: emojis.no },
        ),
        { ephemeral: true },
      );
      return null;
    }

    return hub;
  }
}
