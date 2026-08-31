import * as assert from "assert";
import { createSequentialRenamePlan } from "../../renumber";

suite("Sequential renumber plan", () => {
  test("同名のファイルを入れ替える場合も両方を残す計画になる", () => {
    const plan = createSequentialRenamePlan(
      ["1-冒頭.txt", "2-同名.txt", "3-同名.txt"],
      0,
      "after",
    );

    assert.deepStrictEqual(plan.renames, [
      { oldName: "2-同名.txt", newName: "3-同名.txt" },
      { oldName: "3-同名.txt", newName: "4-同名.txt" },
    ]);
  });

  test("変更範囲外のファイルを改名計画に含めない", () => {
    const plan = createSequentialRenamePlan(
      ["1-A.txt", "moving-id-3-C.txt", "2-B.txt", "4-D.txt", "5-E.txt"],
      1,
      "after",
    );

    assert.deepStrictEqual(plan.renames, [
      { oldName: "2-B.txt", newName: "3-B.txt" },
    ]);
    assert.strictEqual(plan.movingFileName, "moving-id-3-C.txt");
  });

  test("すでに正しい連番の項目は書き換えない", () => {
    const plan = createSequentialRenamePlan(
      ["1-同名.txt", "2-同名.txt", "3-同名.txt"],
      -1,
      "after",
    );

    assert.deepStrictEqual(plan.renames, []);
  });
});
