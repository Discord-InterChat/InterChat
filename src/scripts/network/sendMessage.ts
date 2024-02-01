import { APIMessage, WebhookMessageCreateOptions } from 'discord.js';

export default async (message: WebhookMessageCreateOptions, webhookUrl: string) => {
  const res = await fetch('https://interchat-networkwebhook.vercel.app/api/send', {
    method: 'PUT',
    body: JSON.stringify(message),
    headers: {
      authorization: `${process.env.NETWORK_API_KEY}`,
      'x-webhook-url': webhookUrl,
      'Content-Type': 'application/json',
    },
  });

  const resBody = await res.json();

  return res.status === 200 ? (resBody.result as APIMessage) : String(resBody.error);
};
