import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, GuildTextBasedChannel } from 'discord.js';
import { connect, totalConnected, disconnect } from '../../Structures/network';
import { getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import displayEmbed from './displaySettings';
import onboarding from './onboarding';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const date = new Date();
    const emoji = interaction.client.emoji.normal;
    const destination = interaction.options.getChannel('destination', true) as GuildTextBasedChannel;

    const { setup } = getDb();
    const guildInSetup = await setup.findFirst({ where: { guildId: interaction.guild?.id } });

    if (guildInSetup) return displayEmbed.execute(interaction);

    // Show new users rules & info about network
    const onboardingStatus = await onboarding.execute(interaction);
    if (!onboardingStatus) return;

    try {
      // Inserting channel to setup and connectedlist
      await connect(destination);
      await setup?.create({
        data: {
          guildId: String(interaction.guild?.id),
          channelId: destination?.id,
          date: date,
          compact: false,
          profFilter: true,
          webhook: null,
        },
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
      disconnect({ serverId: interaction.guild?.id });
      await setup?.delete({ where: { channelId: destination?.id } });
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
