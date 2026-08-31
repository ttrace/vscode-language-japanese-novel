import * as fs from "fs";
import * as path from "path";

const WITH_CONFIG_SCHEMA_VERSION = 4;
const WITH_INDEX_SCHEMA_VERSION = 1;
const RESERVED_REFERENCE_FOLDERS = new Set(["資料", "関連", "Context"]);

export type WithProjectConfig = {
  schemaVersion: number;
  projectId?: string;
  manuscriptFormat: "txt" | "md";
  draftFolders: string[];
  imageFolders: string[];
};

type WithIndexEntry = {
  id: string | { rawValue: string };
  parentId?: string | { rawValue: string };
  relativePath: string;
  kind: "manuscript" | "folder" | "image" | "reference" | "projectConfig";
  isDirectory: boolean;
  isMissing: boolean;
  sortKey?: number;
};

type WithIndex = {
  schemaVersion: number;
  projectId?: string;
  entries: WithIndexEntry[];
};

export type WithProjectNode = {
  id: string;
  sortKey?: number;
  relativePath: string;
  absolutePath: string;
  name: string;
  isDirectory: boolean;
  children: WithProjectNode[];
};

export type WithProjectStructure = {
  manuscriptFileType: ".txt" | ".md";
  nodes: WithProjectNode[];
  projectNodes: WithProjectNode[];
};

function normalizedPath(filePath: string): string {
  return path.resolve(filePath).normalize("NFC");
}

