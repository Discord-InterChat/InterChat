import db from './utils/Db.js';
import SuperClient from './SuperClient.js';
import CommandManager from './managers/CommandManager.js';
import { NetworkMessage } from './managers/NetworkManager.js';
import { check } from './utils/Profanity.js';
import {
  APIEmbed,
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  resolveColor,
} from 'discord.js';
import { stripIndents } from 'common-tags';
import { channels, colors, emojis, mascotEmojis } from './utils/Constants.js';

class InterChat extends SuperClient {
  public constructor() {
    super();

    this.on('ready', () => {
      // initialize the client
      this.init();

      // load commands
      CommandManager.loadCommandFiles();

      this.logger.info(
        `Logged in as ${this.user?.tag}! Cached ${this.guilds.cache.size} guilds on Cluster ${this.cluster?.id}.`,
      );
    });

    this.on('guildCreate', async (guild) => {
      const checkProfanity = check(guild.name);
      const isProfane = checkProfanity.profanity || checkProfanity.slurs;

      this.cluster.broadcastEval(
        async (client, ctx) => {
          const goalChannel = client.channels.cache.get(ctx.goalChannel);

          if (goalChannel?.isTextBased()) {
            const count = (await client.cluster.fetchClientValues('guilds.cache.size')) as number[];
            const guildCount = count.reduce((p, n) => p + n, 0);
            const ordinalSuffix = guildCount.toString().endsWith('1') ? 'st' : 'th';

            const goalEmbed: APIEmbed = {
              color: ctx.color,
              author: {
                name: `${ctx.guild.name} • ${ctx.guild.memberCount} members • ${ctx.guild.id}`,
                icon_url: ctx.guild.iconURL,
              },
            };

            // send message to support server notifying of new guild
            await goalChannel.send({
              content: `${ctx.flushedEmoji} I've just joined  ${ctx.guild.name}, making it my **${guildCount}${ordinalSuffix}** guild! 🎉`,
              embeds: [goalEmbed],
            });
          }
        },
        {
          context: {
            guild: {
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount,
              iconURL: guild.iconURL() || undefined,
            },
            color: resolveColor(colors.interchatBlue),
            goalChannel: channels.goal,
            flushedEmoji: mascotEmojis.flushed,
          },
        },
      );

      // notify the person who added the bot
      const embed = new EmbedBuilder()
        // .setTitle(`Thank you for inviting me! ${emojis.tada}`)
        .setDescription(
          stripIndents`        
          👋 Hey there! Step into the world of ${guild.client.user.username}, where chatting across servers is a delightful breeze! 🚀 Explore public hubs, connect with multiple servers, and add a splash of excitement to your server experience! ${emojis.clipart}
          ### Let's make this journey even more enjoyable:
          
          - Discover your perfect hub with </hub browse:1107639810014847049>.
          - Dive into the fun with </hub join:1107639810014847049> and be part of the inter-server celebration!
          - Fancy being a hub master? Start your own hub with </hub create:1107639810014847049> and bring your friends along for the ride!
          - Just a gentle reminder to dance to the beat of our network </rules:924659340898619395>. 
          🎶 Unlock some cool perks by showing your love on [top.gg](https://top.gg/bot/769921109209907241/vote)!
          
          For a deeper dive, check out the [guide](https://discord-interchat.github.io/docs/). Your adventure with ${guild.client.user.username} is about to begin! 🌟 Questions or feedback? Join us in the [official support server](https://discord.gg/6bhXQynAPs). Happy chatting! 🎊
          `,
        )
        .setColor(colors.interchatBlue)
        .setFooter({ text: `Sent for: ${guild.name}`, iconURL: guild.iconURL() || undefined });

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Docs')
          .setURL('https://discord-interchat.github.io/docs/setup')
          .setEmoji('📚')
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel('Terms')
          .setURL('https://discord-interchat.github.io/docs/legal/terms')
          .setEmoji('📜')
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel('Privacy')
          .setURL('https://discord-interchat.github.io/docs/legal/privacy')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Link),
      );

      const profaneErrorEmbed = new EmbedBuilder()
        .setTitle('Leave Notice 👋')
        .setDescription(
          `${emojis.no} Your server name contains profanity and or sensitive content. Please change it before using InterChat.`,
        )
        .setColor(colors.invisible)
        .setFooter({ text: `Sent for: ${guild.name}`, iconURL: guild.iconURL() || undefined });

      if (guild.members.me?.permissions.has('ViewAuditLog')) {
        const auditLog = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
        const entry = auditLog.entries.first();

        // send message to the person who added the bot
        await entry?.executor?.send({ embeds: [embed], components: [buttons] }).catch(() => null);

        if (isProfane) {
          await entry?.executor?.send({ embeds: [profaneErrorEmbed] }).catch(() => null);
          await guild.leave();
          return;
        }
      }
      else {
        const firstChannel = guild.channels.cache
          .filter(
            (c) =>
              c.type === ChannelType.GuildText && c.permissionsFor(guild.id)?.has('SendMessages'),
          )
          .first() as TextChannel;

        if (isProfane) {
          await firstChannel?.send({ embeds: [profaneErrorEmbed] }).catch(() => null);
          await guild.leave();
          return;
        }

        await firstChannel?.send({ embeds: [embed], components: [buttons] }).catch(() => null);
      }
    });

    // delete guild from database
    this.on('guildDelete', async (guild) => {
      this.logger.info(`Left ${guild.name} (${guild.id})`);
      await db.connectedList.deleteMany({ where: { serverId: guild.id } });

      const count = (await this.cluster.fetchClientValues('guilds.cache.size')) as number[];
      const guildCount = count.reduce((p, n) => p + n, 0);
      const guildOwner = await this.users.fetch(guild.ownerId).catch(() => null);

      const goalDesc = stripIndents`
      I am now in **${guildCount}** servers again 🥲
      
      **Server Info**
      - Members: ${guild.memberCount}
      - Owner: ${guildOwner?.username || 'Unknown'}
      - Created: <t:${Math.round(guild.createdTimestamp / 1000)}:F>
      `;

      // send message to support server notifying of leave
      // we cant access any variables/functions or anything inside the broadcastEval callback so we pass it in as context
      this.cluster.broadcastEval(
        async (client, ctx) => {
          const goalChannel = await client.channels.fetch(ctx.goalChannel).catch(() => null);

          if (goalChannel?.isTextBased()) {
            const goalEmbed: APIEmbed = {
              color: ctx.color,
              title: `I have been kicked from ${ctx.guild.name} 👢`,
              thumbnail: ctx.guild.iconURL ? { url: ctx.guild.iconURL } : undefined,
              description: ctx.goalDesc,
              footer: {
                text: `ID: ${ctx.guild.id}`,
                icon_url: ctx.guild.iconURL,
              },
            };

            await goalChannel.send({ embeds: [goalEmbed] });
          }
        },
        {
          context: {
            guild: {
              id: guild.id,
              name: guild.name,
              iconURL: guild.iconURL() || undefined,
            },
            goalDesc,
            color: resolveColor(colors.interchatBlue),
            goalChannel: channels.goal,
          },
        },
      );
    });

    // handle slash/ctx commands
    this.on('interactionCreate', (interaction) =>
      this.getCommandManager().handleInteraction(interaction),
    );

    // handle network reactions
    this.on('messageReactionAdd', (reaction, user) =>
      this.getReactionUpdater().listenForReactions(reaction, user),
    );

    // handle messages
    this.on('messageCreate', async (message) => {
      if (message.author.bot || message.system || message.webhookId) return;

      this.getNetworkManager().handleNetworkMessage(message as NetworkMessage);
    });
  }
}

const client = new InterChat();

client.login(process.env.TOKEN);
