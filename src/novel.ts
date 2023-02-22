/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-namespace */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { draftRoot, draftsObject } from "./compile";
import { deadLineFolderPath, deadLineTextCount } from "./charactorcount";

type TreeFileNode = {
  dir: string;
  name: string;
  length: number;
  children?: [];
};

type FileNode = {
  dir: string;
  name: string;
  length: number;
};

export class draftTreeProvider
  implements vscode.TreeDataProvider<draftTreeItem>
{
  //draftTreeOrign = () => draftsObject(draftRoot());
  private watch: vscode.FileSystemWatcher;
  constructor() {
    this.watch = vscode.workspace.createFileSystemWatcher("**/*.txt");

    this.watch.onDidChange((uri) => {
      console.log("changed!!!", uri);
      this._onDidChangeTreeData.fire();
    });
    this.watch.onDidCreate((uri) => {
      console.log("changed!!!", uri);
      this._onDidChangeTreeData.fire();
    });
    this.watch.onDidDelete((uri) => {
      console.log("changed!!!", uri);
      this._onDidChangeTreeData.fire();
    });

    console.log(draftRoot());
  }
  //
  private _onDidChangeTreeData: vscode.EventEmitter<
    draftTreeItem | undefined | void
  > = new vscode.EventEmitter<draftTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<draftTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    console.log("refresh");
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: draftTreeItem): draftTreeItem | draftTreeItem {
    //ツリーの最小単位を返す
    return element;
  }

  getChildren(element?: any): draftTreeItem[] {
    if (draftRoot() == "") {
      vscode.window.showInformationMessage("No dependency in empty workspace");
      return [];
    }

    if (element === undefined) {
      const draftTreeOrign: FileNode[] = draftsObject(draftRoot());
      return this.buildDraftTree(draftTreeOrign);
    }
    return this.buildDraftTree(element.children);
  }

  private buildDraftTree(draftObj: FileNode[]): draftTreeItem[] {
    const children: draftTreeItem[] = [];

    draftObj.forEach((draftItem: TreeFileNode) => {
      const treeItem = new draftTreeItem(draftItem);

      children.push(treeItem);
      if (draftItem.children !== undefined) {
        this.buildDraftTree(draftItem.children);
      }
    });

    return children;
  }
}

class draftTreeItem extends vscode.TreeItem {
  children: vscode.TreeItem;
  constructor(draftItem: any) {
    super(
      draftItem.name,
      draftItem.children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );

    this.label = draftItem.name.replace(
      /^([0-9]+[-_\s]){0,1}(.+)(.txt)$/,
      "$2"
    );
    this.description = `:${Intl.NumberFormat().format(draftItem.length)}文字`;
    this.resourceUri = vscode.Uri.file(path.resolve(draftItem.dir));


    if (!draftItem.children) {
      this.iconPath = new vscode.ThemeIcon("note");
    } else {
      this.iconPath = new vscode.ThemeIcon("folder-library");
    }

    if (draftItem.dir == deadLineFolderPath()){
      this.iconPath = new vscode.ThemeIcon("folder-active");
      this.description = `:${Intl.NumberFormat().format(draftItem.length)}/${deadLineTextCount()}文字`;
    }

    this.children = draftItem.children;
    if (draftItem.children === undefined) {
      this.command = {
        command: "vscode.open",
        title: "ファイルを開く",
        arguments: [path.resolve(draftItem.dir)],
      };
      this.contextValue = "file";
    } else {
      this.contextValue = "folder";
    }
  }
}
