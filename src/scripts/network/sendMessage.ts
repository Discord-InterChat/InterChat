import {
  APIEmbed,
  APIMessage,
  WebhookClient,
  WebhookMessageCreateOptions,
  isJSONEncodable,
} from 'discord.js';
import { NetworkAPIError, isNetworkApiError } from './helpers.js';
import { encryptMessage, wait } from '#main/utils/Utils.js';

export default async (webhookUrl: string, data: WebhookMessageCreateOptions) => {
  const webhook = new WebhookClient({ url: webhookUrl });
  return await webhook.send(data);
};

const { INTERCHAT_API_URL1, INTERCHAT_API_URL2 } = process.env;
const urls = [INTERCHAT_API_URL1, INTERCHAT_API_URL2];
let [primaryUrl] = urls;

const switchUrl = (currentUrl: string) => {
  if (currentUrl === urls[urls.length - 1]) return urls[0] ?? currentUrl;
  else return urls[urls.indexOf(currentUrl) + 1] ?? currentUrl;
};
export const specialSendMessage = async (
  webhookUrl: string,
  data: WebhookMessageCreateOptions,
  tries = 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  encrypt = true,
): Promise<NetworkAPIError | APIMessage | undefined> => {
  const networkKey = process.env.NETWORK_API_KEY;
  if (!networkKey || !primaryUrl) {
    throw new Error('NETWORK_API_KEY or INTERCHAT_API_URL(s) env variables missing.');
  }

  // TODO: Encryption stuff, doesn't work in cf workers :(
  let embed: APIEmbed = {};
  if (encrypt) {
    if (!process.env.NETWORK_ENCRYPT_KEY) throw new Error('Missing encryption key for network.');

    const firstEmbed = data.embeds?.at(0);

    const encryptKey = Buffer.from(process.env.NETWORK_ENCRYPT_KEY, 'base64');
    const { content } = data;
    if (encrypt) {
      if (content) {
        data.content = encryptMessage(content, encryptKey);
      }
      else if (firstEmbed) {
        embed = isJSONEncodable(firstEmbed) ? firstEmbed.toJSON() : firstEmbed;
        if (embed.description) {
          embed.description = encryptMessage(embed.description, encryptKey);
        }
      }
    }
  }

  const res = await fetch(primaryUrl, {
    method: 'POST',
    body: JSON.stringify({ webhookUrl, data: { ...data, ...embed } }),
    headers: {
      authorization: networkKey,
      'Content-Type': 'application/json',
    },
  });

  const resJson = (await res.json()) as NetworkAPIError | APIMessage | undefined;

  if (isNetworkApiError(resJson) && tries <= 5) {
    await wait(3000);
    primaryUrl = switchUrl(primaryUrl);
    return await specialSendMessage(webhookUrl, data, tries + 1, false);
  }

  return resJson;
};
