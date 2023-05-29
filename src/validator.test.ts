import test from "node:test";
import { Mapper } from "./validator.js";

class User {
  constructor(
    private name: string,
    private age: number,
  ) {}
}

test("Mapper", t => {
  t.test("add field mapper", () => {
    const m = new Mapper<User>();

    m.add({
      src: "name",
      dst: "iName",
      depth: { type: "range", from: 0 },
    })
  })

  t.test("src is string, has dst");
  t.test("src is regex, has no dst");
  t.test("src is string-with-minor-regex ($ ^ just-match), but can change dst(memoize it to revert)");

});
