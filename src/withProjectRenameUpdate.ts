import * as path from "path";

type IndexEntry = {
  relativePath: string;
  isDirectory: boolean;
  updatedAt?: string;
  lastSeenAt?: string;
  [key: string]: unknown;
};

type ProjectIndex = {
  schemaVersion: number;
  entries: IndexEntry[];
  updatedAt?: string;
  [key: string]: unknown;
};

function timestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function relativePathFromRoot(rootPath: string, itemPath: string): string {
  const relative = path.relative(path.resolve(rootPath), path.resolve(itemPath));
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("原稿ルート外の項目は改名できません");
  }
  return relative.split(path.sep).join("/").normalize("NFC");
}

function validateName(newName: string): void {
  if (!newName || newName === "." || newName === ".." || /[\\/\0]/.test(newName)) {
    throw new Error("使用できない名前です");
  }
}

export function createWithProjectRenameUpdate(
  indexContent: Uint8Array,
  rootPath: string,
  targetPath: string,
  requestedName: string,
  now: Date = new Date(),
): { content: Uint8Array; oldRelativePath: string; newRelativePath: string } {
  validateName(requestedName);
  const index = JSON.parse(Buffer.from(indexContent).toString("utf8")) as ProjectIndex;
  if (index.schemaVersion !== 1 || !Array.isArray(index.entries)) {
    throw new Error("対応していないproject-index.jsonです");
  }

  const oldRelativePath = relativePathFromRoot(rootPath, targetPath);
  const entry = index.entries.find(
    (candidate) => candidate.relativePath.normalize("NFC") === oldRelativePath,
  );
  if (!entry) throw new Error("改名対象がproject-index.jsonに見つかりません");

  const oldName = path.posix.basename(entry.relativePath);
  const oldExtension = entry.isDirectory ? "" : path.posix.extname(oldName);
  const nameWithoutManuscriptExtension = requestedName.replace(/\.(?:txt|md)$/i, "");
  const newName = entry.isDirectory ? requestedName : `${nameWithoutManuscriptExtension}${oldExtension}`;
  validateName(newName);

  const parentPath = path.posix.dirname(entry.relativePath);
  const newRelativePath = parentPath === "." ? newName : `${parentPath}/${newName}`;
  if (
    newRelativePath.normalize("NFC") !== oldRelativePath &&
    index.entries.some(
      (candidate) => candidate.relativePath.normalize("NFC") === newRelativePath.normalize("NFC"),
    )
  ) {
    throw new Error("同じ名前のファイルまたはフォルダーがあります");
  }

  const nowString = timestamp(now);
  const oldPrefix = `${entry.relativePath}/`;
  const newPrefix = `${newRelativePath}/`;
  for (const candidate of index.entries) {
    if (candidate === entry) {
      candidate.relativePath = newRelativePath;
    } else if (candidate.relativePath.startsWith(oldPrefix)) {
      candidate.relativePath = `${newPrefix}${candidate.relativePath.slice(oldPrefix.length)}`;
    } else {
      continue;
    }
    candidate.updatedAt = nowString;
    candidate.lastSeenAt = nowString;
  }
  index.updatedAt = nowString;

  return {
    content: Buffer.from(`${JSON.stringify(index, null, 2)}\n`, "utf8"),
    oldRelativePath,
    newRelativePath,
  };
}
