import { Interaction, EmbedBuilder } from 'discord.js';
import { emojis, colors } from '../../utils/Constants.js';
import { yesOrNoEmoji } from '../../utils/Utils.js';
import db from '../../utils/Db.js';

export async function buildEmbed(interaction: Interaction, channelId: string) {
  const networkData = await db.connectedList.findFirst({
    where: { channelId },
    include: { hub: true },
  });

  const { yes, no, enabled, disabled } = emojis;
  const invite = networkData?.invite
    ? `Code: [\`${networkData.invite.replace('https://discord.gg/', '')}\`](${networkData.invite})`
    : 'Not Set.';

  return new EmbedBuilder()
    .setTitle('Edit Settings')
    .setDescription(`Showing network settings for <#${channelId}>.`)
    .addFields([
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Hub', value: `${networkData?.hub?.name}`, inline: true },
      { name: 'Invite', value: invite, inline: true },
      { name: 'Connected', value: yesOrNoEmoji(networkData?.connected, yes, no), inline: true },
      {
        name: 'Compact',
        value: yesOrNoEmoji(networkData?.compact, enabled, disabled),
        inline: true,
      },
      {
        name: 'Profanity Filter',
        value: yesOrNoEmoji(networkData?.profFilter, enabled, disabled),
        inline: true,
      },
      {
        name: 'Embed Color',
        value: networkData?.embedColor ? `\`${networkData?.embedColor}\`` : no,
        inline: true,
      },
    ])
    .setColor(colors.interchatBlue)
    .setThumbnail(interaction.guild?.iconURL() || interaction.client.user.avatarURL())
    .setTimestamp()
    .setFooter({ text: 'Use to menu below to edit.' });
}
