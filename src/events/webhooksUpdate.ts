import BaseEventListener from '#main/core/BaseEventListener.js';
import { isGuildTextBasedChannel } from '#utils/ChannelUtls.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import { emojis } from '#main/config/Constants.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import Logger from '#utils/Logger.js';
import { ForumChannel, MediaChannel, NewsChannel, TextChannel, VoiceChannel } from 'discord.js';

export default class Ready extends BaseEventListener<'webhooksUpdate'> {
  readonly name = 'webhooksUpdate';
  public async execute(
    channel: NewsChannel | TextChannel | VoiceChannel | ForumChannel | MediaChannel,
  ) {
    try {
      const connection = await db.connectedList.findFirst({
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

      if (isGuildTextBasedChannel(networkChannel)) {
        await networkChannel.send(t('misc.webhookNoLongerExists', 'en', { emoji: emojis.info }));
      }
    }
    catch (error) {
      Logger.error('WebhooksUpdateError:', error);
    }
  }
}
