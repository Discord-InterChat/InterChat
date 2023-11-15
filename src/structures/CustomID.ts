interface ParsedCustomId {
  prefix: string;
  postfix: string;
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
   * @param postfix - The postfix for the custom ID (optional).
   * @returns CustomID - The CustomID instance for method chaining.
   */
  setIdentifier(prefix: string, postfix?: string): CustomID {
    this.customId = `${prefix}${postfix ? `:${postfix}` : ''}`;
    return this;
  }

  /**
   * Adds an argument to the custom ID.
   * @param values - The value to add as an argument.
   * @returns CustomID - The CustomID instance for method chaining.
   */
  addArgs(...values: string[]): CustomID {
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
  setExpiry(date: Date): CustomID {
    this.addArgs(`ex=${date.getTime()}`);
    return this;
  }

  /**
   * Parses a custom ID in the specified format.
   * @param customId - The custom ID to parse.
   * @returns ParsedCustomId - The parsed custom ID object.
   */
  static parseCustomId(customId: string): ParsedCustomId {
    // Split the customId by '&'
    const split = customId.split('&');

    // Extract prefix and postfix
    const [prefix, ...postfix] = split[0].split(':');

    // Extract expiry from arguments
    const expiryArg = split.slice(1).find((arg) => arg.startsWith('ex='));
    const expiry = expiryArg ? parseInt(expiryArg.replace('ex=', ''), 10) : undefined;

    // Filter out 'ex=' arguments and store the rest in 'args'
    const args = split.slice(1).filter((arg) => !arg.startsWith('ex='));

    const parsed: ParsedCustomId = {
      prefix,
      postfix: postfix.join(':'),
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
    let str = `${this.customId}`;
    if (this.data.length > 0) this.data.forEach((element) => (str += `&${element}`));

    if (str.length > 100) throw new TypeError('Custom ID cannot be longer than 100 characters.');

    return str;
  }
}
