import { APIMessage, WebhookMessageCreateOptions } from 'discord.js';

type DiscordErrorFormat = { message: string; code: number };

export default async (webhookUrl: string, message: WebhookMessageCreateOptions) => {
  const res = await fetch('https://api.interchat.fun/send', {
    method: 'POST',
    body: JSON.stringify(message),
    headers: {
      authorization: `${process.env.NETWORK_API_KEY}`,
      'x-webhook-url': webhookUrl,
      'Content-Type': 'application/json',
    },
  });

  const resBody: APIMessage | DiscordErrorFormat = await res.json();
  return 'code' in resBody ? resBody.message : resBody;
};
