import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, Collection, GuildTextBasedChannel } from 'discord.js';
import { totalConnected, disconnect, createConnection } from '../../Structures/network';
import { hubs } from '@prisma/client';
import logger from '../../Utils/logger';
import onboarding from './onboarding';

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
      // Inserting channel to connectedlist
      await createConnection({
        channelId: networkChannel.id,
        serverId: networkChannel.guild.id,
        connected: true,
        profFilter: true,
        compact: false,
        hub: { connect: { id: hub.id } },
      });

      const numOfConnections = await totalConnected({ hub: { id: hub.id } });
      if (numOfConnections > 1) {
        await networkChannel?.send(`This channel has been connected with ${hub.name}. You are currently with ${numOfConnections} other servers, Enjoy! ${emoji.clipart}`);
      }
      else {
        await networkChannel?.send(`This channel has been connected with ${hub.name}, though no one else is there currently... *cricket noises* ${emoji.clipart}`);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
      logger.error(err);
      if (err.message === 'Missing Permissions' || err.message === 'Missing Access') {
        interactionReply(`${emoji.no} I don't have the required permissions and/or access to the selected channel to execute this command.`);
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
