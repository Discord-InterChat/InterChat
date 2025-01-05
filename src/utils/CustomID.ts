import lz from 'lz-string';

export interface ParsedCustomId {
  prefix: string;
  suffix: string;
  expiry?: number;
  args: string[];
}

export class CustomID {
  private customId: string;
  private data: string[];

  constructor(identifier?: string, data: string[] = []) {
    this.customId = identifier ?? '';
    this.data = data;
  }

  /**
   * Sets the identifier of the custom ID.
   * @param prefix - The prefix for the custom ID.
   * @param suffix - The suffix for the custom ID (optional).
   * @returns CustomID - The CustomID instance for method chaining.
   */
  setIdentifier(prefix: string, suffix?: string): this {
    this.customId = `${prefix}${suffix ? `:${suffix}` : ''}`;
    return this;
  }

  /**
   * Adds an argument to the custom ID.
   * @param values - The value to add as an argument.
   * @returns CustomID - The CustomID instance for method chaining.
   */

  setArgs(...values: string[]): this {
    if (!values) return this;

    const invalidChars = ['&'];

    const isValid = values.every((value) => !invalidChars.some((char) => value.includes(char)));

    if (isValid) this.customId += `&${values.join('&')}`;
    else throw new TypeError('CustomID argument cannot contain "&".');

    return this;
  }

  /**
   * Sets the expiry date for the component.
   * @param date - The expiry date.
   * @returns CustomID - The CustomID instance for method chaining.
   */
  setExpiry(date: Date): this {
    this.setArgs(`ex=${date.getTime()}`);
    return this;
  }

  /**
   * Parses a custom ID in the specified format.
   * @param customId - The custom ID to parse.
   * @returns ParsedCustomId - The parsed custom ID object.
   */
  static parseCustomId(customId: string): ParsedCustomId {
    const decoded = lz.decompressFromUTF16(customId) || customId;

    // Split the customId by '&'
    const split = decoded.split('&');

    // Extract prefix and postfix
    const [prefix, ...suffix] = split[0].split(':');

    // Extract expiry from arguments
    const expiryArg = split.slice(1).find((arg) => arg.startsWith('ex='));
    const expiry = expiryArg ? Number.parseInt(expiryArg.replace('ex=', ''), 10) : undefined;

    // Filter out 'ex=' arguments and store the rest in 'args'
    const args = split.slice(1).filter((arg) => !arg.startsWith('ex='));

    const parsed: ParsedCustomId = {
      prefix,
      suffix: suffix.join(':'),
      expiry,
      args,
    };

    return parsed;
  }

  /**
   * Converts the CustomID instance to its string representation.
   * @returns string - The string representation of the CustomID.
   */
  toString() {
    let str = this.customId;

    if (this.data.length > 0) {
      for (const element of this.data) {
        str += `&${element}`;
      }
    }

    // compress and encode the string
    str = lz.compressToUTF16(str).toString();
    if (str.length > 100) throw new Error(`CustomID is too long: ${str} (length: ${str.length})`);
    return str;
  }
}
