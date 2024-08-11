import BaseEventListener from '#main/core/BaseEventListener.js';
import { getAllConnections, modifyConnection } from '#main/utils/ConnectedList.js';
import { emojis } from '#main/utils/Constants.js';
import { t } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import { ForumChannel, MediaChannel, NewsChannel, TextChannel, VoiceChannel } from 'discord.js';

export default class Ready extends BaseEventListener<'webhooksUpdate'> {
  readonly name = 'webhooksUpdate';
  public async execute(
    channel: NewsChannel | TextChannel | VoiceChannel | ForumChannel | MediaChannel,
  ) {
    try {
      const allConnections = await getAllConnections();
      const connection = allConnections?.find(
        (c) => c.connected && (c.channelId === channel.id || c.parentId === channel.id),
      );

      if (!connection) return;

      Logger.info(`Webhook for ${channel.id} was updated`);

      const webhooks = await channel.fetchWebhooks();
      const webhook = webhooks.find((w) => w.url === connection.webhookURL);

      // only continue if webhook was deleted
      if (webhook) return;

      // disconnect the channel
      await modifyConnection({ id: connection.id }, { connected: false });

      // send an alert to the channel
      const networkChannel = connection.parentId
        ? await channel.client.channels.fetch(connection.channelId)
        : channel;

      if (networkChannel?.isTextBased()) {
        await networkChannel.send(
          t({ phrase: 'misc.webhookNoLongerExists', locale: 'en' }, { emoji: emojis.info }),
        );
      }
    }
    catch (error) {
      Logger.error('WebhooksUpdateError:', error);
    }
  }
}
