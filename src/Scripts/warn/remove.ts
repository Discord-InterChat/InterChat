import { ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export = {
  execute: async (interaction: ChatInputCommandInteraction) => {
    const db = getDb();
    const warnId = interaction.options.getString('id', true);
    const user = interaction.options.getUser('user', true);
    const userWarns = await db.userWarns.findFirst({ where: { userId: user.id } });

    const emojis = interaction.client.emoji;

    if (!userWarns?.warnings.some((warn) => warn.id === warnId)) {
      return interaction.reply({
        content: `${emojis.normal.no} There are no warnings to remove!`,
        ephemeral: true,
      });
    }

    await db.userWarns.update({
      where: { userId: user.id },
      data: {
        userTag: user.tag,
        warnings: { deleteMany: { where: { id: { equals: warnId } } } },
      },
    });

    await interaction.reply(`${emojis.normal.yes} Successfully removed warning **${warnId}** from ${user.tag}!`);
  },
};
