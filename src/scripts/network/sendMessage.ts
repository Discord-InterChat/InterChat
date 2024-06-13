import { APIMessage, WebhookClient, WebhookMessageCreateOptions } from 'discord.js';
import { isDevBuild } from '../../utils/Constants.js';

const { INTERCHAT_API_URL1, INTERCHAT_API_URL2 } = process.env;
let primaryUrl = INTERCHAT_API_URL1 ?? INTERCHAT_API_URL2;

const switchUrl = (currentUrl: string) => {
  return currentUrl === INTERCHAT_API_URL1 ? INTERCHAT_API_URL2 : INTERCHAT_API_URL1;
};

const sendMessage = async (
  webhookUrl: string,
  message: WebhookMessageCreateOptions,
  tries = 0,
): Promise<string | APIMessage | undefined> => {
  // No need for external apis in development mode
  if (isDevBuild) {
    const webhook = new WebhookClient({ url: webhookUrl });
    return await webhook.send(message);
  }

  const networkKey = process.env.NETWORK_API_KEY;
  if (!networkKey || !primaryUrl) {
    throw new Error('Missing NETWORK_API_KEY or INTERCHAT_API_URL(s) environment variables.');
  }


  const res = await fetch(primaryUrl, {
    method: 'PUT',
    body: JSON.stringify(message),
    headers: {
      authorization: networkKey,
      'x-webhook-url': webhookUrl,
      'Content-Type': 'application/json',
    },
  });

  if (res.status !== 200) {
    if (tries <= 2) {
      primaryUrl = switchUrl(primaryUrl);
      return await sendMessage(webhookUrl, message, tries++);
    }
    return String(res.statusText);
  }

  return (await res.json()).result as APIMessage;
};

export default sendMessage;
