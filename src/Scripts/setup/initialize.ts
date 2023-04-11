import { stripIndents } from 'common-tags';
import { ChannelType, ChatInputCommandInteraction, Collection } from 'discord.js';
import { totalConnected, disconnect, createConnection, getManyConnections } from '../../Structures/network';
import logger from '../../Utils/logger';
import displayEmbed from './displaySettings';
import onboarding from './onboarding';
import displayStarterHubs from './displayStarterHubs';

const ongoingSetup = new Collection<string, string>();

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const date = new Date();
    const emoji = interaction.client.emotes.normal;
    // Only text channels are allowed right now
    const destination = interaction.options.getChannel('destination', true, [ChannelType.GuildText]);

    const guildSetup = await getManyConnections({ serverId: interaction.guild?.id });
    if (guildSetup.find(s => s.channelId === destination.id)) return displayEmbed.execute(interaction);

    if (ongoingSetup.has(destination.id)) {
      return interaction.editReply(`${emoji.no} Another setup for ${destination} is already in progress.`);
    }

    // Mark this setup as in-progress so server can't setup twice
    ongoingSetup.set(interaction.channelId, interaction.channelId);

    // If server is already a part of a hub, don't show them this!
    const joinedHub = await displayStarterHubs.execute(interaction) || { name: 'InterChat Central Hub' };
    if (!joinedHub) {
      ongoingSetup.delete(destination.id);
      return;
    }

    // Show new users rules & info about network
    const onboardingStatus = await onboarding.execute(interaction);
    if (!onboardingStatus) {
      ongoingSetup.delete(destination.id);
      return;
    }

    try {
      // Inserting channel to connectedlist
      await createConnection({
        channelId: destination.id,
        serverId: destination.guild.id,
        connected: true,
        profFilter: true,
        compact: false,
        hub: { connect: joinedHub },
        date,
      });

      const numOfConnections = await totalConnected({ hub: joinedHub });
      if (numOfConnections > 1) {
        await destination?.send(`This channel has been connected to the chat network. You are currently with ${numOfConnections} other servers, Enjoy! ${emoji.clipart}`);
      }
      else {
        await destination?.send(`This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${emoji.clipart}`);
      }
      logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
      logger.error(err);
      if (err.message === 'Missing Permissions' || err.message === 'Missing Access') {
        interaction.editReply(`${emoji.no} I don't have the required permissions and/or access to the selected channel to execute this command.`);
      }
      else {
        interaction.followUp(`An error occurred while connecting to the chat network! \`\`\`js\n${err.message}\`\`\``);
      }
      disconnect(destination.id);
      ongoingSetup.delete(destination.id);
      return;
    }

    interaction.client.sendInNetwork(stripIndents`
      A new server has joined us in the Network! ${emoji.clipart}

      **Server Name:** __${interaction.guild?.name}__
      **Member Count:** __${interaction.guild?.memberCount}__
    `, joinedHub);

    displayEmbed.execute(interaction);
  },
};
