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


export class draftTreeProvider {
  //draftTreeOrign = () => draftsObject(draftRoot());

  getTreeItem(element: draftTreeItem): draftTreeItem | Thenable<draftTreeItem> {
    
    //ツリーの最小単位を返す
    return element;
  }

  getChildren(element?: any): Thenable<draftTreeItem[]> {
    if (draftRoot() == "") {
      vscode.window.showInformationMessage("No dependency in empty workspace");
      return Promise.resolve([]);
    }

    if (element) {
      console.log("element", element);
      return Promise.resolve(this.buildDraftTree(element));
    } else {
      const draftTreeOrign: FileNode[] = draftsObject(draftRoot());
      return Promise.resolve(this.buildDraftTree(draftTreeOrign));
    }
    return Promise.resolve([]);
  }

  private buildDraftTree(draftObj: FileNode[]): draftTreeItem[] {
    const children: draftTreeItem[] = [];
    console.log("coming", draftObj);
    draftObj.forEach((draftItem: TreeFileNode) => {
      const treeItem = new draftTreeItem(draftItem);
      console.log("DraftObj:", treeItem);
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
  constructor(draftItem: any) {
    super(
      draftItem.name,
      draftItem.children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.label = draftItem.name;
  }
}
