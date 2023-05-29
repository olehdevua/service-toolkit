import { HttpError } from "../errors.js";

export type Range = { start: number, end: number};

const RangeRegEx = /^(\d*)-(\d*)$/;
// Regular expression for identifying a bytes Range header.
const BYTES_RANGE_REGEXP = /^ *bytes=/;

export class HttpRange {
  constructor(
    public type: string,
    public ranges: Range[],
  ) {}

  static parse(rangeHeader: string, len: number, combine = false) {
    const header = rangeHeader;
    const errParams = {
      params: {
        headers: { "Content-Range": buildContentRange("bytes", len) },
        rangeHeader: header,
      },
      httpStatus: 416,
    };

    // if (typeof header !== "string")
    //   throw new HttpError("requested range not satisfiable. no range", errParams);

    const index = header.indexOf("=");

    if (index === -1)
      throw new HttpError("requested range not satisfiable. no `=` sign", errParams);

    const type = header.slice(0, index).trim();
    const rangeStrings = header.slice(index + 1).split(",");

    const ranges = rangeStrings
      .map(r => buildRange(r, len))
      .filter(r => (
        isNaN(r.start) || isNaN(r.end) ||
        r.start > r.end || r.start < 0
      ));

    if (ranges.length < 1) {
      throw new HttpError("requested range not satisfiable. no ranges", errParams);
    }

    const httpRange = new HttpRange(type, ranges);
    if (combine) httpRange.combine();

    return httpRange;
  }

  static isBytes(rangeHeader: string): boolean {
    return BYTES_RANGE_REGEXP.test(rangeHeader);
  }

  isBytes(): boolean {
    return this.type === "bytes";
  }

  // Combine overlapping & adjacent ranges.
  private combine() {
    const ordered = this.ranges
      .map((r, i) => ({ ...r, index: i }))
      .sort((a, b) => a.start - b.start);

    // eslint-disable-next-line no-var
    for (var j = 0, i = 1; i < ordered.length; i++) {
      const current = ordered[j];
      const range = ordered[i];

      if (!range || !current) break;

      if (range.start > current.end + 1) {
        // next range
        ordered[++j] = range;
      } else if (range.end > current.end) {
        // extend range
        current.end = range.end;
        current.index = Math.min(current.index, range.index);
      }
    }

    ordered.length = j + 1; // trim ordered array

    this.ranges = ordered.sort((a, b) => a.index - b.index);
  }

  // Create a Content-Range header.
  buildContentRange(size: number): string {
    return buildContentRange(this.type, size, this.ranges[0]);
  }
}

function buildRange(rangeStr: string, size: number): Range {
  const parsed = RangeRegEx.exec(rangeStr);
  if (!Array.isArray(parsed)) {
    throw new HttpError("Range header component doesn't match \\d*-\\d*", { params: { value: rangeStr } });
  }

  let start = parseInt(parsed[1] as string, 10);
  let end = parseInt(parsed[2] as string, 10);

  if (isNaN(start)) {
    start = size - end;
    end = size - 1;
  }
  else if (isNaN(end)) end = size - 1;

  // limit last-byte-pos to current length
  if (end > size - 1) end = size - 1;

  return { start, end };
}

// Create a Content-Range header.
function buildContentRange(
  type: string,
  size: number,
  range?: Range
): string {
  return type + " " + (range ? range.start + "-" + range.end : "*") + "/" + size;
}
