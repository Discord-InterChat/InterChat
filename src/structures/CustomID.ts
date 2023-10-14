export class CustomID {
  private customId: string;
  private data: string[];

  constructor(identifier?: string, data: string[] = []) {
    this.customId = identifier ?? '';
    this.data = data;
  }

  setIdentifier(prefix: string, postfix?: string): CustomID {
    this.customId = prefix + (postfix ? `:${postfix}` : '');
    return this;
  }

  addData(value: string): CustomID {
    if (!value) return this;

    if (value.includes('&')) {
      throw new TypeError('Custom ID data cannot contain "&"');
    }

    this.customId += `&${value}`;
    return this;
  }

  static parseCustomId(customId: string) {
    const parsed = {
      identifier: '',
      postfix: '',
      // expiry: undefined as Date | undefined,
      data: [] as string[],
    };

    for (const [index, part] of customId.split('&').entries()) {
      if (index === 0) {
        const [identifier, postfix] = part.split(':');
        parsed.identifier = identifier;
        parsed.postfix = postfix;
      }
      // else if (part.startsWith('ex=')) {
      //   const expiry = parseInt(part.split('=')[1]);
      //   if (isNaN(expiry)) continue;

      //   parsed.expiry = new Date(parseInt(part.split('=')[1]));
      // }
      else {
        parsed.data.push(part);
      }
    }

    return parsed;
  }

  toString() {
    let str = `${this.customId}`;
    if (this.data.length > 0) this.data.forEach((element) => (str += `&${element}`));

    if (str.length > 100) throw new TypeError('Custom ID cannot be longer than 100 characters.');

    return str;
  }
}
