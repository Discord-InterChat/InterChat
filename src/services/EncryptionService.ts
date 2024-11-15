import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly authTagLength = 16;
  private encryptionKey: Buffer;

  constructor() {
    // Load from environment variable - make sure this is set for all shards
    const keyString = process.env.ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY environment variable must be set');
    }
    this.encryptionKey = Buffer.from(keyString, 'base64');
  }

  encrypt(text: string): string {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Store format: base64(iv + encrypted + authTag)
    return Buffer.concat([
      iv,
      Buffer.from(encrypted, 'hex'),
      authTag,
    ]).toString('base64');
  }

  decrypt(encoded: string): string {
    try {
      const buf = Buffer.from(encoded, 'base64');

      const iv = buf.subarray(0, this.ivLength);
      const authTag = buf.subarray(buf.length - this.authTagLength);
      const encrypted = buf.subarray(this.ivLength, buf.length - this.authTagLength);

      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let dec = decipher.update(encrypted);
      dec = Buffer.concat([dec, decipher.final()]);

      return dec.toString('utf8');
    }
    catch (error) {
      throw new Error(`Failed to decrypt message: ${error.message}`);
    }
  }
}
