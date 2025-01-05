import type HubManager from '#main/managers/HubManager.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { wait } from '#main/utils/Utils.js';

import { stripIndents } from 'common-tags';
import { type ChatInputCommandInteraction, time } from 'discord.js';
import HubCommand from './index.js';

export default class VisibilityCommnd extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const hubName = interaction.options.getString('hub', true);
    const visibility = interaction.options.getString('visibility', true) as 'public' | 'private';
    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    if (!hub || !(await hub.isManager(interaction.user.id))) {
      await this.replyEmbed(interaction, 'hub.notManager', {
        t: { emoji: this.getEmoji('x_icon') },
        flags: 'Ephemeral',
      });
      return;
    }

    if (visibility === 'public') {
      await interaction.followUp(`${this.getEmoji('offline_anim')} Checking requirements...`);
      const passedChecks = await this.runPublicRequirementChecks(interaction, hub);
      if (!passedChecks) return;
    }

    await hub.setPrivate(visibility === 'private');

    await this.replyEmbed(interaction, 'hub.manage.visibility.success', {
      content: ' ',
      flags: 'Ephemeral',
      edit: true,
      t: {
        emoji: hub.data.private ? '🔒' : '🔓',
        visibility: hub.data.private ? 'private' : 'public',
      },
    });
  }

  private async runPublicRequirementChecks(
    interaction: ChatInputCommandInteraction,
    hub: HubManager,
  ) {
    const logConfig = await hub.fetchLogConfig();
    const mods = await hub.moderators.fetchAll();
    const requirements = [
      {
        name: 'Hub is older than 24 hours',
        check: hub.data.createdAt < new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { name: 'Hub has atleast 2 moderators', check: mods.size >= 2 },
      {
        name: 'Hub accepts user-reports by setting a log channel for reports',
        check: logConfig.config.reports !== null,
      },
    ];

    const passed = requirements.every((r) => r.check);
    const embed = new InfoEmbed().setTitle('Requirement Summary:').setDescription(stripIndents` 
      Result: **${passed ? `${this.getEmoji('tick_icon')} Passed` : `${this.getEmoji('x_icon')} Failed`}**

      ${requirements.map((r) => `${r.check ? this.getEmoji('tick_icon') : this.getEmoji('x_icon')} ${r.name}`).join('\n')}
      ${!passed ? `\n-# ${this.getEmoji('info')} Please fix failed requirements and/or try again later.` : ''}
    `);

    await interaction.editReply({
      content: passed ? `Continuing ${time(new Date(Date.now() + 10_000), 'R')}...` : null,
      embeds: [embed],
    });

    await wait(8000);

    return passed;
  }
}
