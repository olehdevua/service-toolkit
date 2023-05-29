export type NanoSecs = bigint;
export const now: () => NanoSecs = process.hrtime.bigint;
export const diff = (start: NanoSecs, end: NanoSecs): NanoSecs => end - start;
