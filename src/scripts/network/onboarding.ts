import { LINKS, colors } from '#main/utils/Constants.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { getReplyMethod, getUserLocale } from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Collection,
  ComponentType,
  EmbedBuilder,
  RepliableInteraction,
} from 'discord.js';

const onboardingInProgress = new Collection<string, string>();

const processAcceptButton = async (interaction: ButtonInteraction, channelId: string) => {
  await interaction?.deferUpdate();
  onboardingInProgress.delete(channelId); // remove in-progress marker as onboarding has either been cancelled or completed
  return interaction?.customId === 'onboarding_:accept';
};

const processNextButton = async (
  interaction: ButtonInteraction,
  channelId: string,
  locale: supportedLocaleCodes = 'en',
) => {
  if (interaction?.customId !== 'onboarding_:next') return false;

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
    .setDescription(t({ phrase: 'rules', locale }, { support_invite: LINKS.SUPPORT_INVITE }))
    .setImage(LINKS.RULES_BANNER)
    .setColor(colors.interchatBlue);

  // next button
  const acceptOnboarding = await interaction.update({
    embeds: [rulesEmbed],
    components: [acceptButton],
  });

  const acceptResp = await acceptOnboarding
    .awaitMessageComponent({
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
    })
    .catch(() => null);

  return acceptResp ? await processAcceptButton(acceptResp, channelId) : false;
};

/**
 * Shows the onboarding message for a hub in the specified channel.
 * @param interaction - The interaction that triggered the onboarding message.
 * @param hubName - The name of the hub to join.
 * @param channelId - The ID of the channel to show the onboarding message in.
 * @param ephemeral - Whether the onboarding message should only be visible to the user who triggered it.
 * @returns A Promise that resolves to `true` if the user accepts the onboarding message, `false` if they cancel it, or `'in-progress'` if onboarding is already in progress for the channel.
 */
export const showOnboarding = async (
  interaction: RepliableInteraction,
  hubName: string,
  channelId: string,
  ephemeral = false,
): Promise<boolean | 'in-progress'> => {
  // Check if server is already attempting to join a hub
  if (onboardingInProgress.has(channelId)) return 'in-progress';
  // Mark this as in-progress so server can't join twice
  onboardingInProgress.set(channelId, channelId);

  const locale = await getUserLocale(interaction.user.id);
  const embedPhrase = 'network.onboarding.embed';

  const embed = new EmbedBuilder()
    .setTitle(t({ phrase: `${embedPhrase}.title`, locale }, { hubName }))
    .setDescription(
      t({ phrase: `${embedPhrase}.description`, locale }, { hubName, docs_link: LINKS.DOCS }),
    )
    .setColor(colors.interchatBlue)
    .setFooter({
      text: t({ phrase: `${embedPhrase}.footer`, locale }, { version: interaction.client.version }),
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

  const reply = await interaction[getReplyMethod(interaction)](replyMsg);
  const response = await reply
    .awaitMessageComponent({
      time: 60_000 * 2,
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
    })
    .catch(() => null);

  const finalResult = response ? await processNextButton(response, channelId, locale) : false;

  // in case user cancels onboarding, remove in-progress marker
  if (finalResult === false) onboardingInProgress.delete(channelId);

  return finalResult;
};
