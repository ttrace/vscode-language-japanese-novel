import { createHash } from "crypto";
import * as path from "path";

type WithConfigForUpdate = {
  schemaVersion: number;
  projectId?: string;
};

type WithIndexEntryForUpdate = {
  relativePath: string;
  kind: string;
  isDirectory: boolean;
  isMissing?: boolean;
  contentHash?: string;
  updatedAt: string;
  lastSeenAt: string;
  manuscriptMetadata?: unknown;
  [key: string]: unknown;
};

type WithIndexForUpdate = {
  schemaVersion: number;
  projectId?: string;
  entries: WithIndexEntryForUpdate[];
  updatedAt: string;
  [key: string]: unknown;
};

export type SavedManuscriptIndexUpdate = {
  content: Uint8Array;
  relativePath: string;
};

function normalizeProjectRelativePath(
  projectRoot: string,
  filePath: string,
): string | null {
  const relativePath = path.relative(path.resolve(projectRoot), path.resolve(filePath));
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }
  return relativePath.split(path.sep).join("/").normalize("NFC");
}

/** 保存済み本文に対応するentryだけを更新する。I/Oは呼び出し側が担当する。 */
export function createSavedManuscriptIndexUpdate(
  projectRoot: string,
  filePath: string,
  fileContent: Uint8Array,
  configContent: Uint8Array,
  indexContent: Uint8Array,
  now: Date = new Date(),
): SavedManuscriptIndexUpdate | null {
  const relativePath = normalizeProjectRelativePath(projectRoot, filePath);
  if (!relativePath) return null;

  const config = JSON.parse(
    Buffer.from(configContent).toString("utf8"),
  ) as WithConfigForUpdate;
  const index = JSON.parse(
    Buffer.from(indexContent).toString("utf8"),
  ) as WithIndexForUpdate;
  if (
    !Number.isInteger(config.schemaVersion) ||
    config.schemaVersion < 1 ||
    config.schemaVersion > 4 ||
    index.schemaVersion !== 1 ||
    !Array.isArray(index.entries) ||
    (config.projectId &&
      index.projectId &&
      config.projectId.toLowerCase() !== index.projectId.toLowerCase())
  ) {
    return null;
  }

  const entry = index.entries.find(
    (candidate) =>
      candidate.relativePath.normalize("NFC") === relativePath &&
      candidate.kind === "manuscript" &&
      candidate.isDirectory === false &&
      candidate.isMissing !== true,
  );
  if (!entry) return null;

  const contentHash = createHash("sha256").update(fileContent).digest("hex");
  if (entry.contentHash === contentHash) return null;

  // with側のJSONEncoder.dateEncodingStrategy = .iso8601 と同じ秒単位にする。
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  entry.contentHash = contentHash;
  entry.updatedAt = timestamp;
  entry.lastSeenAt = timestamp;
  delete entry.manuscriptMetadata;
  index.updatedAt = timestamp;

  return {
    content: Buffer.from(`${JSON.stringify(index, null, 2)}\n`, "utf8"),
    relativePath,
  };
}
