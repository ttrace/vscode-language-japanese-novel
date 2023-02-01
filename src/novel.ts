import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { draftRoot, draftsObject } from "./compile";

export class draftTreeProvider {
  constructor(private documentRootpath: string) {}

  getTreeItem(element: draftTree): draftTree | Thenable<draftTree> {
    //ツリーの最小単位を返す
    return element;
  }

  getChildren(element?: draftTree): Thenable<draftTree[]> {
    return Promise.resolve([]);
  }

  private getFileChildren(uri: vscode.Uri): draftTree[] {
    const children: draftTree[] = [];
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
      const workspaceUri = folder.uri;
      const folderPath = workspaceUri.fsPath;
      try {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
          const filePath = path.join(folderPath, file);
          const stat = fs.lstatSync(filePath);
          if (stat.isDirectory()) {
            const child = new draftTree(
              vscode.Uri.file(filePath),
              vscode.TreeItemCollapsibleState.Collapsed
            );
            children.push(child);
          } else if (stat.isFile()) {
            const child = new draftTree(
              vscode.Uri.file(filePath),
              vscode.TreeItemCollapsibleState.None
            );
            children.push(child);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    return children;
  }
}

class draftTree extends vscode.TreeItem {}
