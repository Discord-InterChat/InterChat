type ConvertDatesToString<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<ConvertDatesToString<U>>
    : T extends object
      ? { [K in keyof T]: ConvertDatesToString<T[K]> }
      : T;