export function withNodesForDirectory(
  structure: WithProjectStructure,
  projectRoot: string,
  directoryPath: string,
): WithProjectNode[] | null {
  if (normalizedPath(projectRoot) === normalizedPath(directoryPath)) {
    return structure.nodes;
  }

  const findDirectory = (nodes: WithProjectNode[]): WithProjectNode | null => {
    for (const node of nodes) {
      if (
        node.isDirectory &&
        normalizedPath(node.absolutePath) === normalizedPath(directoryPath)
      ) {
        return node;
      }
      const child = findDirectory(node.children);
      if (child) return child;
    }
    return null;
  };

  return findDirectory(structure.projectNodes)?.children ?? null;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function loadWithProjectConfig(
  projectRoot: string,
): WithProjectConfig | null {
  const configPath = path.join(projectRoot, "with.json");
  if (!fs.existsSync(configPath)) return null;

  try {
    const config = readJson<WithProjectConfig>(configPath);
    if (
      !Number.isInteger(config.schemaVersion) ||
      config.schemaVersion < 1 ||
      config.schemaVersion > WITH_CONFIG_SCHEMA_VERSION ||
      (config.manuscriptFormat !== "txt" && config.manuscriptFormat !== "md") ||
      !Array.isArray(config.draftFolders) ||
      !config.draftFolders.every((folder) => typeof folder === "string") ||
      !Array.isArray(config.imageFolders) ||
      !config.imageFolders.every((folder) => typeof folder === "string") ||
      (config.projectId !== undefined && typeof config.projectId !== "string")
    ) {
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

export function isWithProject(projectRoot: string): boolean {
  return loadWithProjectConfig(projectRoot) !== null;
}

function idValue(id: string | { rawValue: string } | undefined): string | null {
  if (typeof id === "string") return id;
  return id?.rawValue ?? null;
}

function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0")) {
    return false;
  }
  return !relativePath
    .split(/[\\/]/)
    .some((component) => component === "" || component === "." || component === "..");
}

function compareEntries(left: WithIndexEntry, right: WithIndexEntry): number {
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

function isManuscriptPath(
  relativePath: string,
  activeDraftFolders: Set<string>,
  imageFolders: Set<string>,
): boolean {
  const firstComponent = relativePath.split("/")[0];
  if (activeDraftFolders.size > 0) {
    return activeDraftFolders.has(firstComponent);
  }
  return (
    !RESERVED_REFERENCE_FOLDERS.has(firstComponent) &&
    !imageFolders.has(firstComponent)
  );
}

/**
 * with の管理ファイルを読み、原稿ツリー用の読み取り専用構造を返す。
 * 管理ファイルがない、未対応、または不整合の場合は通常形式へ戻せるよう null を返す。
 */
export function loadWithProjectStructure(
  projectRoot: string,
): WithProjectStructure | null {
  const config = loadWithProjectConfig(projectRoot);
  if (!config) return null;

  try {
    const index = readJson<WithIndex>(
      path.join(projectRoot, ".with", "project-index.json"),
    );
    if (
      index.schemaVersion !== WITH_INDEX_SCHEMA_VERSION ||
      !Array.isArray(index.entries) ||
      (config.projectId && index.projectId && config.projectId !== index.projectId)
    ) {
      throw new Error("project-index.json の形式または projectId が不正です");
    }

    const topLevelDirectories = new Set(
      index.entries
        .filter(
          (entry) =>
            entry.isDirectory &&
            !entry.isMissing &&
            !entry.relativePath.includes("/"),
        )
        .map((entry) => entry.relativePath),
    );
    const activeDraftFolders = new Set(
      config.draftFolders.filter((folder) => topLevelDirectories.has(folder)),
    );
    const imageFolders = new Set(config.imageFolders);
    const manuscriptExtension = `.${config.manuscriptFormat}` as ".txt" | ".md";

    const entries = index.entries.filter((entry) => {
      if (entry.isMissing || !isSafeRelativePath(entry.relativePath)) return false;
      if (!isManuscriptPath(entry.relativePath, activeDraftFolders, imageFolders)) {
        return false;
      }
      if (entry.kind !== "manuscript" && entry.kind !== "folder") return false;
      if (!entry.isDirectory && path.extname(entry.relativePath) !== manuscriptExtension) {
        return false;
      }
      const absolutePath = path.resolve(projectRoot, entry.relativePath);
      const relativeFromRoot = path.relative(path.resolve(projectRoot), absolutePath);
      return (
        relativeFromRoot !== "" &&
        !relativeFromRoot.startsWith(`..${path.sep}`) &&
        relativeFromRoot !== ".." &&
        !path.isAbsolute(relativeFromRoot) &&
        fs.existsSync(absolutePath)
      );
    });

    const entriesByParent = new Map<string | null, WithIndexEntry[]>();
    for (const entry of entries) {
      const parent = idValue(entry.parentId);
      const siblings = entriesByParent.get(parent) ?? [];
      siblings.push(entry);
      entriesByParent.set(parent, siblings);
    }
    for (const siblings of entriesByParent.values()) siblings.sort(compareEntries);

    const buildNode = (entry: WithIndexEntry, ancestors: Set<string>): WithProjectNode | null => {
      const id = idValue(entry.id);
      if (!id || ancestors.has(id)) return null;
      const nextAncestors = new Set(ancestors).add(id);
      const absolutePath = path.resolve(projectRoot, entry.relativePath);
      return {
        id,
        sortKey: entry.sortKey,
        relativePath: entry.relativePath,
        absolutePath,
        name: path.basename(entry.relativePath),
        isDirectory: entry.isDirectory,
        children: (entriesByParent.get(id) ?? [])
          .map((child) => buildNode(child, nextAncestors))
          .filter((child): child is WithProjectNode => child !== null),
      };
    };

    const topLevelEntries = entriesByParent.get(null) ?? [];
    let visibleEntries = topLevelEntries;
    if (activeDraftFolders.size === 1) {
      const onlyRoot = config.draftFolders.find((folder) => activeDraftFolders.has(folder));
      const rootEntry = topLevelEntries.find(
        (entry) => entry.isDirectory && entry.relativePath === onlyRoot,
      );
      if (rootEntry) visibleEntries = entriesByParent.get(idValue(rootEntry.id)) ?? [];
    } else if (activeDraftFolders.size > 1) {
      const rootOrder = new Map(config.draftFolders.map((folder, index) => [folder, index]));
      visibleEntries = topLevelEntries
        .filter((entry) => activeDraftFolders.has(entry.relativePath))
        .sort(
          (left, right) =>
            (rootOrder.get(left.relativePath) ?? Number.MAX_SAFE_INTEGER) -
            (rootOrder.get(right.relativePath) ?? Number.MAX_SAFE_INTEGER),
        );
    }

    const projectNodes = topLevelEntries
      .map((entry) => buildNode(entry, new Set()))
      .filter((node): node is WithProjectNode => node !== null);
    const visibleNodes = visibleEntries
      .map((entry) => buildNode(entry, new Set()))
      .filter((node): node is WithProjectNode => node !== null);

    return {
      manuscriptFileType: manuscriptExtension,
      nodes: visibleNodes,
      projectNodes,
    };
  } catch (error) {
    console.warn(`with プロジェクト情報を読み込めませんでした: ${String(error)}`);
    return null;
  }
}
