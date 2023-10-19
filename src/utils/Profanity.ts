// import { EmbedBuilder, User, TextChannel } from 'discord';
// import { constants, getGuildName, getHubName } from './utils';
import { createRequire } from 'node:module';
import badwordsType from './JSON/profanity.json';

// create a require a ESM doesn't support importing JSON
const require = createRequire(import.meta.url);
const badwords = require('./JSON/profanity.json') as typeof badwordsType;

/**
  * Checks if a message contains any bad words.
*/
export function check(string: string | undefined) {
  if (!string) return false;
  return badwords.profanity.some(word => string.split(/\b/).some(w => w.toLowerCase() === word.toLowerCase()));
}

/**
  * If the message contains bad words, it will be censored with asterisk(*).
  *
  * Code referenced from [`@web-mech/badwords`](https://github.com/web-mech/badwords).
*/
export function censor(message: string): string {
  const splitRegex = /\b/;
  const specialChars = /[^a-zA-Z0-9|$|@]|\^/g;
  const matchWord = /\w/g;
  // filter bad words from message
  // and replace it with *
  return message.split(splitRegex).map(word => {
    return check(word) ? word.replace(specialChars, '').replace(matchWord, '\\*') : word;
  }).join(splitRegex.exec(message)?.at(0));
}


/** A function that can be used to send a log of an ***uncensored*** message to the log channel. */
// export async function log(rawContent: string, author: User, guildId: string | null, hubId: string) {
//   const logChan = await author.client.channels.fetch(constants.channel.networklogs) as TextChannel;
//   const hubName = await getHubName(hubId).catch(() => 'Unknown');
//   const guildName = getGuildName(author.client, guildId);
//   const logEmbed = new EmbedBuilder()
//     .setAuthor({ name: `${author.client.user?.username} logs`, iconURL: author.client.user?.avatarURL()?.toString() })
//     .setTitle('Bad Word Detected')
//     .setColor(constants.colors.invisible)
//     .setDescription(`||${rawContent}||\n\n**Author:** @${author.username} \`(${author.id})\`\n**Server:** ${guildName} (${guildId})\n**Hub:** ${hubName}`);
//   return await logChan?.send({ embeds: [logEmbed] });
// }
