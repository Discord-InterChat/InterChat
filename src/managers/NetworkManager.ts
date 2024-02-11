import {
  APIMessage,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  EmbedBuilder,
  HexColorString,
  Message,
  User,
  WebhookClient,
  WebhookMessageCreateOptions,
} from 'discord.js';
import db from '../utils/Db.js';
import { connectedList, hubs, originalMessages } from '@prisma/client';
import { LINKS, REGEX, emojis } from '../utils/Constants.js';
import { check as checkProfanity, censor } from '../utils/Profanity.js';
import { HubSettingsBitField } from '../utils/BitFields.js';
import { parseTimestampFromId, replaceLinks, wait } from '../utils/Utils.js';
import { t } from '../utils/Locale.js';
import sendMessage from '../scripts/network/sendMessage.js';

export interface NetworkWebhookSendResult {
  messageOrError: APIMessage | string;
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

export default class NetworkManager {
  private antiSpamMap = new Collection<string, AntiSpamUserOpts>();

  /**
   * Handles a network message by running checks, fetching relevant data, and sending the message to all connections in the network.
   * @param message The network message to handle.
   */
  public async onMessageCreate(message: Message) {
    if (message.author.bot || message.system || message.webhookId) return;

    message.author.locale = await message.client.getUserLocale(message.author.id);
    const { locale } = message.author;

    const isNetworkMessage = await db.connectedList.findFirst({
      where: { channelId: message.channel.id, connected: true },
      include: { hub: true },
    });

    // check if the message was sent in a network channel
    if (!isNetworkMessage?.hub) return;

    const settings = new HubSettingsBitField(isNetworkMessage.hub.settings);

    // run checks on the message to determine if it can be sent in the network
    if (!(await this.runChecks(message, settings, isNetworkMessage.hubId))) return;

    const allConnections = await this.fetchHubNetworks({
      hubId: isNetworkMessage.hubId,
      connected: true,
    });

    const attachment = message.attachments.first();
    const attachmentURL = attachment
      ? attachment.url
      : await this.getAttachmentURL(message.content);

    if (attachmentURL) {
      const reaction = await message.react(emojis.loading).catch(() => null);

      // run static images through the nsfw detector
      if (REGEX.STATIC_IMAGE_URL.test(attachmentURL)) {
        const predictions = await message.client.nsfwDetector.analyzeImage(
          attachment ? attachment.url : attachmentURL,
        );

        if (predictions && message.client.nsfwDetector.isUnsafeContent(predictions)) {
          const nsfwEmbed = new EmbedBuilder()
            .setTitle(t({ phrase: 'network.nsfw.title', locale }))
            .setDescription(
              t(
                { phrase: 'network.nsfw.description', locale },
                {
                  predictions: `${Math.round(predictions[0].probability * 100)}%`,
                  rules_command: '</rules:924659340898619395>',
                },
              ),
            )
            .setFooter({
              text: t({ phrase: 'network.nsfw.footer', locale }),
              iconURL: 'https://i.imgur.com/625Zy9W.png',
            })
            .setColor('Red');

          await message.channel.send({ content: `${message.author}`, embeds: [nsfwEmbed] });
          return;
        }
      }

      reaction?.remove().catch(() => null);
      // mark that the attachment url is being used
      message.react('🔗').catch(() => null);
    }

    const censoredContent = censor(message.content);

    // fetch the referred message  (message being replied to) from discord
    const referredMessage = message.reference
      ? await message.fetchReference().catch(() => undefined)
      : undefined;

    // check if it was sent in the network
    const referenceInDb = referredMessage
      ? (
        await db.broadcastedMessages.findFirst({
          where: { messageId: referredMessage?.id },
          include: { originalMsg: { include: { broadcastMsgs: true } } },
        })
      )?.originalMsg
      : undefined;

    let referredContent: string | undefined = undefined;
    let referredAuthor: User | null = null;

    // only assign to this variable if one of these two conditions are true, not always
    if (referredMessage) {
      if (referredMessage?.author.id === message.client.user.id) {
        referredContent = await this.getReferredContent(referredMessage);
        referredAuthor = message.client.user;
      }
      else if (referenceInDb) {
        referredContent = await this.getReferredContent(referredMessage);
        referredAuthor = await message.client.users.fetch(referenceInDb.authorId).catch(() => null);
      }
    }

    const username = (
      settings.has('UseNicknames')
        ? message.member?.displayName || message.author.displayName
        : message.author.username
    ).slice(0, 50);

    // embeds for the normal mode
    const { embed, censoredEmbed } = this.buildNetworkEmbed(message, username, censoredContent, {
      attachmentURL,
      referredContent,
      embedCol: (isNetworkMessage.embedColor as HexColorString) ?? undefined,
    });

    const sendResult = allConnections.map(async (connection, index) => {
      // wait 1 second every 50 messages to avoid rate limits
      if (index % 50) await wait(1000);

      try {
        const reply = referenceInDb?.broadcastMsgs.find(
          (msg) => msg.channelId === connection.channelId,
        );
        // create a jump to reply button
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
              description: replyContent,
              author: {
                name: `${referredAuthor?.username.slice(0, 30)}`,
                icon_url: referredAuthor?.displayAvatarURL(),
              },
            }).setColor('Random')
            : undefined;

          // compact format (no embeds, only content)
          messageFormat = {
            embeds: replyEmbed ? [replyEmbed] : undefined,
            components: jumpButton ? [jumpButton] : undefined,
            content:
              (connection.profFilter ? censoredContent : message.content) +
              // append the attachment url if there is one
              `${attachment ? `\n${attachmentURL}` : ''}`,
            // username is already limited to 50 characters, server name is limited to 40 (char limit is 100)
            username: `@${username} • ${message.guild?.name.slice(0, 40)}`,
            avatarURL: message.author.displayAvatarURL(),
            threadId: connection.parentId ? connection.channelId : undefined,
            allowedMentions: { parse: [] },
          };
        }
        // send the message
        const messageOrError = await sendMessage(messageFormat, connection.webhookURL);

        // return the message and webhook URL to store the message in the db
        return {
          messageOrError: messageOrError,
          webhookURL: connection.webhookURL,
        } as NetworkWebhookSendResult;
      }
      catch (e) {
        // return the error and webhook URL to store the message in the db
        return {
          messageOrError: e.message,
          webhookURL: connection.webhookURL,
        } as NetworkWebhookSendResult;
      }
    });

    const userData = await db.userData.findFirst({
      where: { userId: message.author.id, viewedNetworkWelcome: true },
    });

    if (!userData) {
      await db.userData.upsert({
        where: { userId: message.author.id },
        create: {
          userId: message.author.id,
          username: message.author.username,
          viewedNetworkWelcome: true,
        },
        update: { viewedNetworkWelcome: true },
      });

      const linkButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setEmoji(emojis.add_icon)
          .setLabel('Invite Me!')
          .setURL(LINKS.APP_DIRECTORY),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setEmoji(emojis.code_icon)
          .setLabel('Support Server')
          .setURL(LINKS.SUPPORT_INVITE),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setEmoji(emojis.docs_icon)
          .setLabel('How-To Guide')
          .setURL(LINKS.DOCS),
      );

      await message.channel
        .send({
          content: t(
            { phrase: 'network.welcome', locale },
            {
              user: `${message.author}`,
              hub: isNetworkMessage.hub.name,
              channel: `${message.channel}`,
              emoji: emojis.wave_anim,
              rules_command: '</rules:924659340898619395>',
            },
          ),
          components: [linkButtons],
        })
        .catch(() => null);
    }

    // only delete the message if there is no attachment or if the user has already viewed the welcome message
    // deleting attachments will make the image not show up in the embed (discord removes it from its cdn)
    if (!attachment) message.delete().catch(() => null);

    // store the message in the db
    await this.storeMessageData(
      message,
      await Promise.all(sendResult),
      isNetworkMessage.hubId,
      referenceInDb,
    );
  }

  /**
   * Runs various checks on a message to determine if it can be sent in the network.
   * @param message - The message to check.
   * @param settings - The settings for the network.
   * @param hubId - The ID of the hub the message is being sent in.
   * @returns A boolean indicating whether the message passed all checks.
   */
  public async runChecks(message: Message, settings: HubSettingsBitField, hubId: string) {
    if (!message.inGuild()) return false;

    const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
    // if account is created within the last 7 days
    if (message.author.createdTimestamp > sevenDaysAgo) {
      await message.channel.send(
        t(
          { phrase: 'network.accountTooNew', locale: message.author.locale },
          { user: `${message.author}`, emoji: emojis.no },
        ),
      );
      return false;
    }

    const isUserBlacklisted = await db.userData.findFirst({
      where: { userId: message.author.id, blacklistedFrom: { some: { hubId: { equals: hubId } } } },
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
      const { blacklistManager } = message.client;

      if (settings.has('SpamFilter') && antiSpamResult.infractions >= 3) {
        await blacklistManager.addUserBlacklist(
          hubId,
          message.author.id,
          'Auto-blacklisted for spamming.',
          message.client.user.id,
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

    if (
      settings.has('HideLinks') &&
      !REGEX.IMAGE_URL.test(message.content) && // ignore image urls
      REGEX.LINKS.test(message.content)
    ) {
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

    const { profanity, slurs } = checkProfanity(message.content);

    if (profanity || slurs) {
      // send a log to the log channel set by the hub
      message.client.profanityLogger.log(hubId, message.content, message.author, message.guild);

      // we don't want to send the message if it contains slurs
      if (slurs) return false;
    }

    return true;
  }

  /**
   * Retrieves the content of a referred message, which can be either the message's text content or the description of its first embed.
   * If the referred message has no content, returns a default message indicating that the original message contains an attachment.
   * If the referred message's content exceeds 1000 characters, truncates it and appends an ellipsis.
   * @param referredMessage The message being referred to.
   * @returns The content of the referred message.
   */
  public async getReferredContent(referredMessage: Message) {
    let referredContent = referredMessage.content || referredMessage.embeds[0]?.description;

    if (!referredContent) {
      referredContent = '*Original message contains attachment <:attachment:1102464803647275028>*';
    }
    else if (referredContent.length > 100) {
      referredContent = referredContent.slice(0, 100) + '...';
    }

    return referredContent;
  }

  /**
   * Returns the URL of an attachment in a message, if it exists.
   * @param message The message to search for an attachment URL.
   * @returns The URL of the attachment, or null if no attachment is found.
   */
  public async getAttachmentURL(string: string) {
    // Tenor Gifs / Image URLs
    const URLMatch = string.match(REGEX.IMAGE_URL);
    if (URLMatch) return URLMatch[0];

    const gifMatch = string.match(REGEX.TENOR_LINKS);

    if (gifMatch) {
      if (!process.env.TENOR_KEY) throw new TypeError('Tenor API key not found in .env file.');

      const n = gifMatch[0].split('-');
      const id = n.at(-1);
      const api = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;
      const gifJSON = await (await fetch(api)).json();

      return gifJSON.results.at(0)?.media.at(0)?.gif.url as string | null;
    }
    return null;
  }

  /**
   * Builds an embed for a network message.
   * @param message The network message to build the embed for.
   * @param opts Optional parameters for the embed.
   * @param opts.attachmentURL The URL of the attachment to include in the embed.
   * @param opts.embedCol The color of the embed.
   * @param opts.referredContent The content of the message being replied to.
   * @param opts.useNicknames Whether to use nicknames instead of usernames in the embed.
   * @returns An object containing the built EmbedBuilder and its censored version.
   */
  public buildNetworkEmbed(
    message: Message,
    username: string,
    censoredContent: string,
    opts?: {
      attachmentURL?: string | null;
      embedCol?: HexColorString;
      referredContent?: string;
    },
  ): { embed: EmbedBuilder; censoredEmbed: EmbedBuilder } {
    const formattedReply = opts?.referredContent?.replaceAll('\n', '\n> ');

    const embed = new EmbedBuilder()
      .setAuthor({
        name: username,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(
        // remove tenor links and image urls from the content
        (opts?.attachmentURL
          ? message.content.replace(REGEX.TENOR_LINKS, '').replace(opts?.attachmentURL, '')
          : message.content) || null,
      )
      .addFields(
        formattedReply
          ? [
            {
              name: 'Replying To:',
              value: `> ${formattedReply}` ?? 'Unknown.',
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
      .setDescription(
        // remove tenor links and image urls from the content
        (opts?.attachmentURL
          ? censoredContent.replace(REGEX.TENOR_LINKS, '').replace(opts?.attachmentURL, '')
          : censoredContent) || null,
      )
      .setFields(
        formattedReply
          ? [
            {
              name: 'Replying To:',
              value: `> ${censor(formattedReply)}` ?? 'Unknown.',
            },
          ]
          : [],
      );

    return { embed, censoredEmbed };
  }

  /**
   * Stores message data in the database and updates the connectedList based on the webhook status.
   * @param channelAndMessageIds The result of sending the message to multiple channels.
   * @param hubId The ID of the hub to connect the message data to.
   */
  protected async storeMessageData(
    message: Message,
    channelAndMessageIds: NetworkWebhookSendResult[],
    hubId: string,
    dbReference?: originalMessages | null,
  ): Promise<void> {
    const messageDataObj: { channelId: string; messageId: string; createdAt: number }[] = [];
    const invalidWebhookURLs: string[] = [];

    // loop through all results and extract message data and invalid webhook urls
    channelAndMessageIds.forEach((result) => {
      if (typeof result.messageOrError === 'string') {
        if (
          result.messageOrError.includes('Invalid Webhook Token') ||
          result.messageOrError.includes('Unknown Webhook') ||
          result.messageOrError.includes('Missing Permissions')
        ) {
          invalidWebhookURLs.push(result.webhookURL);
        }
      }
      else {
        messageDataObj.push({
          channelId: result.messageOrError.channel_id,
          messageId: result.messageOrError.id,
          createdAt: parseTimestampFromId(result.messageOrError.id),
        });
      }
    });

    if (message.guild && hubId) {
      // store message data in db
      await db.originalMessages.create({
        data: {
          messageId: message.id,
          authorId: message.author.id,
          serverId: message.guild.id,
          messageReference: dbReference?.messageId,
          broadcastMsgs: { createMany: { data: messageDataObj } },
          hub: { connect: { id: hubId } },
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

  /**
   * Runs the anti-spam mechanism for a given user.
   * @param author - The user to run the anti-spam mechanism for.
   * @param maxInfractions - The maximum number of infractions before the user is blacklisted.
   * @returns The user's anti-spam data if they have reached the maximum number of infractions, otherwise undefined.
   */
  public runAntiSpam(author: User, maxInfractions = MAX_STORE) {
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
        this.setSpamTimers(author);
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
      this.setSpamTimers(author);
    }
  }

  /**
   * Sets spam timers for a given user.
   * @param userId - The ID of the user to set spam timers for.
   * @returns void
   */
  public setSpamTimers(user: User): void {
    const five_min = 60 * 5000;
    const userInCol = this.antiSpamMap.get(user.id);
    const scheduler = user.client.getScheduler();
    const lastMsgTimestamp = userInCol?.timestamps[userInCol.timestamps.length - 1];

    if (lastMsgTimestamp && Date.now() - five_min <= lastMsgTimestamp) {
      scheduler.stopTask(`removeFromCol_${user.id}`);
    }

    scheduler.addRecurringTask(`removeFromCol_${user.id}`, new Date(Date.now() + five_min), () => {
      this.antiSpamMap.delete(user.id);
    });
  }

  // TODO: Add Error handlers for these
  public async fetchHubNetworks(where: { hubId?: string; hubName?: string; connected?: boolean }) {
    return await db.connectedList.findMany({ where });
  }

  /**
   * Sends a message to all connections in a hub's network.
   * @param hubId The ID of the hub to send the message to.
   * @param message The message to send. Can be a string or a MessageCreateOptions object.
   * @returns A array of the responses from each connection's webhook.
   */
  async sendToHub(hubId: string, message: string | WebhookMessageCreateOptions) {
    const connections = await this.fetchHubNetworks({ hubId });

    const res = connections
      .filter((c) => c.connected === true)
      .map(async (connection) => {
        const threadId = connection.parentId ? connection.channelId : undefined;
        const payload =
          typeof message === 'string' ? { content: message, threadId } : { ...message, threadId };

        const webhook = new WebhookClient({ url: connection.webhookURL });
        return webhook.send(payload).catch(() => null);
      });

    return res;
  }
}
