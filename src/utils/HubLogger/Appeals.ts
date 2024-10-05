import Constants, { emojis } from '#main/config/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import { toTitleCase } from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  codeBlock,
  EmbedBuilder,
  Snowflake,
  User,
} from 'discord.js';

export const logAppeals = async (
  type: 'user' | 'server',
  hubId: string,
  appealer: User,
  opts: {
    appealsChannelId: Snowflake;
    appealsRoleId: Snowflake | null;
    appealName?: string;
    appealTargetId: Snowflake;
    appealIconUrl?: string;
    fields: {
      blacklistedFor: string;
      unblacklistReason: string;
      extras?: string;
    };
  },
) => {
  const appealEmbed = new EmbedBuilder()
    .setAuthor({
      name: `${toTitleCase(type)} Blacklist Appeal`,
      iconURL: opts.appealIconUrl,
    })
    .setTitle(`Appealing for ${opts.appealName} (${opts.appealTargetId})`)
    .addFields(
      {
        name: 'Why were you/this server blacklisted?',
        value: codeBlock(opts.fields.blacklistedFor),
        inline: false,
      },
      {
        name: `Why do you think ${type === 'server' ? 'this server' : 'you'} should be unblacklisted?`,
        value: codeBlock(opts.fields.unblacklistReason),
        inline: false,
      },
      {
        name: 'Anything else you would like to add?',
        value: codeBlock(opts.fields.extras ?? 'N/A'),
        inline: false,
      },
    )
    .setFooter({
      text: `Appeal submitted by ${appealer.username}`,
      iconURL: appealer.displayAvatarURL(),
    })
    .setColor(Constants.Colors.invisible);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID('appealReview:approve', [type, hubId, opts.appealTargetId]).toString())
      .setLabel('Approve')
      .setEmoji(emojis.yes)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(new CustomID('appealReview:reject', [type, hubId, opts.appealTargetId]).toString())
      .setLabel('Reject')
      .setEmoji(emojis.no)
      .setStyle(ButtonStyle.Danger),
  );

  await appealer.client.cluster.broadcastEval(
    async (client, ctx) => {
      const channel = await client.channels.fetch(ctx.appealsChannelId);
      if (!channel?.isSendable()) return;
      const roleMention = ctx.appealsRoleId ? `<@&${ctx.appealsRoleId}> ` : '';

      return await channel.send({
        content: `-# ${roleMention}New blacklist appeal for ${ctx.type} **${ctx.appealName} (${ctx.appealTargetId})**`,
        embeds: [ctx.appealEmbed],
        components: [ctx.buttonRow],
      });
    },
    {
      context: {
        appealsChannelId: opts.appealsChannelId,
        appealsRoleId: opts.appealsRoleId,
        appealName: opts.appealName,
        appealTargetId: opts.appealTargetId,
        type,
        appealEmbed: appealEmbed.toJSON(),
        buttonRow: buttonRow.toJSON(),
      },
    },
  );
};

export default logAppeals;
