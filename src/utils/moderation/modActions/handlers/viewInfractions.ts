import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { Pagination } from '#main/modules/Pagination.js';
import { getOriginalMessage } from '#main/utils/network/messageUtils.js';
import type { supportedLocaleCodes } from '#utils/Locale.js';
import { buildInfractionListEmbeds } from '#utils/moderation/infractionUtils.js';
import {
  type ModAction,
  replyWithUnknownMessage,
} from '#utils/moderation/modActions/utils.js';
import { type ButtonInteraction, type Snowflake } from 'discord.js';

export default class ViewInfractionsHandler implements ModAction {
  async handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    await interaction.deferReply({ ephemeral: true });

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

    const infractionManager = new UserInfractionManager(originalMsg.authorId);
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

    new Pagination().addPages(embeds).run(interaction, { deleteOnEnd: true });
  }
}
