import Constants from '#main/config/Constants.js';
import Logger from '#utils/Logger.js';

/**
 * Returns the URL of an attachment in a message, if it exists.
 * @param message The message to search for an attachment URL.
 * @returns The URL of the attachment, or null if no attachment is found.
 */
export const getAttachmentURL = async (string: string) => {
  // Image URLs
  const URLMatch = string.match(Constants.Regex.StaticImageUrl);
  if (URLMatch) return URLMatch[0];

  // Tenor Gifs
  const gifMatch = string.match(Constants.Regex.TenorLinks);
  if (!gifMatch) return null;

  try {
    if (!process.env.TENOR_KEY) throw new TypeError('Tenor API key not found in .env file.');
    const id = gifMatch[0].split('-').at(-1);
    const url = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;
    const gifJSON = (await (await fetch(url)).json()) as {
      results: { media: { gif: { url: string } }[] }[];
    };

    return gifJSON.results.at(0)?.media.at(0)?.gif.url as string | null;
  }
  catch (e) {
    Logger.error(e);
    return null;
  }
};

export const stripTenorLinks = (content: string, imgUrl: string) =>
  content.replace(Constants.Regex.TenorLinks, '').replace(imgUrl, '');
