import { randomUUID } from "crypto";
import * as vscode from "vscode";
import {
  createSavedManuscriptIndexUpdate,
  SavedManuscriptIndexUpdate,
} from "./withProjectIndexUpdate";

/**
 * VS Codeで保存された原稿のindexを原子的に更新する。
 * 読み込み後にindexが変化していた場合は、最新内容から最大3回作り直す。
 */
export async function updateWithProjectIndexForSavedDocument(
  document: vscode.TextDocument,
): Promise<boolean> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder || document.uri.scheme !== "file") return false;

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, "with.json");
  const indexUri = vscode.Uri.joinPath(
    workspaceFolder.uri,
    ".with",
    "project-index.json",
  );

  let fileContent: Uint8Array;
  let configContent: Uint8Array;
  try {
    [fileContent, configContent] = await Promise.all([
      vscode.workspace.fs.readFile(document.uri),
      vscode.workspace.fs.readFile(configUri),
    ]);
  } catch {
    return false;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    let indexContent: Uint8Array;
    try {
      indexContent = await vscode.workspace.fs.readFile(indexUri);
    } catch {
      return false;
    }

    let update: SavedManuscriptIndexUpdate | null;
    try {
      update = createSavedManuscriptIndexUpdate(
        workspaceFolder.uri.fsPath,
        document.uri.fsPath,
        fileContent,
        configContent,
        indexContent,
      );
    } catch {
      return false;
    }
    if (!update) return false;

    const temporaryUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      ".with",
      `.project-index-${randomUUID()}.tmp`,
    );
    try {
      await vscode.workspace.fs.writeFile(temporaryUri, update.content);
      const latestIndexContent = await vscode.workspace.fs.readFile(indexUri);
      if (!Buffer.from(latestIndexContent).equals(Buffer.from(indexContent))) {
        await vscode.workspace.fs.delete(temporaryUri);
        continue;
      }
      await vscode.workspace.fs.rename(temporaryUri, indexUri, {
        overwrite: true,
      });
      return true;
    } catch (error) {
      try {
        await vscode.workspace.fs.delete(temporaryUri);
      } catch {
        // 一時ファイルが作られていない場合は何もしない。
      }
      console.warn(`with project indexの更新に失敗しました: ${String(error)}`);
      return false;
    }
  }

  console.warn("with project indexが同時に更新されたため、本文metadataの無効化を見送りました");
  return false;
}
