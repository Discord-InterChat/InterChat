import Constants, { emojis } from '#main/config/Constants.js';
import { getHubConnections } from '#main/utils/ConnectedListUtils.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import { ServerInfraction, UserInfraction } from '@prisma/client';
import {
  ActionRowBuilder,
  APIActionRowComponent,
  APIButtonComponent,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  Snowflake,
  TextInputBuilder,
  TextInputStyle,
  User,
} from 'discord.js';

export const isBlacklisted = <T extends UserInfraction | ServerInfraction>(
  infraction: T | null,
): infraction is T =>
  Boolean(
    infraction?.type === 'BLACKLIST' &&
      infraction.status === 'ACTIVE' &&
      (!infraction.expiresAt || infraction.expiresAt > new Date()),
  );

export const buildBlacklistNotifEmbed = (
  type: 'user' | 'server',
  opts: {
    hubName: string;
    expiresAt: Date | null;
    reason?: string;
  },
) => {
  const expireString = opts.expiresAt
    ? `<t:${Math.round(opts.expiresAt.getTime() / 1000)}:R>`
    : 'Never';

  const targetStr = type === 'user' ? 'You' : 'This server';

  return new EmbedBuilder()
    .setTitle(`${emojis.blobFastBan} Blacklist Notification`)
    .setDescription(`${targetStr} has been blacklisted from talking in hub **${opts.hubName}**.`)
    .setColor(Constants.Colors.interchatBlue)
    .setFields(
      { name: 'Reason', value: opts.reason ?? 'No reason provided.', inline: true },
      { name: 'Expires', value: expireString, inline: true },
    );
};

interface BlacklistOpts {
  target: User | { id: Snowflake };
  hubId: string;
  expiresAt: Date | null;
  reason?: string;
}

export const buildAppealSubmitButton = (type: 'user' | 'server', hubId: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID('appealSubmit:button', [type, hubId]).toString())
      .setLabel('Appeal Blacklist')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary),
  );

/** * Notify a user or server that they have been blacklisted. */
export const sendBlacklistNotif = async (
  type: 'user' | 'server',
  client: Client,
  opts: BlacklistOpts,
) => {
  try {
    const hub = await db.hub.findUnique({ where: { id: opts.hubId } });
    const embed = buildBlacklistNotifEmbed(type, {
      hubName: `${hub?.name}`,
      expiresAt: opts.expiresAt,
      reason: opts.reason,
    });

    let components: APIActionRowComponent<APIButtonComponent>[] = [];
    if (!opts.expiresAt || opts.expiresAt.getTime() > Date.now() + 60 * 60 * 24 * 1000) {
      components = [buildAppealSubmitButton(type, opts.hubId).toJSON()];
    }

    if (type === 'user') {
      await (opts.target as User).send({ embeds: [embed], components }).catch(() => null);
    }
    else {
      const serverInHub =
        (await getHubConnections(opts.hubId))?.find((con) => con.serverId === opts.target.id) ??
        (await db.connectedList.findFirst({
          where: { serverId: opts.target.id, hubId: opts.hubId },
        }));

      if (!serverInHub) return;
      await client.cluster.broadcastEval(
        async (_client, ctx) => {
          const channel = await _client.channels.fetch(ctx.channelId).catch(() => null);
          if (!_client.isGuildTextBasedChannel(channel)) return;

          await channel.send({ embeds: [ctx.embed], components: ctx.components }).catch(() => null);
        },
        {
          context: {
            components,
            channelId: serverInHub.channelId,
            embed: embed.toJSON(),
          },
        },
      );
    }
  }
  catch (error) {
    Logger.error(error);
  }
};

export const buildAppealSubmitModal = (type: 'server' | 'user', hubId: string) => {
  const questions: [string, string, TextInputStyle, boolean, string?][] = [
    ['blacklistedFor', 'Why were you blacklisted?', TextInputStyle.Paragraph, true],
    [
      'unblacklistReason',
      'Appeal Reason',
      TextInputStyle.Paragraph,
      true,
      `Why do you think ${type === 'server' ? 'this server' : 'you'} should be unblacklisted?`,
    ],
    ['extras', 'Anything else you would like to add?', TextInputStyle.Paragraph, false],
  ];

  const actionRows = questions.map(([fieldCustomId, label, style, required, placeholder]) => {
    const input = new TextInputBuilder()
      .setCustomId(fieldCustomId)
      .setLabel(label)
      .setStyle(style)
      .setMinLength(20)
      .setRequired(required);

    if (placeholder) input.setPlaceholder(placeholder);
    return new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input);
  });

  return new ModalBuilder()
    .setTitle('Blacklist Appeal')
    .setCustomId(new CustomID('appealSubmit:modal', [type, hubId]).toString())
    .addComponents(actionRows);
};
