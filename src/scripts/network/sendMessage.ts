import { APIEmbed, APIMessage, WebhookMessageCreateOptions, isJSONEncodable } from 'discord.js';
// import { isDevBuild } from '../../utils/Constants.js';
import { encryptMessage } from '../../utils/Utils.js';
import { isNetworkApiError } from './helpers.js';

const { INTERCHAT_API_URL1, INTERCHAT_API_URL2 } = process.env;
let primaryUrl = INTERCHAT_API_URL1 ?? INTERCHAT_API_URL2;

const switchUrl = (currentUrl: string) => {
  return currentUrl === INTERCHAT_API_URL1 ? INTERCHAT_API_URL2 : INTERCHAT_API_URL1;
};

const sendMessage = async (
  webhookUrl: string,
  message: WebhookMessageCreateOptions,
  tries = 0,
  encrypt = true,
): Promise<string | APIMessage | undefined> => {
  // No need for external apis in development mode FIXME
  // if (isDevBuild) {
  //   const webhook = new WebhookClient({ url: webhookUrl });
  //   return await webhook.send(message);
  // }

  if (!process.env.NETWORK_ENCRYPT_KEY) throw new Error('Missing encryption key for network.');

  const encryptKey = Buffer.from(process.env.NETWORK_ENCRYPT_KEY, 'base64');
  const networkKey = process.env.NETWORK_API_KEY;
  if (!networkKey || !primaryUrl) {
    throw new Error('NETWORK_API_KEY or INTERCHAT_API_URL(s) env variables missing.');
  }

  const firstEmbed = message.embeds?.at(0);
  const embed = isJSONEncodable(firstEmbed) ? firstEmbed.toJSON() : firstEmbed;

  const content = message.content;
  if (encrypt) {
    if (content) message.content = encryptMessage(content, encryptKey);
    if (embed?.description) {
      // FIXME: message.embeds[0] might not work if its json encodable, check!
      (message.embeds as APIEmbed[])![0].description = encryptMessage(
        embed.description,
        encryptKey,
      );
    }
  }

  const res = await fetch(primaryUrl, {
    method: 'POST',
    body: JSON.stringify({ webhookUrl, data: message }),
    headers: {
      authorization: networkKey,
      'x-webhook-url': webhookUrl,
      'Content-Type': 'application/json',
    },
  });

  const data = (await res.json()) as string | APIMessage | undefined;

  if (isNetworkApiError(data) && tries <= 2) {
    primaryUrl = switchUrl(primaryUrl);
    return await sendMessage(webhookUrl, message, tries++, !encrypt);
  }

  return data;
};

export default sendMessage;
