export function flattenObj(data: Record<string, unknown>) {
  const res: Record<string, any> = {};
  let entries = Object.entries(data);

  while(entries.length > 0) {
    const [ key, val ] = entries.pop() as [string, any];
    const isPrimitive = (
      Object(val) !== val  ||
      val instanceof Date ||
      val instanceof Buffer
    );

    if (isPrimitive) {
      res[key] = val;
      continue;
    }

    const isArray =  Array.isArray(val);

    const newEntries: [string, any][] = isArray
      ? val.map((el, idx) => [ `${key}.${idx}`, el ])
      : Object.entries(val).map(([ k, v ]) => [ `${key}.${k}`, v ]);

    if (newEntries.length > 0) {
      entries = entries.concat(newEntries);
      continue;
    }
    res[key] = isArray ? [] : {};
  }

  return res;
}
