import { stripIndents } from 'common-tags';
import { ChannelType, AnySelectMenuInteraction, ChatInputCommandInteraction, TextChannel, ThreadChannel, ButtonInteraction } from 'discord.js';
import { hubs } from '@prisma/client';
import { getDb } from '../../Utils/utils';
import { sendInNetwork } from '../../Utils/network';
import emojis from '../../Utils/JSON/emoji.json';

type InteractionType = AnySelectMenuInteraction | ButtonInteraction | ChatInputCommandInteraction;


export default {
  async execute(
    interaction: InteractionType,
    hub: hubs,
    networkChannel: TextChannel | ThreadChannel,
  ) {
    const webhook = await this.getOrCreateWebhook(networkChannel, interaction.client.user?.displayAvatarURL());
    if (!webhook) return;

    const emoji = emojis.normal;
    const { connectedList } = getDb();
    const createdConnection = await connectedList.create({
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


    const numOfConnections = await connectedList.count({ where: { hubId: hub.id } });
    await networkChannel?.send(
      `This channel has been connected with **${hub.name}**. ${
        numOfConnections > 1
          ? `You are currently with ${numOfConnections - 1} other servers, Enjoy! ${emoji.clipart}`
          : `It seems no one else is there currently... *cricket noises* ${emoji.clipart}`
      }`,
    );

    sendInNetwork({
      content: stripIndents`
      A new server has joined us! ${emoji.clipart}

      **Server Name:** __${interaction.guild?.name}__
      **Member Count:** __${interaction.guild?.memberCount}__
    ` }, hub.id);

    // return the created connection so we can use it in the next step
    return createdConnection;
  },

  async getOrCreateWebhook(channel: TextChannel | ThreadChannel, avatar: string | null) {
    const channelOrParent = channel.type === ChannelType.GuildText ? channel : channel.parent;
    const webhooks = await channelOrParent?.fetchWebhooks();
    const existingWebhook = webhooks?.find((w) => w.owner?.id === channel.client.user?.id);

    if (existingWebhook) {
      return existingWebhook;
    }

    return channelOrParent?.createWebhook({
      name: 'InterChat Network',
      avatar,
    });
  },
};
