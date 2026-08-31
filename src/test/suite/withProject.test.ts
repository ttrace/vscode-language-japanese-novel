import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  loadWithProjectStructure,
  withNodesForDirectory,
} from "../../withProject";

suite("with project structure", () => {
  let projectRoot: string;

  setup(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "novel-writer-with-"));
    fs.mkdirSync(path.join(projectRoot, ".with"));
  });

  teardown(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test("prefix ではなく sortKey と parentId で原稿を並べる", () => {
    fs.mkdirSync(path.join(projectRoot, "原稿"));
    fs.writeFileSync(path.join(projectRoot, "原稿", "10-先.txt"), "先");
    fs.writeFileSync(path.join(projectRoot, "原稿", "2-後.txt"), "後");
    fs.writeFileSync(
      path.join(projectRoot, "with.json"),
      JSON.stringify({
        schemaVersion: 4,
        projectId: "project-1",
        manuscriptFormat: "txt",
        draftFolders: ["原稿", "Draft"],
        imageFolders: ["画像", "Images"],
      }),
    );
    fs.writeFileSync(
      path.join(projectRoot, ".with", "project-index.json"),
      JSON.stringify({
        schemaVersion: 1,
        projectId: "project-1",
        entries: [
          {
            id: { rawValue: "root" },
            relativePath: "原稿",
            kind: "manuscript",
            isDirectory: true,
            isMissing: false,
            sortKey: 1,
          },
          {
            id: { rawValue: "later" },
            parentId: { rawValue: "root" },
            relativePath: "原稿/2-後.txt",
            kind: "manuscript",
            isDirectory: false,
            isMissing: false,
            sortKey: 2,
          },
          {
            id: { rawValue: "first" },
            parentId: { rawValue: "root" },
            relativePath: "原稿/10-先.txt",
            kind: "manuscript",
            isDirectory: false,
            isMissing: false,
            sortKey: 1,
          },
        ],
      }),
    );

    const structure = loadWithProjectStructure(projectRoot);
    assert.ok(structure);
    assert.strictEqual(structure.manuscriptFileType, ".txt");
    assert.deepStrictEqual(
      structure.nodes.map((node) => node.name),
      ["10-先.txt", "2-後.txt"],
    );
  });

  test("原稿ルートがない場合も資料と画像を除外する", () => {
    fs.writeFileSync(path.join(projectRoot, "本文.txt"), "本文");
    fs.mkdirSync(path.join(projectRoot, "資料"));
    fs.writeFileSync(path.join(projectRoot, "資料", "メモ.txt"), "メモ");
    fs.writeFileSync(
      path.join(projectRoot, "with.json"),
      JSON.stringify({
        schemaVersion: 4,
        manuscriptFormat: "txt",
        draftFolders: ["原稿", "Draft"],
        imageFolders: ["画像", "Images"],
      }),
    );
    fs.writeFileSync(
      path.join(projectRoot, ".with", "project-index.json"),
      JSON.stringify({
        schemaVersion: 1,
        entries: [
          {
            id: "manuscript",
            relativePath: "本文.txt",
            kind: "manuscript",
            isDirectory: false,
            isMissing: false,
            sortKey: 1,
          },
          {
            id: "reference",
            relativePath: "資料/メモ.txt",
            kind: "reference",
            isDirectory: false,
            isMissing: false,
            sortKey: 2,
          },
        ],
      }),
    );

    const structure = loadWithProjectStructure(projectRoot);
    assert.ok(structure);
    assert.deepStrictEqual(structure.nodes.map((node) => node.name), ["本文.txt"]);
  });

  test("締切フォルダー内も sortKey 順で取得する", () => {
    fs.mkdirSync(path.join(projectRoot, "原稿", "締切"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "原稿", "締切", "1-後.txt"), "後");
    fs.writeFileSync(path.join(projectRoot, "原稿", "締切", "9-先.txt"), "先");
    fs.writeFileSync(
      path.join(projectRoot, "with.json"),
      JSON.stringify({
        schemaVersion: 4,
        manuscriptFormat: "txt",
        draftFolders: ["原稿", "Draft"],
        imageFolders: ["画像", "Images"],
      }),
    );
    fs.writeFileSync(
      path.join(projectRoot, ".with", "project-index.json"),
      JSON.stringify({
        schemaVersion: 1,
        entries: [
          {
            id: "draft",
            relativePath: "原稿",
            kind: "manuscript",
            isDirectory: true,
            isMissing: false,
            sortKey: 1,
          },
          {
            id: "deadline",
            parentId: "draft",
            relativePath: "原稿/締切",
            kind: "manuscript",
            isDirectory: true,
            isMissing: false,
            sortKey: 1,
          },
          {
            id: "later",
            parentId: "deadline",
            relativePath: "原稿/締切/1-後.txt",
            kind: "manuscript",
            isDirectory: false,
            isMissing: false,
            sortKey: 2,
          },
          {
            id: "first",
            parentId: "deadline",
            relativePath: "原稿/締切/9-先.txt",
            kind: "manuscript",
            isDirectory: false,
            isMissing: false,
            sortKey: 1,
          },
        ],
      }),
    );

    const structure = loadWithProjectStructure(projectRoot);
    assert.ok(structure);
    const nodes = withNodesForDirectory(
      structure,
      projectRoot,
      path.join(projectRoot, "原稿", "締切"),
    );
    assert.ok(nodes);
    assert.deepStrictEqual(nodes.map((node) => node.name), ["9-先.txt", "1-後.txt"]);
  });
});
