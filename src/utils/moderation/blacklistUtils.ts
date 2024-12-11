import Constants, { emojis } from '#utils/Constants.js';
import { getHubConnections } from '#utils/ConnectedListUtils.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import Logger from '#utils/Logger.js';
import { Infraction } from '@prisma/client';
import {
  ActionRowBuilder,
  APIActionRowComponent,
  APIButtonComponent,
  Client,
  EmbedBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  Snowflake,
  TextInputBuilder,
  TextInputStyle,
  User,
} from 'discord.js';
import { buildAppealSubmitButton } from '#main/interactions/BlacklistAppeal.js';
import { HubService } from '#main/services/HubService.js';

export const isBlacklisted = (infraction: Infraction | null): infraction is Infraction =>
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

/** * Notify a user or server that they have been blacklisted. */
export const sendBlacklistNotif = async (
  type: 'user' | 'server',
  client: Client,
  opts: BlacklistOpts,
) => {
  try {
    const hub = await new HubService().fetchHub(opts.hubId);
    const embed = buildBlacklistNotifEmbed(type, {
      hubName: `${hub?.data.name}`,
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
        (await db.connection.findFirst({
          where: { serverId: opts.target.id, hubId: opts.hubId },
        }));

      if (!serverInHub) return;
      await client.cluster.broadcastEval(
        async (_client, ctx) => {
          const channel = await _client.channels.fetch(ctx.channelId).catch(() => null);
          if (!channel?.isSendable()) return;

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
