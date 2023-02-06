import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { draftRoot, draftsObject } from "./compile";
import { setFlagsFromString } from "v8";

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
    console.log("element", element);
    return this.buildDraftTree(element.children);
  }

  private buildDraftTree(draftObj: FileNode[]): draftTreeItem[] {
    const children: draftTreeItem[] = [];
    console.log("coming", draftObj);
    draftObj.forEach((draftItem: TreeFileNode) => {
      const treeItem = new draftTreeItem(draftItem);

      children.push(treeItem);
      if (draftItem.children !== undefined) {
        console.log("directory!", draftItem.children);
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

    this.label = draftItem.name.replace(/([0-9]+[-_\s]*)*(.+)(.txt)/, "$2");
    this.description = `:${Intl.NumberFormat().format(draftItem.length)}文字`;
    this.iconPath = draftItem.children
      ? new vscode.ThemeIcon("folder-library")
      : new vscode.ThemeIcon("note");
    this.children = draftItem.children;
    if (draftItem.children === undefined) {
      this.command = {
        command: "vscode.open",
        title: "ファイルを開く",
        arguments: [draftItem.dir],
      };
    }
  }
}
