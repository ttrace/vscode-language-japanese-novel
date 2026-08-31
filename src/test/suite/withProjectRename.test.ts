import * as assert from "assert";
import { createWithProjectRenameUpdate } from "../../withProjectRenameUpdate";

function bytes(value: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(value));
}

suite("with project rename", () => {
  test("フォルダーと全子孫のrelativePathを更新する", () => {
    const update = createWithProjectRenameUpdate(
      bytes({
        schemaVersion: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        entries: [
          { relativePath: "原稿/1-前編", isDirectory: true },
          { relativePath: "原稿/1-前編/1-本文.txt", isDirectory: false },
          { relativePath: "原稿/1-前編/子", isDirectory: true },
          { relativePath: "原稿/1-前編/子/2-本文.txt", isDirectory: false },
          { relativePath: "原稿/2-後編", isDirectory: true },
        ],
      }),
      "/project",
      "/project/原稿/1-前編",
      "1-序章",
      new Date("2026-08-31T12:00:00Z"),
    );
    const index = JSON.parse(Buffer.from(update.content).toString("utf8"));
    assert.deepStrictEqual(
      index.entries.map((entry: { relativePath: string }) => entry.relativePath),
      [
        "原稿/1-序章",
        "原稿/1-序章/1-本文.txt",
        "原稿/1-序章/子",
        "原稿/1-序章/子/2-本文.txt",
        "原稿/2-後編",
      ],
    );
  });

  test("ファイル改名では原稿拡張子を維持する", () => {
    const update = createWithProjectRenameUpdate(
      bytes({
        schemaVersion: 1,
        entries: [{ relativePath: "原稿/1-本文.txt", isDirectory: false }],
      }),
      "/project",
      "/project/原稿/1-本文.txt",
      "1-改稿",
    );
    assert.strictEqual(update.newRelativePath, "原稿/1-改稿.txt");
  });

  test("ファイルの数字prefixを入力どおりに変更する", () => {
    const update = createWithProjectRenameUpdate(
      bytes({
        schemaVersion: 1,
        entries: [
          {
            id: "manuscript-1",
            relativePath: "原稿/1-本文.txt",
            isDirectory: false,
            sortKey: 7,
          },
        ],
      }),
      "/project",
      "/project/原稿/1-本文.txt",
      "20-改稿.txt",
    );
    const index = JSON.parse(Buffer.from(update.content).toString("utf8"));
    assert.strictEqual(update.newRelativePath, "原稿/20-改稿.txt");
    assert.strictEqual(index.entries[0].id, "manuscript-1");
    assert.strictEqual(index.entries[0].sortKey, 7);
  });

  test("同じ階層の重複名を拒否する", () => {
    assert.throws(() =>
      createWithProjectRenameUpdate(
        bytes({
          schemaVersion: 1,
          entries: [
            { relativePath: "原稿/前編", isDirectory: true },
            { relativePath: "原稿/後編", isDirectory: true },
          ],
        }),
        "/project",
        "/project/原稿/前編",
        "後編",
      ),
    );
  });
});
