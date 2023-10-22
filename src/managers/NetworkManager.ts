import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  EmbedBuilder,
  HexColorString,
  Message,
  MessageCreateOptions,
  User,
  WebhookMessageCreateOptions,
} from 'discord.js';
import Factory from '../Factory.js';
import db from '../utils/Db.js';
import { Prisma, connectedList, hubs } from '@prisma/client';
import { REGEX, emojis } from '../utils/Constants.js';
import { censor } from '../utils/Profanity.js';
import { stripIndents } from 'common-tags';
import { HubSettingsBitField } from '../utils/BitFields.js';
import { replaceLinks } from '../utils/Utils.js';

export interface NetworkMessage extends Message {
  censoredContent: string;
}

export interface NetworkWebhookSendResult {
  messageOrError: Message | string;
  webhookURL: string;
}

export interface Networks extends connectedList {
  hub: hubs | null;
}

interface AntiSpamUserOpts {
  timestamps: number[];
  infractions: number;
}

const WINDOW_SIZE = 5000;
const MAX_STORE = 3;

export default class NetworkManager extends Factory {
  private antiSpamMap = new Collection<string, AntiSpamUserOpts>();

  public async handleNetworkMessage(message: NetworkMessage) {
    const isNetworkMessage = await db.connectedList.findFirst({
      where: { channelId: message.channel.id, connected: true },
      include: { hub: true },
    });

    // check if the message was sent in a network channel
    if (!isNetworkMessage?.hub) return;

    const settings = new HubSettingsBitField(isNetworkMessage.hub.settings);
    const checksPassed = await this.runChecks(message, settings, isNetworkMessage.hubId);
    if (!checksPassed) return;

    const allConnections = await this.fetchHubNetworks({ hubId: isNetworkMessage.hubId });

    message.censoredContent = censor(message.content);

    const attachment = message.attachments.first();
    const attachmentURL = attachment ? attachment.url : await this.getAttachmentURL(message);

    if (attachmentURL) {
      const reaction = await message.react(emojis.loading).catch(() => null);

      const nsfwDetector = this.client.getNSFWDetector();
      const predictions = await nsfwDetector.analyzeImage(
        attachment ? attachment.url : attachmentURL,
      );

      if (predictions && nsfwDetector.isUnsafeContent(predictions)) {
        const nsfwEmbed = new EmbedBuilder()
          .setTitle('NSFW Image Detected')
          .setDescription(
            stripIndents`
          I have identified this image as NSFW (Not Safe For Work). Sharing NSFW content is against our network guidelines. Refrain from posting such content here.
          
          **NSFW Detected:** ${Math.round(predictions[0].probability * 100)}%`,
          )
          .setFooter({
            text: 'Please be aware that AI predictions can be inaccurate at times, and we cannot guarantee perfect accuracy in all cases. 😔',
            iconURL: 'https://i.imgur.com/625Zy9W.png',
          })
          .setColor('Red');

        return await message.reply({ embeds: [nsfwEmbed] });
      }

      reaction?.remove().catch(() => null);
      // mark that the attachment url is being used
      message.react('🔗').catch(() => null);
    }

    // fetch the referred message  (message being replied to) from discord
    const referredMessage = message.reference ? await message.fetchReference() : undefined;
    // check if it was sent in the network
    const referenceInDb = referredMessage
      ? await db.messageData.findFirst({
        where: { channelAndMessageIds: { some: { messageId: referredMessage?.id } } },
      })
      : undefined;
    const referredContent =
      referenceInDb && referredMessage ? await this.getReferredContent(referredMessage) : undefined;
    const referredAuthor = referenceInDb
      ? await message.client.users.fetch(referenceInDb.authorId).catch(() => null)
      : null;

    // embeds for the normal mode
    const { embed, censoredEmbed } = this.buildNetworkEmbed(message, {
      attachmentURL,
      referredContent,
      embedCol: isNetworkMessage.embedColor as `#${string}` ?? undefined,
      useNicknames: settings.has('UseNicknames'),
    });

    const sendResult = allConnections.map(async (connection) => {
      try {
        // parse the webhook url and get the webhook id and token
        const webhookURL = connection.webhookURL.split('/');
        // fetch the webhook from discord
        const webhook = await this.client.fetchWebhook(
          webhookURL[webhookURL.length - 2],
          webhookURL[webhookURL.length - 1],
        );

        const reply = referenceInDb?.channelAndMessageIds.find(
          (msg) => msg.channelId === connection.channelId,
        );
        // create a jump button to reply button
        const jumpButton =
          reply && referredMessage?.author
            ? new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setEmoji(emojis.reply)
                .setURL(
                  `https://discord.com/channels/${connection.serverId}/${reply.channelId}/${reply.messageId}`,
                )
                .setLabel(
                  referredAuthor && referredAuthor.username.length >= 80
                    ? '@' + referredAuthor.username.slice(0, 76) + '...'
                    : '@' + referredAuthor?.username,
                ),
            )
            : null;

        // embed format
        let messageFormat: WebhookMessageCreateOptions = {
          components: jumpButton ? [jumpButton] : undefined,
          embeds: [connection.profFilter ? censoredEmbed : embed],
          username: `${isNetworkMessage.hub?.name}`,
          avatarURL: isNetworkMessage.hub?.iconUrl,
          threadId: connection.parentId ? connection.channelId : undefined,
          allowedMentions: { parse: [] },
        };

        if (connection.compact) {
          const replyContent =
            connection.profFilter && referredContent ? censor(referredContent) : referredContent;

          // preview embed for the message being replied to
          const replyEmbed = replyContent
            ? new EmbedBuilder({
              description:
                  replyContent.length > 30 ? replyContent?.slice(0, 30) + '...' : replyContent,
              author: {
                name: `${referredMessage?.author.username.slice(0, 30)}`,
                icon_url: referredMessage?.author.displayAvatarURL(),
              },
            }).setColor('Random')
            : undefined;

          // compact format (no embeds, only content)
          messageFormat = {
            embeds: replyEmbed ? [replyEmbed] : undefined,
            components: jumpButton ? [jumpButton] : undefined,
            content: (connection.profFilter ? message.censoredContent : message.content) +
            // append the attachment url if there is one
              `${attachmentURL ? `\n${attachmentURL}` : ''}`,
            username: message.author.username,
            avatarURL: message.author.displayAvatarURL(),
            threadId: connection.parentId ? connection.channelId : undefined,
            allowedMentions: { parse: [] },
          };
        }
        // send the message
        const messageOrError = await webhook.send(messageFormat);
        // return the message and webhook URL to store the message in the db
        return { messageOrError, webhookURL: connection.webhookURL } as NetworkWebhookSendResult;
      }
      catch (e) {
        // return the error and webhook URL to store the message in the db
        return {
          messageOrError: e.message,
          webhookURL: connection.webhookURL,
        } as NetworkWebhookSendResult;
      }
    });

