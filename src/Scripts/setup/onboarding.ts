import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ComponentType, ButtonInteraction } from 'discord.js';
import { colors, rulesEmbed } from '../../Utils/functions/utils';

/* Make user accept and understand important info on first setup */
export default {
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('👋 Hey there! Welcome to the InterChat network.')
      .setDescription(stripIndents`
        To keep things organized, it's recommended to create a separate channel for the network. But don't worry, you can always change this later.

        Before we dive in, take a moment to review our network rules. We want everyone to have a smooth and fun experience.

        **How it works:** the InterChat Network is like a magic bridge that links channels on different servers. So, you can chat with people from all over!

        And hey, if you have any cool ideas for new features, let us know! We're always looking to improve.
        `)
      .setColor(colors('chatbot'))
      .setFooter({ text: `InterChat Network | Version ${interaction.client.version}` });

    const nextButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Success),
    );

    const replyMsg = {
      embeds: [embed],
      components: [nextButton],
    };
    const reply = await (interaction.deferred ? interaction.editReply(replyMsg) : interaction.reply(replyMsg));

    const filter = (i: ButtonInteraction) => i.user.id === interaction.user.id;

    const response = await reply.awaitMessageComponent({
      time: 60_000 * 2,
      filter,
      componentType: ComponentType.Button,
    }).catch(() => null);

    if (!response || response?.customId === 'cancel') {
      await interaction.deleteReply();
    }

    else if (response.customId === 'next') {
      const acceptButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('accept')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
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
