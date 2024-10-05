import { ChatInputCommandInteraction } from 'discord.js';
import HubCommand from './index.js';
import db from '#main/utils/Db.js';
import HubLogManager, { LogConfigTypes, RoleIdLogConfigs } from '#main/managers/HubLogManager.js';
import { Hub } from '@prisma/client';

export default class LoggingCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    const hub = await this.runHubChecks(interaction);
    if (!hub) return;

    switch (subcommand) {
      case 'view':
        await this.handleView(interaction, hub);
        break;
      case 'set_channel':
        await this.handleSet(interaction, hub.id, 'channel');
        break;
      case 'set_role':
        await this.handleSet(interaction, hub.id, 'role');
        break;
      default:
        break;
    }
  }

  private async handleView(interaction: ChatInputCommandInteraction, hub: Hub) {
    const hubLogManager = await HubLogManager.create(hub.id);
    const embed = hubLogManager.createEmbed(hub.iconUrl);
    await interaction.reply({ embeds: [embed] });
  }

  private async handleSet(
    interaction: ChatInputCommandInteraction,
    hubId: string,
    setType: 'channel' | 'role',
  ) {
    const id =
      setType === 'channel'
        ? interaction.options.getChannel('channel')?.id
        : interaction.options.getRole('role')?.id;

    const logType = interaction.options.getString('log_type', true) as LogConfigTypes;
    const hubLogManager = await HubLogManager.create(hubId);

    if (!id) {
      if (setType === 'channel') await hubLogManager.resetLog(logType);
      else await hubLogManager.removeRoleId(logType as RoleIdLogConfigs);

      await this.replyEmbed(
        interaction,
        `Successfully reset logging ${setType} for type \`${logType}\`.`,
        {
          ephemeral: true,
        },
      );
      return;
    }

    if (setType === 'channel') {
      await hubLogManager.setLogChannel(logType, id);
      await this.replyEmbed(
        interaction,
        `Successfully set \`${logType}\` logging channel to <#${id}>.`,
        { ephemeral: true },
      );
    }
    else if (setType === 'role' && hubLogManager.config.appeals?.channelId) {
      await hubLogManager.setRoleId(logType as RoleIdLogConfigs, id);
      await this.replyEmbed(
        interaction,
        `Successfully set \`${logType}\` mention role to <@&${id}>.`,
        { ephemeral: true },
      );
    }
    else {
      await this.replyEmbed(
        interaction,
        'You must set the logging channel before setting the role ID.',
        { ephemeral: true },
      );
    }
  }

  private async runHubChecks(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub') as string | undefined;
    const hubs = await db.hub.findMany({
      where: {
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
    });

    let hub;
    if (hubName) {
      hub = hubs.find((h) => h.name.toLowerCase() === hubName.toLowerCase());
    }
    else if (hubs.length === 1) {
      hub = hubs[0];
    }
    else if (hubs.length > 1 || !hub) {
      await this.replyEmbed(
        interaction,
        'You must provide a hub in the `hub` option of the command.',
        { ephemeral: true },
      );
      return null;
    }

    return hub;
  }
}
