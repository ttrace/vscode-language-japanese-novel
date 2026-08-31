import { randomUUID } from "crypto";
import * as path from "path";
import * as vscode from "vscode";

type NodeID = string | { rawValue: string };
type IndexEntry = {
  id: NodeID;
  parentId?: NodeID;
  relativePath: string;
  kind: string;
  isDirectory: boolean;
  isMissing?: boolean;
  sortKey?: number;
  updatedAt: string;
  lastSeenAt: string;
  [key: string]: unknown;
};
type ProjectIndex = {
  schemaVersion: number;
  projectId?: string;
  entries: IndexEntry[];
  updatedAt: string;
  [key: string]: unknown;
};

function idValue(id: NodeID | undefined): string | null {
  if (typeof id === "string") return id;
  return id?.rawValue ?? null;
}

function sameID(left: NodeID | undefined, right: NodeID | undefined): boolean {
  return idValue(left) === idValue(right);
}

function relativePathFromRoot(rootPath: string, filePath: string): string {
  const relative = path.relative(path.resolve(rootPath), path.resolve(filePath));
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("原稿ルート外の項目は移動できません");
  }
  return relative.split(path.sep).join("/").normalize("NFC");
}

function compareEntries(left: IndexEntry, right: IndexEntry): number {
  if (
    typeof left.sortKey === "number" &&
    typeof right.sortKey === "number" &&
    left.sortKey !== right.sortKey
  ) {
    return left.sortKey - right.sortKey;
  }
  return left.relativePath.localeCompare(right.relativePath, "ja", {
    numeric: true,
  });
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizedFilePath(filePath: string): string {
  return path.resolve(filePath).normalize("NFC");
}

function parentRelativePath(relativePath: string): string {
  const slash = relativePath.lastIndexOf("/");
  return slash < 0 ? "" : relativePath.slice(0, slash);
}

function joinRelativePath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function reorderSiblings(entries: IndexEntry[], parentId: NodeID | undefined): void {
  entries
    .filter(
      (entry) =>
        entry.isMissing !== true &&
        (entry.kind === "manuscript" || entry.kind === "folder") &&
        sameID(entry.parentId, parentId),
    )
    .sort(compareEntries)
    .forEach((entry, index) => {
      entry.sortKey = index + 1;
    });
}

function makeUpdatedIndex(
  indexContent: Uint8Array,
  rootPath: string,
  destinationPath: string,
  insertPoint: "before" | "inside" | "after",
  movingPath: string,
  now: Date,
): { content: Uint8Array; oldRelativePath: string; newRelativePath: string } {
  const index = JSON.parse(Buffer.from(indexContent).toString("utf8")) as ProjectIndex;
  if (index.schemaVersion !== 1 || !Array.isArray(index.entries)) {
    throw new Error("対応していないproject-index.jsonです");
  }

  const movingRelativePath = relativePathFromRoot(rootPath, movingPath);
  const destinationRelativePath = relativePathFromRoot(rootPath, destinationPath);
  const movingEntry = index.entries.find(
    (entry) => entry.relativePath.normalize("NFC") === movingRelativePath,
  );
  const destinationEntry = index.entries.find(
    (entry) => entry.relativePath.normalize("NFC") === destinationRelativePath,
  );
  if (!movingEntry || !destinationEntry) {
    throw new Error("移動対象がproject-index.jsonに見つかりません");
  }
  if (
    movingEntry.isMissing === true ||
    destinationEntry.isMissing === true ||
    (movingEntry.kind !== "manuscript" && movingEntry.kind !== "folder") ||
    (destinationEntry.kind !== "manuscript" && destinationEntry.kind !== "folder")
  ) {
    throw new Error("原稿以外の項目はドラッグ＆ドロップできません");
  }
  if (sameID(movingEntry.id, destinationEntry.id)) {
    throw new Error("同じ項目には移動できません");
  }
  if (insertPoint === "inside" && !destinationEntry.isDirectory) {
    throw new Error("ファイルの中には移動できません");
  }
  if (
    movingEntry.isDirectory &&
    destinationRelativePath.startsWith(`${movingRelativePath}/`)
  ) {
    throw new Error("フォルダーを自身の配下へ移動できません");
  }

  const oldParentId = movingEntry.parentId;
  const newParentId =
    insertPoint === "inside" ? destinationEntry.id : destinationEntry.parentId;
  const newParentPath =
    insertPoint === "inside"
      ? destinationEntry.relativePath
      : parentRelativePath(destinationEntry.relativePath);
  const newRelativePath = joinRelativePath(
    newParentPath,
    path.posix.basename(movingEntry.relativePath),
  );
  if (
    newRelativePath !== movingEntry.relativePath &&
    index.entries.some((entry) => entry.relativePath === newRelativePath)
  ) {
    throw new Error("移動先に同名の項目があります");
  }

  const targetSiblings = index.entries
    .filter(
      (entry) =>
        entry.isMissing !== true &&
        !sameID(entry.id, movingEntry.id) &&
        (entry.kind === "manuscript" || entry.kind === "folder") &&
        sameID(entry.parentId, newParentId),
    )
    .sort(compareEntries);
  const destinationIndex = targetSiblings.findIndex((entry) =>
    sameID(entry.id, destinationEntry.id),
  );
  const insertionIndex =
    insertPoint === "inside"
      ? 0
      : insertPoint === "before"
        ? destinationIndex
        : destinationIndex + 1;
  if (insertPoint !== "inside" && destinationIndex < 0) {
    throw new Error("移動先の並び順を解決できません");
  }

  const orderedTargetSiblings = [...targetSiblings];
  orderedTargetSiblings.splice(insertionIndex, 0, movingEntry);
  const nowString = timestamp(now);
  const previousPrefix = `${movingEntry.relativePath}/`;
  const nextPrefix = `${newRelativePath}/`;
  movingEntry.parentId = newParentId;
  movingEntry.relativePath = newRelativePath;
  movingEntry.updatedAt = nowString;
  movingEntry.lastSeenAt = nowString;
  for (const entry of index.entries) {
    if (entry.relativePath.startsWith(previousPrefix)) {
      entry.relativePath = `${nextPrefix}${entry.relativePath.slice(previousPrefix.length)}`;
      entry.updatedAt = nowString;
      entry.lastSeenAt = nowString;
    }
  }
  orderedTargetSiblings.forEach((entry, index) => {
    entry.sortKey = index + 1;
  });
  if (!sameID(oldParentId, newParentId)) {
    reorderSiblings(index.entries, oldParentId);
  }
  index.updatedAt = nowString;

  return {
    content: Buffer.from(`${JSON.stringify(index, null, 2)}\n`, "utf8"),
    oldRelativePath: movingRelativePath,
    newRelativePath,
  };
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function moveAndReorderWithProject(
  projectRoot: vscode.Uri,
  destinationPath: string,
  insertPoint: "before" | "inside" | "after",
  movingPath: string,
): Promise<string> {
  const indexUri = vscode.Uri.joinPath(projectRoot, ".with", "project-index.json");
  const indexContent = await vscode.workspace.fs.readFile(indexUri);
  const update = makeUpdatedIndex(
    indexContent,
    projectRoot.fsPath,
    destinationPath,
    insertPoint,
    movingPath,
    new Date(),
  );
  // I/OにはVS Codeから渡された実在パスを使う。index由来のパスは、
  // macOSで日本語名のNFC/NFDが異なる可能性があるため比較用途に限定する。
  const oldUri = vscode.Uri.file(movingPath);
  const indexedNewUri = vscode.Uri.joinPath(
    projectRoot,
    ...update.newRelativePath.split("/"),
  );
  const changesPhysicalPath =
    normalizedFilePath(oldUri.fsPath) !== normalizedFilePath(indexedNewUri.fsPath);
  const newUri = changesPhysicalPath ? indexedNewUri : oldUri;
  if (changesPhysicalPath && (await exists(newUri))) {
    throw new Error("移動先に同名のファイルまたはフォルダーがあります");
  }

  const temporaryIndexUri = vscode.Uri.joinPath(
    projectRoot,
    ".with",
    `.project-index-${randomUUID()}.tmp`,
  );
  await vscode.workspace.fs.writeFile(temporaryIndexUri, update.content);
  try {
    const latestIndex = await vscode.workspace.fs.readFile(indexUri);
    if (!Buffer.from(latestIndex).equals(Buffer.from(indexContent))) {
      throw new Error("project-index.jsonが別の処理で更新されました");
    }
    if (changesPhysicalPath) {
      await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
    }
    try {
      await vscode.workspace.fs.rename(temporaryIndexUri, indexUri, {
        overwrite: true,
      });
    } catch (error) {
      if (changesPhysicalPath) {
        await vscode.workspace.fs.rename(newUri, oldUri, { overwrite: false });
      }
      throw error;
    }
    return newUri.fsPath;
  } catch (error) {
    try {
      await vscode.workspace.fs.delete(temporaryIndexUri);
    } catch {
      // 一時indexがすでに置換済みの場合は何もしない。
    }
    throw error;
  }
}
