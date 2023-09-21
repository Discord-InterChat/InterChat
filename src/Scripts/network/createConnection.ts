import { stripIndents } from 'common-tags';
import { ChannelType, AnySelectMenuInteraction, ChatInputCommandInteraction, TextChannel, ThreadChannel, ButtonInteraction } from 'discord.js';
import { disconnect } from '../../Utils/network/network';
import { hubs } from '@prisma/client';
import onboarding from './onboarding';
import { getDb } from '../../Utils/misc/utils';
import logger from '../../Utils/logger';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  async execute(
    interaction: AnySelectMenuInteraction | ButtonInteraction | ChatInputCommandInteraction,
    hub: hubs,
    networkChannel: TextChannel | ThreadChannel,
    ephemeral = false,
  ) {
    const emoji = emojis.normal;

    // Show new users rules & info about network
    const onboardingStatus = await onboarding.execute(interaction, hub.name, networkChannel.id, ephemeral);
    // if user cancelled onboarding or didn't click any buttons, stop here
    if (!onboardingStatus) return;

    let createdConnection;
    try {
      let webhook;
      if (networkChannel.isThread() && networkChannel.parent) {
        const webhooks = await networkChannel.parent.fetchWebhooks();
        const webhookCreated = webhooks.find((w) => w.owner?.id === interaction.client.user?.id);

        if (webhookCreated) {
          webhook = webhookCreated;
        }
        else {
          webhook = await networkChannel.parent.createWebhook({
            name: 'InterChat Network',
            avatar: interaction.client.user?.avatarURL(),
          });
        }
      }
      else if (networkChannel.type === ChannelType.GuildText) {
        webhook = await networkChannel.createWebhook({
          name: 'InterChat Network',
          avatar: interaction.client.user?.avatarURL(),
        });
      }
      else {
        return interaction.followUp(
          'This channel is not supported for InterChat. Please use a text channel or a thread.',
        );
      }

      const { connectedList } = getDb();
      createdConnection = await connectedList.create({
        data: {
          channelId: networkChannel.id,
          parentId: networkChannel.isThread() ? networkChannel.id : undefined,
          serverId: networkChannel.guild.id,
          webhookURL: webhook.url,
          connected: true,
          profFilter: true,
          compact: false,
          hub: { connect: { id: hub.id } },
        },
      });

      const numOfConnections = await connectedList.count({ where: { hub: { id: hub.id } } });
      await networkChannel?.send(
        `This channel has been connected with **${hub.name}**. ${
          numOfConnections > 1
            ? `You are currently with ${numOfConnections - 1} other servers, Enjoy! ${
              emoji.clipart
            }`
            : `It seems no one else is there currently... *cricket noises* ${emoji.clipart}`
        }`,
      );
    }
    catch (err: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger.error(err);
      if (err.message === 'Missing Permissions' || err.message === 'Missing Access') {
        const errMsg = `${emoji.no} Please make sure you have granted me \`Manage Webhooks\` and \`View Channel\` permissions for the selected channel.`;
        interaction.deferred || interaction.replied
          ? interaction.followUp(errMsg)
          : interaction.reply(errMsg);
      }
      else {
        const errMsg = `An error occurred while connecting to the InterChat network! Please report this to the developers: \`\`\`js\n${err.message}\`\`\``;
        interaction.deferred || interaction.replied
          ? interaction.followUp(errMsg)
          : interaction.reply(errMsg);
      }
      disconnect(networkChannel.id);
      return;
    }

    interaction.client.sendInNetwork(
      stripIndents`
      A new server has joined us! ${emoji.clipart}

      **Server Name:** __${interaction.guild?.name}__
      **Member Count:** __${interaction.guild?.memberCount}__
    `,
      { id: hub.id },
    );

    // return the created connection so we can use it in the next step
    return createdConnection;
  },
};
