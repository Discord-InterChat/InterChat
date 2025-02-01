import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { buildModPanel } from '#src/interactions/ModPanel.js';
import { HubService } from '#src/services/HubService.js';
import db from '#src/utils/Db.js';
import {
  type OriginalMessage,
  findOriginalMessage,
  getOriginalMessage,
} from '#src/utils/network/messageUtils.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from 'discord.js';

export default class ModPanelCommand extends BaseCommand {
  constructor() {
    super({
      name: 'modpanel',
      description: 'Open the moderation actions panel for a message',
      types: {
        prefix: true,
        contextMenu: {
          name: 'Moderation Actions',
          type: ApplicationCommandType.Message as const,
        },
      },
      contexts: {
        guildOnly: true,
        userInstall: true,
      },
      options: [
        {
          name: 'message',
          description: 'The message to moderate',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    });
  }

  async execute(ctx: Context) {
    await ctx.deferReply({ flags: ['Ephemeral'] });
    const targetMessage = await ctx.getTargetMessage('message');

    if (!targetMessage) {
      await ctx.replyEmbed('errors.messageNotSentOrExpired', {
        t: { emoji: ctx.getEmoji('x_icon') },
        edit: true,
      });
      return;
    }

    const originalMsg =
			(await getOriginalMessage(targetMessage.id)) ??
			(await findOriginalMessage(targetMessage.id));

    if (!originalMsg || !(await this.validateMessage(ctx, originalMsg))) {
      await ctx.replyEmbed('errors.messageNotSentOrExpired', {
        t: { emoji: ctx.getEmoji('x_icon') },
        edit: true,
      });
      return;
    }

    const { embed, buttons } = await buildModPanel(ctx, originalMsg);
    await ctx.editOrReply({ embeds: [embed], components: buttons });
  }

  private async validateMessage(ctx: Context, originalMsg: OriginalMessage) {
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(originalMsg.hubId);

    if (!hub || !(await isStaffOrHubMod(ctx.user.id, hub))) {
      return false;
    }

    return true;
  }
}
