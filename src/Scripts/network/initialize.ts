import { stripIndents } from 'common-tags';
import { ChannelType, ChatInputCommandInteraction, Collection, GuildTextBasedChannel } from 'discord.js';
import { disconnect } from '../../Structures/network';
import { hubs } from '@prisma/client';
import logger from '../../Utils/logger';
import onboarding from './onboarding';
import { getDb } from '../../Utils/functions/utils';

const onboardingInProgress = new Collection<string, string>();

export = {
  async execute(interaction: ChatInputCommandInteraction, hub: hubs, networkChannel: GuildTextBasedChannel) {
    const emoji = interaction.client.emotes.normal;

    const interactionReply = interaction.deferred || interaction.replied
      ? interaction.followUp
      : interaction.reply;

    if (onboardingInProgress.has(networkChannel.id)) {
      await interactionReply(`${emoji.no} Another setup for ${networkChannel} is already in progress.`);
      return;
    }
    // Mark this setup as in-progress so server can't setup twice
    onboardingInProgress.set(interaction.channelId, interaction.channelId);


    // Show new users rules & info about network
    const onboardingStatus = await onboarding.execute(interaction);
    if (!onboardingStatus) {
      onboardingInProgress.delete(networkChannel.id);
      return;
    }

    try {
      if (networkChannel.type !== ChannelType.GuildText) {
        interaction.followUp(`${emoji.no} You can only connect **text channels** to the InterChat network!`);
        return;
      }

      const webhook = await networkChannel.createWebhook({
        name: 'InterChat Network',
        avatar: interaction.client.user?.avatarURL(),
      });

      const { connectedList } = getDb();
      await connectedList.create({
        data:{
          channelId: networkChannel.id,
          serverId: networkChannel.guild.id,
          connected: true,
          profFilter: true,
          compact: false,
          useServerProfile: false,
          webhook: { id: webhook.id, token: `${webhook.token}`, url: webhook.url },
          hub: { connect: { id: hub.id } },
        },
      });

      const numOfConnections = await connectedList.count({ where: { hub: { id: hub.id } } });
      if (numOfConnections > 1) {
        await networkChannel?.send(`This channel has been connected with ${hub.name}. You are currently with ${numOfConnections - 1} other servers, Enjoy! ${emoji.clipart}`);
      }
      else {
        await networkChannel?.send(`This channel has been connected with ${hub.name}, though no one else is there currently... *cricket noises* ${emoji.clipart}`);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
      logger.error(err);
      if (err.message === 'Missing Permissions' || err.message === 'Missing Access') {
        interactionReply(`${emoji.no} Please make sure you have granted me \`Manage Webhooks\` and \`View Channel\` permissions for the selected channel.`);
      }
      else {
        interactionReply(`An error occurred while connecting to the InterChat network! \`\`\`js\n${err.message}\`\`\``);
      }
      onboardingInProgress.delete(networkChannel.id);
      disconnect(networkChannel.id);
      return;
    }

    interaction.client.sendInNetwork(stripIndents`
      A new server has joined us! ${emoji.clipart}

      **Server Name:** __${interaction.guild?.name}__
      **Member Count:** __${interaction.guild?.memberCount}__
    `, { id: hub.id });
  },
};
