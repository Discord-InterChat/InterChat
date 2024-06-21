import { APIEmbed, APIMessage, WebhookClient, WebhookMessageCreateOptions, isJSONEncodable } from 'discord.js';
// import { isDevBuild } from '../../utils/Constants.js';
// import { encryptMessage } from '../../utils/Utils.js';
import { NetworkAPIError, isNetworkApiError } from './helpers.js';
import { encryptMessage, wait } from '../../utils/Utils.js';
import { isDevBuild } from '../../utils/Constants.js';

const { INTERCHAT_API_URL1, INTERCHAT_API_URL2 } = process.env;
let primaryUrl = INTERCHAT_API_URL1 ?? INTERCHAT_API_URL2;

const switchUrl = (currentUrl: string) => {
  return currentUrl === INTERCHAT_API_URL1 ? INTERCHAT_API_URL2 : INTERCHAT_API_URL1;
};

const sendMessage = async (
  webhookUrl: string,
  data: WebhookMessageCreateOptions,
  tries = 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  encrypt = true,
): Promise<NetworkAPIError | APIMessage | undefined> => {
  //  No need for external apis in development mode
  if (isDevBuild) {
    const webhook = new WebhookClient({ url: webhookUrl });
    return await webhook.send(data);
  }

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
    const content = data.content;
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

  // console.log(data);
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
    console.log('here', tries);
    await wait(3000);
    primaryUrl = switchUrl(primaryUrl);
    return await sendMessage(webhookUrl, data, tries + 1, false);
  }

  return resJson;
};

export default sendMessage;
