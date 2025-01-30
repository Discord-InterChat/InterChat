import type {
  ForumChannel,
  MediaChannel,
  NewsChannel,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import BaseEventListener from '#src/core/BaseEventListener.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import Logger from '#utils/Logger.js';

export default class Ready extends BaseEventListener<'webhooksUpdate'> {
  readonly name = 'webhooksUpdate';
  public async execute(
    channel: NewsChannel | TextChannel | VoiceChannel | ForumChannel | MediaChannel,
  ) {
    try {
      const connection = await db.connection.findFirst({
        where: { OR: [{ channelId: channel.id }, { parentId: channel.id }] },
      });

      if (!connection) return;

      Logger.info(`Webhook for ${channel.id} was updated`);

      const webhooks = await channel.fetchWebhooks();
      const webhook = webhooks.find((w) => w.url === connection.webhookURL);

      // only continue if webhook was deleted
      if (webhook) return;

      // disconnect the channel
      await updateConnection({ id: connection.id }, { connected: false });

      // send an alert to the channel
      const networkChannel = connection.parentId
        ? await channel.client.channels.fetch(connection.channelId)
        : channel;

      if (networkChannel?.isSendable()) {
        await networkChannel.send(
          t('global.webhookNoLongerExists', 'en', {
            emoji: this.getEmoji('info'),
          }),
        );
      }
    }
    catch (error) {
      Logger.error('WebhooksUpdateError:', error);
    }
  }
}
