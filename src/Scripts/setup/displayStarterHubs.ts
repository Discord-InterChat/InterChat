import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import { stripIndents } from 'common-tags';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    const db = getDb();
    try {
      const allHubs = await db.hubs.findMany({ where: { official: true } });

      const embed = new EmbedBuilder()
        .setTitle('Pick your Starter Hub')
        .setDescription(stripIndents`
          A hub is a public network that servers can join. Messages will only be recieved by other members of the hub.

          Below are some **starter hubs**. Please select one you wish to be a part of:
        `)
        .setFooter({ text: 'Tip: You can join other community hubs using /hub browse!' })
        .setColor('#0099ff');

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];

      for (let i = 0; i < allHubs.length; i++) {
        const hub = allHubs[i];
        if (!hub.official) continue;

        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(hub.id)
            .setLabel(hub.name)
            .setStyle(ButtonStyle.Primary),
        ));

        embed.addFields({
          name: hub.name,
          value: hub.description,
          inline: i % 3 === 0 ? false : true,
        });
      }

      const reply = await interaction.editReply({
        embeds: [embed],
        components: rows,
      });

      const selection = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000,
      }).catch(() => null);

      if (selection) {
        await selection.deferUpdate();
        return { id: selection.customId };
      }
    }
    catch (err) {
      console.error(err);
      interaction.editReply('An error occurred while retrieving the hubs. Please try again later.');
    }
    return false;
  },
};
