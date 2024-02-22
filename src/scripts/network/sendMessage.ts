import { APIMessage, WebhookMessageCreateOptions } from 'discord.js';

export default async (message: WebhookMessageCreateOptions, webhookUrl: string) => {
  const res = await fetch('https://api.interchat.fun/send', {
    method: 'POST',
    body: JSON.stringify(message),
    headers: {
      authorization: `${process.env.NETWORK_API_KEY}`,
      'x-webhook-url': webhookUrl,
      'Content-Type': 'application/json',
    },
  });

  const resBody = await res.json();

  return res.status === 200
    ? (resBody as APIMessage)
    : String(resBody.error.message ?? resBody.error);
};
