import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ComponentType, ButtonInteraction, AnySelectMenuInteraction, Collection } from 'discord.js';
import { colors, rulesEmbed } from '../../Utils/misc/utils';

const onboardingInProgress = new Collection<string, string>();

/* Make user accept and understand important info on first setup */
export default {
  async execute(
    interaction: ChatInputCommandInteraction | AnySelectMenuInteraction | ButtonInteraction,
    hubName: string,
    channelId: string,
    ephemeral = false,
  ) {
    // Check if server is already attempting to join a hub
    if (onboardingInProgress.has(channelId)) {
      const err = {
        content: `${interaction.client.emotes.normal.no} There has already been an attempt to join a hub in <#${channelId}>. Please wait for that to finish before trying again!`,
        ephemeral,
      };
      interaction.deferred || interaction.replied
        ? interaction.followUp(err)
        : interaction.reply(err);
      return;
    }
    // Mark this as in-progress so server can't join twice
    onboardingInProgress.set(channelId, channelId);

    const embed = new EmbedBuilder()
      .setTitle(`👋 Hey there! Welcome to ${hubName}!`)
      .setDescription(
        stripIndents`
        To keep things organized, it's recommended to use a separate channel for just for this hub. But don't worry, you can always change this later.

        Before we dive in, take a moment to review our rules. We want everyone to have a smooth and fun experience.

        **How it works:** the InterChat Network is like a magic bridge that links channels on different servers that are with us in this hub. So, you can chat with people from all over!

        Developer Note: And hey, if you have any cool ideas for new features, let us know! We're always looking to improve.
        `,
      )
      .setColor(colors('chatbot'))
      .setFooter({ text: `InterChat Network | Version ${interaction.client.version}` });

    const nextButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Success),
    );

    const replyMsg = {
      embeds: [embed],
      components: [nextButton],
      fetchReply: true,
      ephemeral,
    };

    const reply = await (interaction.deferred
      ? interaction.editReply(replyMsg)
      : interaction.reply(replyMsg));

    const filter = (i: ButtonInteraction) => i.user.id === interaction.user.id;

    const response = await reply
      .awaitMessageComponent({
        time: 60_000 * 2,
        filter,
        componentType: ComponentType.Button,
      })
      .catch(() => null);

    if (!response || response?.customId === 'cancel') {
      await interaction.deleteReply();
    }
    else if (response.customId === 'next') {
      const acceptButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('accept').setLabel('Accept').setStyle(ButtonStyle.Success),
      );

      const acceptOnboarding = await response.update({
        embeds: [rulesEmbed],
        components: [acceptButton],
      });

      const acceptResp = await acceptOnboarding
        .awaitMessageComponent({
          time: 60_000,
          filter,
          componentType: ComponentType.Button,
        })
        .catch(() => null);

      // To avoid getting interaction failures
      await acceptResp?.deferUpdate();

      // remove in-progress marker as onboarding has either been cancelled or completed
      onboardingInProgress.delete(channelId);

      return acceptResp?.customId === 'accept' ? true : false;
    }

    onboardingInProgress.delete(channelId);
    return false;
  },
};
