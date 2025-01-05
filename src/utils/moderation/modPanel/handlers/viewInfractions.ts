import type { ButtonInteraction, Snowflake } from 'discord.js';
import InfractionManager from '#main/managers/InfractionManager.js';
import { Pagination } from '#main/modules/Pagination.js';
import { type ModAction, replyWithUnknownMessage } from '#main/utils/moderation/modPanel/utils.js';
import { getOriginalMessage } from '#main/utils/network/messageUtils.js';
import type { supportedLocaleCodes } from '#utils/Locale.js';
import { buildInfractionListEmbeds } from '#utils/moderation/infractionUtils.js';

export default class ViewInfractionsHandler implements ModAction {
  async handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const originalMsg = await getOriginalMessage(originalMsgId);

    if (!originalMsg) {
      await replyWithUnknownMessage(interaction, locale);
      return;
    }

    const user = await interaction.client.users.fetch(originalMsg.authorId).catch(() => null);
    if (!user) {
      await replyWithUnknownMessage(interaction, locale);
      return;
    }

    const infractionManager = new InfractionManager('user', originalMsg.authorId);
    const infractions = await infractionManager.getHubInfractions(originalMsg.hubId);
    const targetName = user.username ?? 'Unknown User.';
    const iconURL = user.displayAvatarURL();

    const embeds = await buildInfractionListEmbeds(
      interaction.client,
      targetName,
      infractions,
      'user',
      iconURL,
    );

    new Pagination(interaction.client).addPages(embeds).run(interaction, { deleteOnEnd: true });
  }
}
