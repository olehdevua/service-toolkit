import { HttpError } from "../errors.js";
export function parseRange(size, header, opts = { combine: false }) {
    const httpRange = parseRangeInternal(size, header);
    if (httpRange.ranges.length < 1) {
        throw new HttpError("Range unsatisifiable", {
            params: {
                headers: { "Content-Range": buildContentRange("bytes", size) }
            },
            httpStatus: 416,
        });
    }
    if (opts.combine)
        httpRange.ranges = combineRanges(httpRange.ranges);
    return httpRange;
}
function parseRangeInternal(size, header) {
    const index = header.indexOf("=");
    if (index === -1) {
        throw new HttpError("Invalid range header", { params: { val: header } });
    }
    const type = header.slice(0, index);
    const rangeStrings = header.slice(index + 1).split(",");
    const ranges = [];
    for (const rangeStr of rangeStrings) {
        const r = buildRange(rangeStr, size);
        const isInvalid = isNaN(r.start) || isNaN(r.end) || r.start > r.end || r.start < 0;
        if (isInvalid)
            continue;
        ranges.push(r);
    }
    return { type, ranges };
}
function buildRange(rangeStr, size) {
    let [start, end] = rangeStr.split("-").map(e => parseInt(e, 10));
    if (isNaN(start)) {
        start = size - end;
        end = size - 1;
    }
    else if (isNaN(end))
        end = size - 1;
    if (end > size - 1)
        end = size - 1;
    return { start, end };
}
function combineRanges(ranges) {
    const ordered = ranges
        .map((r, i) => ({ ...r, index: i }))
        .sort((a, b) => a.start - b.start);
    for (var j = 0, i = 1; i < ordered.length; i++) {
        const range = ordered[i];
        const current = ordered[j];
        if (range.start > current.end + 1) {
            ordered[++j] = range;
        }
        else if (range.end > current.end) {
            current.end = range.end;
            current.index = Math.min(current.index, range.index);
        }
    }
    ordered.length = j + 1;
    return ordered.sort((a, b) => a.index - b.index);
}
export function buildContentRange(type, size, range) {
    return type + " " + (range ? range.start + "-" + range.end : "*") + "/" + size;
}
//# sourceMappingURL=http.range.js.map