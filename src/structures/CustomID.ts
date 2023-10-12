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

    this.customId += `&${value}`;
    return this;
  }

  static toJSON(customId: string) {
    const parsedId = {
      identifier: '',
      postfix: '',
      data: [] as string[],
    };

    for (const [index, part] of customId.split('&').entries()) {
      if (index === 0) {
        const [identifier, postfix] = part.split(':');
        parsedId.identifier = identifier;
        parsedId.postfix = postfix ?? '';
      }
      else {
        parsedId.data.push(part);
      }
    }

    return parsedId;
  }

  toString() {
    let str = `${this.customId}`;
    if (this.data.length > 0) this.data.forEach((element) => (str += `&${element}`));

    if (str.length > 100) throw new TypeError('Custom ID cannot be longer than 100 characters.');

    return str;
  }
}
