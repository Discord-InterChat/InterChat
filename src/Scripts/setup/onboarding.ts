import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ComponentType, ButtonInteraction } from 'discord.js';
import { colors, rulesEmbed } from '../../Utils/functions/utils';

/* Make user accept and understand important info on first setup */
export default {
  async execute(interaction: ChatInputCommandInteraction) {
    const emoji = interaction.client.emotes;

    const embed = new EmbedBuilder()
      .setTitle('👋 Welcome to the InterChat Network!')
      .setDescription(stripIndents`
      ${emoji.normal.clipart} Hey there! Before we get started, let's take a moment to learn about the Chat Network.
      
      The Network serves as a bridge between channels on different servers, allowing members of this server to communicate with members of other servers through the setup channel. It is recommended to create a seperate channel for the network, as it may get cluttered. We hope you enjoy talking to other servers using the network! 

      We strive to improve and evolve our bot. If you would like to contribute or have any suggestions for new features, feel free to let us know.

      **Next step:** Review the network rules to ensure a smooth experience for all users.`)
      .setColor(colors('chatbot'));

    const nextButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),
    );

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [nextButton],
    });

    const filter = (i: ButtonInteraction) => i.user.id === interaction.user.id;

    const response = await reply.awaitMessageComponent({
      time: 60_000 * 2,
      filter,
      componentType: ComponentType.Button,
    }).catch(() => null);

    if (response?.customId === 'cancel') {
      await interaction.deleteReply();
    }

    else if (response?.customId === 'next') {
      const acceptButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('accept')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger),
      );

      const acceptOnboarding = await response.update({
        embeds: [rulesEmbed],
        components: [acceptButton],
      });

      const acceptResp = await acceptOnboarding.awaitMessageComponent({
        time: 60_000,
        filter,
        componentType: ComponentType.Button,
      }).catch(() => null);

      // To avoid getting interaction failures
      await acceptResp?.deferUpdate();
      return acceptResp?.customId === 'accept' ? true : false;
    }
    return false;
  },
};