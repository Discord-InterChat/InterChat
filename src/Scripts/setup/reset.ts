import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import { disconnect } from '../../Structures/network';
import { getDb } from '../../Utils/functions/utils';

export = {
  async execute(interaction: ChatInputCommandInteraction) {
    const { normal, icons } = interaction.client.emoji;
    const { setup } = getDb();

    if (!await setup?.findFirst({ where: { guildId: interaction.guildId?.toString() } })) {
      return interaction.reply(`${normal.no} This server is not setup yet.`);
    }

    const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger),
    ]);

    const resetConfirmMsg = await interaction.reply({
      content: `${icons.info} Are you sure? You will have to re-setup to use the network again! All setup data will be lost.`,
      components: [choiceButtons],
    });


    const resetCollector = resetConfirmMsg.createMessageComponentCollector({
      filter: (m) => m.user.id == interaction.user.id,
      componentType: ComponentType.Button,
      idle: 10_000,
      max: 1,
    });

    // Creating collector for yes/no button
    resetCollector.on('collect', async (collected) => {
      if (collected.customId !== 'yes') {
        collected.update({
          content: `${normal.no} Cancelled.`,
          components: [],
        });
        return;
      }

      await setup?.deleteMany({ where: { guildId: interaction.guild?.id } });
      await disconnect({ serverId: interaction.guild?.id });

      collected.update({
        content: `${normal.yes} Reset Complete.`,
        components: [],
      });

    });
  },
};