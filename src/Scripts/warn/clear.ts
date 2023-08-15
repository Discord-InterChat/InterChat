import { ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export = {
  execute: async (interaction: ChatInputCommandInteraction) => {
    const db = getDb();
    const user = interaction.options.getUser('user', true);
    const userWarns = await db.userWarns.findFirst({ where: { userId: user.id } });

    const emojis = interaction.client.emotes;

    if (!userWarns?.warnings) {
      return interaction.reply({
        content: `${emojis.normal.no} There are no warnings to remove!`,
        ephemeral: true,
      });
    }

    await db.userWarns.delete({ where: { userId: user.id } });
    await interaction.reply(`${emojis.normal.yes} Successfully cleard all warnings from @${user.username}!`);
  },
};
