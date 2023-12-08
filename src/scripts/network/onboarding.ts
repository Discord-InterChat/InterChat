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
import { LINKS, colors } from '../../utils/Constants.js';
import { __ } from '../../utils/Locale.js';

const onboardingInProgress = new Collection<string, string>();

/**
 * Shows the onboarding message for a hub in the specified channel.
 * @param interaction - The interaction that triggered the onboarding message.
 * @param hubName - The name of the hub to join.
 * @param channelId - The ID of the channel to show the onboarding message in.
 * @param ephemeral - Whether the onboarding message should only be visible to the user who triggered it.
 * @returns A Promise that resolves to `true` if the user accepts the onboarding message, `false` if they cancel it, or `'in-progress'` if onboarding is already in progress for the channel.
 */
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
    .setTitle(
      __(
        { phrase: 'network.onboarding.embed.title', locale: interaction.user.locale },
        { hubName },
      ),
    )
    .setDescription(
      __(
        { phrase: 'network.onboarding.embed.description', locale: interaction.user.locale },
        { hubName },
      ),
    )
    .setColor(colors.interchatBlue)
    .setFooter({
      text: __(
        { phrase: 'network.onboarding.embed.footer', locale: interaction.user.locale },
        { version: interaction.client.version },
      ),
    });

  const nextButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('onboarding_:cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('onboarding_:next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Success),
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
      new ButtonBuilder()
        .setCustomId('onboarding_:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('onboarding_:accept')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
    );

    const rulesEmbed = new EmbedBuilder()
      .setDescription(
        __(
          { phrase: 'rules', locale: interaction.user.locale },
          { support_invite: LINKS.SUPPORT_INVITE },
        ),
      )
      .setImage(LINKS.RULES_BANNER)
      .setColor(colors.interchatBlue);

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
