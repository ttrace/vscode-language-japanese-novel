import { randomUUID } from "crypto";
import * as vscode from "vscode";
import { createWithProjectRenameUpdate } from "./withProjectRenameUpdate";

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function renameWithProjectItem(
  projectRoot: vscode.Uri,
  targetPath: string,
  newName: string,
): Promise<string> {
  const indexUri = vscode.Uri.joinPath(projectRoot, ".with", "project-index.json");
  const indexContent = await vscode.workspace.fs.readFile(indexUri);
  const update = createWithProjectRenameUpdate(
    indexContent,
    projectRoot.fsPath,
    targetPath,
    newName,
  );
  if (update.oldRelativePath === update.newRelativePath) return targetPath;
  const oldUri = vscode.Uri.file(targetPath);
  const newUri = vscode.Uri.joinPath(
    projectRoot,
    ...update.newRelativePath.split("/"),
  );
  if (oldUri.fsPath.normalize("NFC") !== newUri.fsPath.normalize("NFC") && await exists(newUri)) {
    throw new Error("同じ名前のファイルまたはフォルダーがあります");
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
    await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
    try {
      await vscode.workspace.fs.rename(temporaryIndexUri, indexUri, { overwrite: true });
    } catch (error) {
      await vscode.workspace.fs.rename(newUri, oldUri, { overwrite: false });
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
