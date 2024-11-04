import { emojis } from '#utils/Constants.js';
import HubLogManager from '#main/managers/HubLogManager.js';
import db from '#main/utils/Db.js';
import { isHubManager } from '#main/utils/hub/utils.js';
import { Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, time } from 'discord.js';
import HubCommand from './index.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { wait } from '#main/utils/Utils.js';

export default class VisibilityCommnd extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const hubName = interaction.options.getString('hub', true);
    const visibility = interaction.options.getString('visibility', true) as 'public' | 'private';
    const hub = await db.hub.findFirst({ where: { name: hubName } });

    if (!hub || !isHubManager(interaction.user.id, hub)) {
      await this.replyEmbed(interaction, 'hub.notFound_mod', {
        t: { emoji: emojis.no },
        ephemeral: true,
      });
      return;
    }

    if (visibility === 'public') {
      await interaction.followUp(`${emojis.offline_anim} Checking requirements...`);
      const passedChecks = await this.runPublicRequirementChecks(interaction, hub);
      if (!passedChecks) return;
    }

    const updatedHub = await db.hub.update({
      where: { id: hub.id },
      data: { private: visibility === 'private' },
    });

    await this.replyEmbed(interaction, 'hub.manage.visibility.success', {
      content: ' ',
      ephemeral: true,
      edit: true,
      t: {
        emoji: updatedHub.private ? '🔒' : '🔓',
        visibility: updatedHub.private ? 'private' : 'public',
      },
    });
  }

  private async runPublicRequirementChecks(interaction: ChatInputCommandInteraction, hub: Hub) {
    const logConfig = await HubLogManager.create(hub.id);
    const requirements = [
      { name: 'Hub is older than 24 hours', check: hub.createdAt < new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { name: 'Hub has more than 2 moderators', check: hub.moderators.length >= 2 },
      { name: 'Hub has accepts user-reports by setting a log channel for reports', check: logConfig.config.reports !== null },
    ];

    const passed = requirements.every((r) => r.check);
    const embed = new InfoEmbed().setTitle('Requirement Summary:').setDescription(stripIndents` 
      Result: **${passed ? `${emojis.yes} Passed` : `${emojis.no} Failed`}**

      ${requirements.map((r) => `${r.check ? emojis.yes : emojis.no} ${r.name}`).join('\n')}
      ${!passed ? `\n-# ${emojis.info} Please fix failed requirements and/or try again later.` : ''}
    `);

    await interaction.editReply({
      content: passed ? `Continuing ${time(new Date(Date.now() + 10_000), 'R')}...` : null,
      embeds: [embed],
    });

    await wait(8000);

    return passed;
  }
}