    // only delete the message if there is no attachment
    // deleting attachments will make the image not show up in the embed (discord removes it from its cdn)
    if (!attachment) message.delete().catch(() => null);

    // store the message in the db
    await this.storeMessageData(message, await Promise.all(sendResult), isNetworkMessage.hubId);
  }

  public async runChecks(
    message: Message,
    settings: HubSettingsBitField,
    hubId: string,
  ): Promise<boolean> {
    const blacklistManager = this.client.getBlacklistManager();

    const isUserBlacklisted = await db.blacklistedUsers.findFirst({
      where: { userId: message.author.id, hubs: { some: { hubId: { equals: hubId } } } },
    });

    if (isUserBlacklisted) return false;

    if (message.content.length > 1000) {
      message.reply('Your message is too long! Please keep it under 1000 characters.');
      return false;
    }

    if (
      (settings.has('BlockInvites') && message.content.includes('discord.gg')) ||
      message.content.includes('discord.com/invite') ||
      message.content.includes('dsc.gg')
    ) {
      message.reply(
        'Do not advertise or promote servers in the network. Set an invite in `/connection` instead!',
      );
      return false;
    }

    if (message.stickers.size > 0 && !message.content) {
      message.reply(
        'Sending stickers in the network is not possible due to discord\'s limitations.',
      );
      return false;
    }

    const antiSpamResult = this.runAntiSpam(message.author, 3);
    if (antiSpamResult) {
      if (settings.has('SpamFilter') && antiSpamResult.infractions >= 3) {
        await blacklistManager.addUserBlacklist(
          hubId,
          message.author.id,
          'Auto-blacklisted for spamming.',
          60 * 5000,
        );
        blacklistManager.scheduleRemoval('user', message.author.id, hubId, 60 * 5000);
        blacklistManager
          .notifyBlacklist(
            'user',
            message.author.id,
            hubId,
            new Date(Date.now() + 60 * 5000),
            'Auto-blacklisted for spamming.',
          )
          .catch(() => null);
      }
      message.react(emojis.timeout).catch(() => null);
      return false;
    }

    if (message.content.length > 1000) {
      message.reply('Please keep your message shorter than 1000 characters long.');
      return false;
    }

    if (settings.has('HideLinks') && message.content.match(REGEX.LINKS)) {
      message.content = replaceLinks(message.content);
    }

    // TODO allow multiple attachments when embeds can have multiple images
    const attachment = message.attachments.first();
    const allowedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/jpg'];

    if (attachment?.contentType) {
      if (allowedTypes.includes(attachment.contentType) === false) {
        message.reply('Only images and gifs are allowed to be sent within the network.');
        return false;
      }

      if (attachment.size > 1024 * 1024 * 8) {
        message.reply('Please keep your attachments under 8MB.');
        return false;
      }
    }

    return true;
  }

  public async getReferredContent(referredMessage: Message) {
    let referredContent = referredMessage.content || referredMessage.embeds[0]?.description;

    if (!referredContent) {
      referredContent = '*Original message contains attachment <:attachment:1102464803647275028>*';
    }
    else if (referredContent.length > 1000) {
      referredContent = referredContent.slice(0, 1000) + '...';
    }

    return referredContent;
  }

  public async getAttachmentURL(message: Message) {
    // Tenor Gifs / Image URLs
    const URLMatch = message.content.match(REGEX.STATIC_IMAGE_URL);

    if (URLMatch) return URLMatch[0];

    const tenorRegex = /https:\/\/tenor\.com\/view\/.*-(\d+)/;
    const gifMatch = message.content.match(tenorRegex);

    if (gifMatch) {
      if (!process.env.TENOR_KEY) throw new TypeError('Tenor API key not found in .env file.');

      const n = gifMatch[0].split('-');
      const id = n.at(-1);
      const api = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;
      const gifJSON = await (await fetch(api)).json();

      return gifJSON.results[0].media[0].gif.url as string;
    }
    return null;
  }

  public buildNetworkEmbed(
    message: NetworkMessage,
    opts?: {
      attachmentURL?: string | null;
      embedCol?: HexColorString;
      referredContent?: string;
      useNicknames?: boolean;
    },
  ): { embed: EmbedBuilder; censoredEmbed: EmbedBuilder } {
    const embed = new EmbedBuilder()
      .setAuthor({
        name: opts?.useNicknames
          ? message.member?.displayName || message.author.displayName
          : message.author.username,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(message.content || null)
      .addFields(
        opts?.referredContent
          ? [
            {
              name: 'Replying To:',
              value: `> ${opts.referredContent.replaceAll('\n', '\n> ')}` ?? 'Unknown.',
            },
          ]
          : [],
      )
      .setFooter({
        text: `From: ${message.guild?.name}`,
        iconURL: message.guild?.iconURL() ?? undefined,
      })
      .setImage(opts?.attachmentURL ?? null)
      .setColor(opts?.embedCol ?? 'Random');

    const censoredEmbed = EmbedBuilder.from(embed)
      .setDescription(message.censoredContent || null)
      .setFields(
        opts?.referredContent
          ? [
            {
              name: 'Replying To:',
              value: `> ${censor(opts.referredContent).replaceAll('\n', '\n> ')}` ?? 'Unknown.',
            },
          ]
          : [],
      );

    return { embed, censoredEmbed };
  }

  /**
   * Stores message in the db after it has been sent to the network
   * And disconnects the network if the webhook is invalid
   * */
  protected async storeMessageData(
    message: Message,
    channelAndMessageIds: NetworkWebhookSendResult[],
    hubId: string,
  ): Promise<void> {
    const messageDataObj: { channelId: string; messageId: string }[] = [];
    const invalidWebhookURLs: string[] = [];

    // loop through all results and extract message data and invalid webhook urls
    channelAndMessageIds.forEach((result) => {
      if (typeof result.messageOrError === 'string') {
        if (
          result.messageOrError.includes('Invalid Webhook Token') ||
          result.messageOrError.includes('Unknown Webhook')
        ) {
          invalidWebhookURLs.push(result.webhookURL);
        }
      }
      else {
        messageDataObj.push({
          channelId: result.messageOrError.channelId,
          messageId: result.messageOrError.id,
        });
      }
    });

    if (message.guild && hubId) {
      // store message data in db
      await db.messageData.create({
        data: {
          hub: { connect: { id: hubId } },
          channelAndMessageIds: messageDataObj,
          timestamp: message.createdAt,
          authorId: message.author.id,
          serverId: message.guild.id,
          reference: message.reference,
          reactions: {},
        },
      });
    }

    // disconnect network if, webhook does not exist/bot cannot access webhook
    if (invalidWebhookURLs.length > 0) {
      await db.connectedList.updateMany({
        where: { webhookURL: { in: invalidWebhookURLs } },
        data: { connected: false },
      });
    }
  }

  runAntiSpam(author: User, maxInfractions = MAX_STORE) {
    const userInCol = this.antiSpamMap.get(author.id);
    const currentTimestamp = Date.now();

    if (userInCol) {
      if (userInCol.infractions >= maxInfractions) {
        // resetting count as it is assumed they will be blacklisted right after
        this.antiSpamMap.delete(author.id);
        return userInCol;
      }

      const { timestamps } = userInCol;

      if (timestamps.length === MAX_STORE) {
        // Check if all the timestamps are within the window
        const oldestTimestamp = timestamps[0];
        const isWithinWindow = currentTimestamp - oldestTimestamp <= WINDOW_SIZE;

        this.antiSpamMap.set(author.id, {
          timestamps: [...timestamps.slice(1), currentTimestamp],
          infractions: isWithinWindow ? userInCol.infractions + 1 : userInCol.infractions,
        });
        this.setSpamTimers(author.id);
        if (isWithinWindow) return userInCol;
      }
      else {
        this.antiSpamMap.set(author.id, {
          timestamps: [...timestamps, currentTimestamp],
          infractions: userInCol.infractions,
        });
      }
    }
    else {
      this.antiSpamMap.set(author.id, {
        timestamps: [currentTimestamp],
        infractions: 0,
      });
      this.setSpamTimers(author.id);
    }
  }

  setSpamTimers(userId: string): void {
    const five_min = 60 * 5000;
    const userInCol = this.antiSpamMap.get(userId);
    const scheduler = this.client.getScheduler();
    const lastMsgTimestamp = userInCol?.timestamps[userInCol.timestamps.length - 1];

    if (userInCol && lastMsgTimestamp && Date.now() - five_min <= lastMsgTimestamp) {
      scheduler.stopTask(`removeFromCol_${userId}`);
    }

    scheduler.addRecurringTask(`removeFromCol_${userId}`, new Date(Date.now() + five_min), () => {
      this.antiSpamMap.delete(userId);
    });
  }

  // TODO: Add Error handlers for these
  public async fetchHubNetworks(where: { hubId?: string; hubName?: string }) {
    return await db.connectedList.findMany({ where });
  }

  public async fetchConnection(where: Prisma.connectedListWhereInput) {
    return await db.connectedList.findFirst({ where });
  }

  async updateConnection(
    where: Prisma.connectedListWhereUniqueInput,
    data: Prisma.connectedListUpdateInput,
  ) {
    return await db.connectedList.update({ where, data });
  }

  async createConnection(data: Prisma.connectedListCreateInput) {
    return await db.connectedList.create({ data });
  }

  async sendToNetwork(hubId: string, message: string | MessageCreateOptions) {
    const connections = await this.fetchHubNetworks({ hubId });

    const res = connections.map(async (connection) => {
      const threadId = connection.parentId ? connection.channelId : undefined;
      const payload =
        typeof message === 'string' ? { content: message, threadId } : { ...message, threadId };

      try {
        const webhookURL = connection.webhookURL.split('/');
        const webhook = await this.client.fetchWebhook(
          webhookURL[webhookURL.length - 2],
          webhookURL[webhookURL.length - 1],
        );
        return webhook.send(payload);
      }
      catch {
        return null;
      }
    });

    return await Promise.all(res);
  }
}
