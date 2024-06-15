import { APIEmbed, APIMessage, WebhookMessageCreateOptions } from 'discord.js';
// import { isDevBuild } from '../../utils/Constants.js';
import { encryptMessage } from '../../utils/Utils.js';

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

  const embed = message.embeds?.at(0) as APIEmbed;
  const content = message.content;
  if (encrypt && content) message.content = encryptMessage(content, encryptKey);
  if (encrypt && embed.description) {
    (message.embeds as APIEmbed[])![0].description = encryptMessage(embed.description, encryptKey);
  }

  console.log(primaryUrl);

  const res = await fetch(primaryUrl, {
    method: 'PUT',
    body: JSON.stringify({ webhookUrl, data: message }),
    headers: {
      authorization: networkKey,
      'x-webhook-url': webhookUrl,
      'Content-Type': 'application/json',
    },
  });
  console.log(res);

  const data = await res.json();
  console.log(data);
  if (res.status !== 200) {
    if (tries <= 2) {
      primaryUrl = switchUrl(primaryUrl);
      return await sendMessage(webhookUrl, message, tries++, !encrypt);
    }
    return String(data.error);
  }

  return data.result as APIMessage;
};

export default sendMessage;
