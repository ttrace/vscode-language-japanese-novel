import * as assert from "assert";
import { createHash } from "crypto";
import { createSavedManuscriptIndexUpdate } from "../../withProjectIndexUpdate";

function bytes(value: unknown): Uint8Array {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
}

suite("with project index updates", () => {
  const projectRoot = "/project";
  const config = bytes({
    schemaVersion: 4,
    projectId: "project-1",
  });

  test("本文変更時にhashと日時を更新してmetadataだけを削除する", () => {
    const index = {
      schemaVersion: 1,
      projectId: "project-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      entries: [
        {
          id: { rawValue: "entry-1" },
          kind: "manuscript",
          relativePath: "原稿/本文.txt",
          parentId: { rawValue: "folder-1" },
          sortKey: 7,
          contentHash: "old-hash",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          isDirectory: false,
          isMissing: false,
          manuscriptMetadata: { length: { characterCount: 10 }, headings: [] },
        },
      ],
    };
    const content = bytes("変更後の本文");
    const now = new Date("2026-08-31T12:34:56.000Z");
    const update = createSavedManuscriptIndexUpdate(
      projectRoot,
      "/project/原稿/本文.txt",
      content,
      config,
      bytes(index),
      now,
    );

    assert.ok(update);
    const updated = JSON.parse(Buffer.from(update.content).toString("utf8"));
    const entry = updated.entries[0];
    assert.strictEqual(
      entry.contentHash,
      createHash("sha256").update(content).digest("hex"),
    );
    assert.strictEqual(entry.updatedAt, "2026-08-31T12:34:56Z");
    assert.strictEqual(entry.lastSeenAt, "2026-08-31T12:34:56Z");
    assert.ok(!("manuscriptMetadata" in entry));
    assert.deepStrictEqual(entry.id, index.entries[0].id);
    assert.deepStrictEqual(entry.parentId, index.entries[0].parentId);
    assert.strictEqual(entry.sortKey, 7);
    assert.strictEqual(entry.relativePath, "原稿/本文.txt");
  });

  test("内容のhashが同じ場合はindexを更新しない", () => {
    const content = bytes("同じ本文");
    const index = {
      schemaVersion: 1,
      projectId: "project-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      entries: [
        {
          kind: "manuscript",
          relativePath: "本文.txt",
          sortKey: 1,
          contentHash: createHash("sha256").update(content).digest("hex"),
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          isDirectory: false,
          isMissing: false,
          manuscriptMetadata: { length: {}, headings: [] },
        },
      ],
    };

    assert.strictEqual(
      createSavedManuscriptIndexUpdate(
        projectRoot,
        "/project/本文.txt",
        content,
        config,
        bytes(index),
      ),
      null,
    );
  });

  test("資料、欠落原稿、プロジェクト外ファイルは更新しない", () => {
    const index = {
      schemaVersion: 1,
      projectId: "project-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      entries: [
        {
          kind: "reference",
          relativePath: "資料/メモ.txt",
          contentHash: "old",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          isDirectory: false,
          isMissing: false,
        },
        {
          kind: "manuscript",
          relativePath: "原稿/欠落.txt",
          contentHash: "old",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          isDirectory: false,
          isMissing: true,
        },
      ],
    };

    assert.strictEqual(
      createSavedManuscriptIndexUpdate(
        projectRoot,
        "/project/資料/メモ.txt",
        bytes("変更"),
        config,
        bytes(index),
      ),
      null,
    );
    assert.strictEqual(
      createSavedManuscriptIndexUpdate(
        projectRoot,
        "/outside/本文.txt",
        bytes("変更"),
        config,
        bytes(index),
      ),
      null,
    );
  });
});
