import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, GuildTextBasedChannel } from 'discord.js';
import { totalConnected, disconnect, getConnection, createConnection } from '../../Structures/network';
import logger from '../../Utils/logger';
import displayEmbed from './displaySettings';
import onboarding from './onboarding';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const date = new Date();
    const emoji = interaction.client.emotes.normal;
    const destination = interaction.options.getChannel('destination', true) as GuildTextBasedChannel;

    const guildInSetup = await getConnection({ serverId: interaction.guild?.id });

    if (guildInSetup) return displayEmbed.execute(interaction);

    // Show new users rules & info about network
    const onboardingStatus = await onboarding.execute(interaction);
    if (!onboardingStatus) return;

    try {
      // Inserting channel to connectedlist
      await createConnection({
        channelId: destination.id,
        serverId: destination.guild.id,
        connected: true,
        profFilter: true,
        compact: false,
        date,
      });

      const numOfConnections = await totalConnected();
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
      return;
    }

    interaction.client.sendInNetwork(stripIndents`
      A new server has joined us in the Network! ${emoji.clipart}

      **Server Name:** __${interaction.guild?.name}__
      **Member Count:** __${interaction.guild?.memberCount}__
    `);

    displayEmbed.execute(interaction);
  },
};
