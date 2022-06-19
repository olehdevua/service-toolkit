declare type Range = {
    start: number;
    end: number;
};
export declare type HttpRange = {
    type: string;
    ranges: Range[];
};
export declare function parseRange(size: number, header: string, opts?: {
    combine: boolean;
}): HttpRange;
export declare function buildContentRange(type: string, size: number, range?: Range): string;
export {};
//# sourceMappingURL=http.range.d.ts.map