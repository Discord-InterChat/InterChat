// @ts-check

import { Collection, REST, Routes } from 'discord.js';
import 'dotenv/config';
import { readFile, writeFile } from 'fs/promises';
import { extname } from 'path';
import requiredEmojis from '../src/utils/JSON/emojis.json' with { type: 'json' };
import {
  getTimestampFromSnowflake,
  greenText,
  greyText,
  orangeText,
  redText,
  Spinner,
} from './utils.js';
import { stripIndents } from 'common-tags';
import { stripIndent } from 'common-tags';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const supportedMimeMap = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

if (!TOKEN || !CLIENT_ID) {
  throw new Error('Missing Discord token or client ID.');
}

const rest = new REST({ version: '10' }).setToken(TOKEN);
const route = Routes.applicationEmojis(CLIENT_ID);
/**
 * @type {Collection<string, import('discord.js').APIEmoji>}
 */
const emojiCollection = new Collection();

async function initialize() {
  const spinner = new Spinner();
  spinner.start('Syncing emojis with Discord...');

  // Fetch all existing emojis
  await fetchEmojis();

  const requiredEmojisArray = Object.entries(requiredEmojis);
  let missingEmojis = 0;
  let erroredEmojis = 0;

  for (let i = 0; i < requiredEmojisArray.length; i++) {
    const [name, data] = requiredEmojisArray[i];
    const updatedAt = new Date(data.updatedAt || Date.now());
    let emoji = emojiCollection.get(name);
    const indexStr = greyText(`[${i}/${requiredEmojisArray.length}]`);

    if (emoji && getTimestampFromSnowflake(emoji.id) < updatedAt) {
      spinner.update(
        `${indexStr} ${orangeText(`⚠️ Deleting and re-creating emoji ${emoji.name} - ${getEmojiUrl(emoji)} since it already exists.`)}`,
      );
      await deleteEmoji(emoji.id);
      emoji = undefined;
    }

    if (!emoji) {
      try {
        spinner.update(`${indexStr} Creating emoji ${name}...`);

        await createEmoji({
          name,
          image: await fetchEmojiImage(data.url),
        });

        missingEmojis++;
      } catch (error) {
        erroredEmojis++;
        console.error(`Failed to create emoji ${name}:`, error);
      }
    }

    spinner.update(`${indexStr} ${greyText(`Skipping emoji ${name} creation, already exists.`)}`);
  }

  if (erroredEmojis) {
    spinner.stop(
      `Finished syncing emojis with Discord. ${redText(`${erroredEmojis} emoji(s)`)} failed to create.`,
    );
  }

  const createdEmojis = missingEmojis - erroredEmojis;

  const successMsg = stripIndent`
    ${greenText('✓ Sync Complete!')}
       ${greyText('- Total emojis processed')}: ${requiredEmojisArray.length}
       ${greyText('- Created')}: ${createdEmojis}
       ${greyText('- Skipped (already exist)')}: ${requiredEmojisArray.length - missingEmojis}
       ${greyText('- Failed')}: ${erroredEmojis}
  `;

  spinner.stop(successMsg);

  const newSpinner = new Spinner();
  newSpinner.start('Updating emojis.json with new emoji IDs...');
  await updateEmojiJson();

  newSpinner.stop(orangeText('ⓘ ') + 'Updated emojis.json with new emoji IDs.');
}

async function updateEmojiJson() {
  /**
   * @type {Record<keyof typeof requiredEmojis, string>}
   */
  // @ts-ignore
  const newEmojis = emojiCollection
    .filter((e) => e.name)
    .reduce((acc, emoji) => {
      // @ts-ignore
      acc[emoji.name] = {
        url: getEmojiUrl(emoji),
        updatedAt: getTimestampFromSnowflake(emoji.id).toISOString(),
      };
      return acc;
    }, {});

  await writeFile('src/utils/JSON/emojis.json', JSON.stringify(newEmojis, null, 2));
}

/**
 * @param {import("discord.js").APIEmoji} emoji
 */
function getEmojiUrl(emoji) {
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`;
}

// Fetch an emoji image
/**
 * @param {string} url
 */
async function fetchEmojiImage(url) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return urlToDataUri(url);
  } else if (/^\.{0,2}\/|^[a-zA-Z]:\\/.test(url)) {
    const fileData = await readFile(url);
    return bufferToDataUri(Buffer.from(fileData.buffer), getMimeTypeFromPath(url));
  }

  throw new Error('Invalid URL or file path.');
}

async function fetchEmojis() {
  /**
   * @type {{items: {name: string, id: string}[]}}
   */
  // @ts-ignore
  const fetched = await rest.get(route);
  fetched.items.forEach((emoji) => emojiCollection.set(emoji.name, emoji));
}
/**
 *
 * @param {{name: string, image: string}} emoji
 * @returns
 */
async function createEmoji(emoji) {
  /** @type {import('discord.js').APIEmoji} */
  // @ts-ignore
  const created = await rest.post(route, { body: emoji });
  if (created.name) emojiCollection.set(created.name, created);
  return created;
}

/**
 * @param {string} url
 */
async function urlToDataUri(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    const buffer = await response.arrayBuffer();
    return bufferToDataUri(Buffer.from(buffer), contentType ?? 'image/png');
  } catch (error) {
    throw new Error(`Error converting url to data URI: ${error.message}`);
  }
}

/**
 *
 * @param {Buffer} buffer
 * @returns
 */
async function bufferToDataUri(buffer, contentType = 'image/png') {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

/**
 * @param {string} path
 */
function getMimeTypeFromPath(path) {
  const ext = extname(path);
  const type = supportedMimeMap[ext];
  if (!type) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }
  return type;
}

/**
 * @param {string | null} emojiId
 */
async function deleteEmoji(emojiId) {
  if (!emojiId) {
    throw new Error('Invalid emoji ID.');
  }

  if (CLIENT_ID) {
    const emojiRoute = Routes.applicationEmoji(CLIENT_ID, emojiId);
    return rest.delete(emojiRoute);
  }
  throw new Error('Missing client ID.');
}

initialize();
