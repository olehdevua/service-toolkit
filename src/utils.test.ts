import test from "node:test";
import * as assert from "node:assert/strict";
import { flattenObj } from "./utils.js";

test("flattenObj", async t => {
  await t.test("flatten complex object", async () => {
    const result = flattenObj({ foo: { bar: "baz", gaz: {}, maz: [] }, a: [ 4,5, { bar: "fuc" } ] });
    assert.deepEqual(result, {
      "a.2.bar": "fuc",
      "a.1": 5,
      "a.0": 4,
      "foo.maz": [],
      "foo.gaz": {},
      "foo.bar": "baz"
    });
  });

  await t.test("Date and Buffer should be considered as primitive", async () => {
    const date = new Date();
    const buf = Buffer.from("buffer");
    const result = flattenObj({ nested: { date, buf } });

    assert.deepEqual(result, {
      "nested.date": date,
      "nested.buf": buf,
    });
  });
});
