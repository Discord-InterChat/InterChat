// import { checkAndFetchImgurUrl } from '../src/utils/Utils.js';

describe('checkAndFetchImgurUrl', () => {
  it('should return false for any other URL', async () => {
    const url = 'https://example.com';
    const result = await (await import('../src/utils/Utils.js')).checkAndFetchImgurUrl(url);
    expect(result).toBe(false);
  });

  it('should return false for Imgur URLs with invalid IDs', async () => {
    const url = 'https://imgur.com/invalid';
    const result = await (await import('../src/utils/Utils.js')).checkAndFetchImgurUrl(url);
    expect(result).toBe(false);
  });

  it('should return cover image if its a gallery', async () => {
    const url = 'https://imgur.com/gallery/Xqre9nv';
    const result = await (await import('../src/utils/Utils.js')).checkAndFetchImgurUrl(url);
    expect(result).toBe('https://i.imgur.com/lGeNJwz.jpg');
  });

  it('should return cover image if its an album', async () => {
    const url = 'https://imgur.com/a/Xqre9nv';
    const result = await (await import('../src/utils/Utils.js')).checkAndFetchImgurUrl(url);
    expect(result).toBe('https://i.imgur.com/lGeNJwz.jpg');
  });

  it('should return Imgur URLs for valid Imgur URLs', async () => {
    const url = 'https://imgur.com/uoRJPwW';
    const result = await (await import('../src/utils/Utils.js')).checkAndFetchImgurUrl(url);
    expect(result).toBe('https://i.imgur.com/uoRJPwW.gif');
  });

  it('should return Imgur URL for other links containing imgur.com link', async () => {
    const url = 'https://i.imgur.com/uoRJPwW.gifhttps://images-ext-2.discordapp.net/external/WnWKgbKlgzwldrUZwAdI2aazoE_OirSHiMp7FDly3yA/https/i.imgur.com/SqxbMDm.png?width=493&height=246';
    const result = await (await import('../src/utils/Utils.js')).checkAndFetchImgurUrl(url);
    expect(result).toBe(url);
  });
});
