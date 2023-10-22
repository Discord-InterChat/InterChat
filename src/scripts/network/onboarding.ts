import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ComponentType,
  ButtonInteraction,
  AnySelectMenuInteraction,
  Collection,
} from 'discord.js';
import { colors, rulesEmbed } from '../../utils/Constants.js';

const onboardingInProgress = new Collection<string, string>();

/* Make user accept and understand important info on first setup */
export async function showOnboarding(
  interaction: ChatInputCommandInteraction | AnySelectMenuInteraction | ButtonInteraction,
  hubName: string,
  channelId: string,
  ephemeral = false,
): Promise<boolean | 'in-progress'> {
  // Check if server is already attempting to join a hub
  if (onboardingInProgress.has(channelId)) return 'in-progress';

  // Mark this as in-progress so server can't join twice
  onboardingInProgress.set(channelId, channelId);

  const embed = new EmbedBuilder()
    .setTitle(`👋 Hey there, welcome to ${hubName}!`)
    .setDescription(
      stripIndents`
        To keep things organized, it's recommended to use a separate channel for just for this hub. But don't worry, you can always change this later.

        **How it works:** The InterChat Network is like a magic bridge that links channels on different servers that are with us in this hub. Learn more at our [guide](https://discord-interchat.github.io/docs).
        `,
    )
    .setColor(colors.interchatBlue)
    .setFooter({ text: `InterChat Network | Version ${interaction.client.version}` });

  const nextButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('onboarding_:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('onboarding_:next').setLabel('Next').setStyle(ButtonStyle.Success),
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

  if (response?.customId === 'onboarding_:next') {
    const acceptButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('onboarding_:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('onboarding_:accept').setLabel('Accept').setStyle(ButtonStyle.Success),
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

    return acceptResp?.customId === 'onboarding_:accept' ? true : false;
  }

  onboardingInProgress.delete(channelId);
  return false;
}
