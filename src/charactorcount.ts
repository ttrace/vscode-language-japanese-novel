//Original code is published by 8amjp/vsce-charactercount] https://github.com/8amjp/vsce-charactercount under MIT

"use strict";
import * as path from "path";
import * as fs from "fs";
import { draftsObject, ifFileInDraft } from "./compile";
import TreeModel from "tree-model";
// import os from "os";

import {
  window,
  Disposable,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  workspace,
} from "vscode";
import * as vscode from "vscode";

import { totalLength, draftRoot } from "./compile";
import simpleGit, { SimpleGit } from "simple-git";
import { distance } from "fastest-levenshtein";

let projectCharacterCountNum = 0;
let countingFolderPath = "";
let countingTarget = "";

if (draftRoot() != "") {
  projectCharacterCountNum = totalLength(draftRoot());
} else {
  projectCharacterCountNum = 0;
}

export function deadLineFolderPath(): string {
  return countingFolderPath;
}

export function deadLineTextCount(): string {
  return countingTarget;
}

export class CharacterCounter {
  private _statusBarItem!: StatusBarItem;
  private _countingFolder = "";
  private _countingTargetNum = 0;
  private _folderCount = {
    label: "",
    amountLengthNum: 0,
  };
  public totalCountPrevious = totalLength(draftRoot());
  public writingDate = new Date();
  public deadlineCountPrevious = 0;
  public totalCountPreviousDate = new Date();
  public deadlineCountPreviousDate = 0;
  public totalWritingProgress = 0;
  public deadlineWritingProgress = 0;
  private workspaceState: vscode.Memento | undefined;

  private _isEditorChildOfTargetFolder = false;
  timeoutID: unknown;

  constructor(private readonly context?: vscode.ExtensionContext) {
    if (context) {
      this.workspaceState = context.workspaceState;
      this.totalCountPrevious = totalLength(draftRoot());
      console.log("文字数カウンター初期化", totalLength(draftRoot()));

      //テスト用
      const ifTest = false;
      if (ifTest) {
        context.workspaceState.update("totalCountPrevious", undefined);
        context.workspaceState.update("totalCountPreviousDate", undefined);
      }

      // 前回記録したテキスト総数と記録日

      // 前日までの進捗が存在しなかった時の処理
      // 進捗がなかった場合、現在の文字数を前日分として比較対象にする。
      if (typeof context.workspaceState.get("totalCountPrevious") != "number") {
        console.log("ステータス初回保存");
        //現在の文字総数を保存
        context.workspaceState.update(
          "totalCountPrevious",
          this.totalCountPrevious
        );
        //前日の日付を保存
        const now = new Date();
        const yesterday = new Date(now.getTime() - 86400000);

        context.workspaceState.update("totalCountPreviousDate", yesterday);
      } else {
        const storedTotalCount =
          context.workspaceState.get("totalCountPrevious");
        this.totalCountPrevious =
          typeof storedTotalCount == "number"
            ? storedTotalCount
            : this.totalCountPrevious;

        const storedTotalCountDate = context.workspaceState.get(
          "totalCountPreviousDate"
        );
        console.log(storedTotalCountDate, typeof storedTotalCountDate);
        this.totalCountPreviousDate =
          typeof storedTotalCountDate == "string"
            ? new Date(storedTotalCountDate)
            : new Date(new Date());
        console.log("ステータス日", storedTotalCountDate);
      }
    }
  }

  public updateCharacterCount(): void {
    if (!this._statusBarItem) {
      this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    }
    const editor = window.activeTextEditor;
    if (!editor) {
      this._statusBarItem.hide();
      return;
    }
    if (
      editor.document.languageId != "novel" &&
      editor.document.languageId != "markdown" &&
      editor.document.languageId != "plaintext"
    ) {
      this._statusBarItem.hide();
      return;
    }

    const doc = editor.document;
    const docPath: string = editor.document.uri.fsPath.normalize();
    const characterCountNum = this._getCharacterCount(doc);
    const characterCount = Intl.NumberFormat().format(characterCountNum);
    const countingTarget = Intl.NumberFormat().format(this._countingTargetNum);

    let savedCharacterCountNum = 0;

    // path.relative関数でbasePathからsubPathの相対パスを取得
    const relativePath = path.relative(draftRoot(), docPath);

    if (draftRoot() == "") {
      //テキストファイルを直接開いているとき
      this._statusBarItem.text = `$(note) ${Intl.NumberFormat().format(
        this._getCharacterCount(doc)
      )} 文字`;
    } else if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      // 相対パスが'.'で始まっていない場合、subPathはbasePathに含まれる

      savedCharacterCountNum = characterCountNum;
    } else {
      savedCharacterCountNum = this._lengthByPath(docPath);
    }

    // 合計の計算
    // activeファイルが原稿フォルダにあるかどうか
    const ifActiveDocInDraft = ifFileInDraft(window.activeTextEditor?.document.uri.fsPath);
    const totalCharacterCountNum = ifActiveDocInDraft
      ? projectCharacterCountNum - savedCharacterCountNum
      : projectCharacterCountNum;
    const totalCharacterCount = ifActiveDocInDraft
      ? Intl.NumberFormat().format(totalCharacterCountNum + characterCountNum)
      : Intl.NumberFormat().format(totalCharacterCountNum);

    let editDistance = "";
    let writingProgressString = "";
    if (this.ifEditDistance) {
      // 増減分のプラス記号、±記号を定義
      let progressIndex = this.writingProgress > 0 ? "+" : "";
      progressIndex = this.writingProgress == 0 ? "±" : progressIndex;

      // 増減分のテキストを定義
      writingProgressString =
        "(" +
        progressIndex +
        Intl.NumberFormat().format(this.writingProgress) +
        ")";
      if (this.editDistance == -1) {
        editDistance = `／$(compare-changes)$(sync)文字`;
        this._updateEditDistanceDelay();
      } else if (this.keyPressFlag) {
        editDistance = `／$(compare-changes)${Intl.NumberFormat().format(
          this.editDistance
        )}$(sync)文字`;
      } else {
        editDistance = `／$(compare-changes)${Intl.NumberFormat().format(
          this.editDistance
        )}文字`;
      }
    }

    // 執筆日またぎ処理
    const launchDay = this.totalCountPreviousDate.getDate();
    const today = new Date().getDate();
    console.log(this.totalCountPreviousDate, launchDay, today);
    if (launchDay != today) {
      console.log("日跨ぎ発生！", launchDay, today);
      this.workspaceState?.update("totalCountPrevious", totalCharacterCountNum);
      this.workspaceState?.update("totalCountPreviousDate", new Date());
      this.writingDate = new Date();
      this.totalCountPreviousDate = this.writingDate;
      this.totalCountPrevious = totalCharacterCountNum;
    }

    // 総量：増減分のプラス記号、±記号を定義
    let totalWritingProgressString = "";
    this.totalWritingProgress = ifActiveDocInDraft
      ? totalCharacterCountNum + characterCountNum - this.totalCountPrevious
      : totalCharacterCountNum - this.totalCountPrevious;
    let progressTotalIndex = this.totalWritingProgress > 0 ? "+" : "";
    progressTotalIndex =
      this.totalWritingProgress == 0 ? "±" : progressTotalIndex;

    // 増減分のテキストを定義
    totalWritingProgressString =
      "(" +
      progressTotalIndex +
      Intl.NumberFormat().format(this.totalWritingProgress) +
      ")";

    if (this._countingFolder != "") {
      //締め切りフォルダーが設定されている時_countingTargetNum
      let targetNumberTextNum = this._folderCount.amountLengthNum;
      let targetNumberText = Intl.NumberFormat().format(targetNumberTextNum);
      if (this._isEditorChildOfTargetFolder) {
        targetNumberTextNum =
          targetNumberTextNum - savedCharacterCountNum + characterCountNum;
        targetNumberText = Intl.NumberFormat().format(targetNumberTextNum);
      }
      if (this._countingTargetNum != 0) {
        targetNumberText += "/" + countingTarget;
      }
      this._statusBarItem.text = ` ${totalCharacterCount}${totalWritingProgressString}文字  $(folder-opened) ${this._folderCount.label} ${targetNumberText}文字  $(note) ${characterCount}${writingProgressString} 文字 ${editDistance}`;
    } else {
      this._statusBarItem.text = `$(book) ${totalCharacterCount}${totalWritingProgressString}文字／$(note) ${characterCount} ${writingProgressString}文字${editDistance}`;
    }
    this._statusBarItem.show();
  }

  public _getCharacterCount(doc: TextDocument): number {
    let docContent = doc.getText();
    // カウントに含めない文字を削除する
    docContent = docContent
      .replace(/\s/g, "") // すべての空白文字
      .replace(/《(.+?)》/g, "") // ルビ範囲指定記号とその中の文字
      .replace(/[|｜]/g, "") // ルビ開始記号
      .replace(/<!--(.+?)-->/, ""); // コメントアウト
    let characterCount = 0;
    if (docContent !== "") {
      characterCount = docContent.length;
    }
    return characterCount;
  }

  public _updateProjectCharacterCount(): void {
    projectCharacterCountNum = totalLength(draftRoot());
    if (this._countingFolder != "") {
      //締め切りフォルダーの更新
      this._folderCount = {
        label: path.basename(this._countingFolder),
        amountLengthNum: totalLength(this._countingFolder),
      };
    }
    this.updateCharacterCount();
  }

  public _setCounterToFolder(
    pathToFolder: string,
    targetCharacter: number
  ): void {
    if (!fs.existsSync(pathToFolder)) {
      this._countingFolder = "";
      this._countingTargetNum = 0;
      countingFolderPath = "";
      this._updateProjectCharacterCount();
      this._setIfChildOfTarget();
      return;
    }
    countingFolderPath = pathToFolder;
    countingTarget = Intl.NumberFormat().format(targetCharacter);
    this._countingFolder = pathToFolder;
    this._countingTargetNum = targetCharacter;
    this._updateProjectCharacterCount();
    this._setIfChildOfTarget();
  }

  private _lengthByPath(dirPath: string): number {
    // パスを正規化する
    dirPath = dirPath.normalize("NFC"); // NFCに正規化
    if (draftRoot() == "") {
      return 0;
    }
    const tree = new TreeModel();
    const draftTree = tree.parse({ dir: draftRoot(), name: "root", length: 0 });

    draftsObject(draftRoot()).forEach((element) => {
      const draftNode = tree.parse(element);
      draftTree.addChild(draftNode);
    });
    const targetFileNode = draftTree.first(
      // {strategy: 'breadth'},
      function (node) {
        // return node.model.dir === dirPath;
        return node.model.dir.normalize("NFC") === dirPath;
      }
    );
    // (node) => node.model.dir === dirPath
    // );

    if (targetFileNode) {
      return targetFileNode.model.length;
    } else {
      return 0;
    }
  }

  // private _ifFileInDraft(): boolean {
  //   if (draftRoot() == "") {
  //     return false;
  //   }
  //   //Treeモデル構築
  //   const tree = new TreeModel();
  //   const draftTree = tree.parse({ dir: draftRoot(), name: "root", length: 0 });
  //   const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;
  //   draftsObject(draftRoot()).forEach((element) => {
  //     const draftNode = tree.parse(element);
  //     draftTree.addChild(draftNode);
  //   });
  //   const activeDocumentObject = draftTree.first(
  //     (node) => node.model.dir === activeDocumentPath
  //   );
  //   return activeDocumentObject ? true : false;
  // }

  public _setIfChildOfTarget(): boolean {
    if (draftRoot() == "") {
      return false;
    }
    const tree = new TreeModel();
    const draftTree = tree.parse({ dir: draftRoot(), name: "root", length: 0 });
    const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;

    draftsObject(draftRoot()).forEach((element) => {
      const draftNode = tree.parse(element);
      draftTree.addChild(draftNode);
    });
    const deadLineFolderNode = draftTree.first(
      (node) => node.model.dir === this._countingFolder
    );

    if (deadLineFolderNode?.hasChildren) {
      const treeForTarget = new TreeModel();
      const targetTree = treeForTarget.parse(deadLineFolderNode.model);

      const ifEditorIsChild = targetTree.first(
        (node) => node.model.dir === activeDocumentPath
      );
      if (ifEditorIsChild) {
        this._isEditorChildOfTargetFolder = true;
        return true;
      }
    }

    this._isEditorChildOfTargetFolder = false;

    return false;
  }

  public _updateCountingObject(): boolean {
    //this._countingObject = draftsObject(draftRoot());
    return true;
  }

  public editDistance = -1;
  public writingProgress = 0;
  public latestText: null | string = null;
  private projectPath = "";
  public ifEditDistance = false;

  public async _setEditDistance(): Promise<void> {
    if (workspace.workspaceFolders == undefined) {
      return;
    }
    const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;
    if (typeof activeDocumentPath != "string") return;
    this.projectPath = workspace.workspaceFolders[0].uri.fsPath;
    const relatevePath = path
      .relative(this.projectPath, activeDocumentPath)
      .replace(new RegExp("\\" + path.sep, "g"), "/");
    const git: SimpleGit = simpleGit(this.projectPath);

    const isRepo = await git.checkIsRepo();
    if (isRepo) {
      git
        .revparse("--is-inside-work-tree")
        .then(() => {
          let latestHash = "";
          const logOption = {
            file: relatevePath,
            "--until": "today00:00:00",
            n: 1,
          };
          let showString = "";
          git
            .log(logOption)
            .then((logs) => {
              //console.log(logs);
              if (logs.total === 0) {
                //昨日以前のコミットがなかった場合、当日中に作られた最古のコミットを比較対象に設定する。
                const logOptionLatest = {
                  file: relatevePath,
                  "--reverse": null,
                  "--max-count": "10",
                };
                git
                  .log(logOptionLatest)
                  .then((logsLatest) => {
                    if (logsLatest?.total === 0) {
                      window.showInformationMessage(
                        `このファイルはまだコミットされていないようです`
                      );
                      this.ifEditDistance = false;
                      this.latestText = null;
                      this.updateCharacterCount();
                    } else {
                      latestHash = logsLatest.all[0].hash;
                      showString = latestHash + ":" + relatevePath;
                      console.log("最終更新: ", showString);
                      git
                        .show(showString)
                        .then((showLog) => {
                          console.log(
                            "最終更新テキスト: ",
                            typeof showLog,
                            showLog
                          );
                          if (typeof showLog === "string") {
                            if (showLog == "") showLog = " ";
                            this.latestText = showLog;
                            this.ifEditDistance = true;
                            this.updateCharacterCount();
                          }
                        })
                        .catch((err) =>
                          console.error("failed to git show:", err)
                        );
                    }
                  })
                  .catch((err) => console.error("failed to git show:", err));
              } else {
                latestHash = logs.all[0].hash;
                showString = latestHash + ":" + relatevePath;
                //console.log('showString: ',showString);
                git
                  .show(showString)
                  .then((showLog) => {
                    if (typeof showLog === "string") {
                      this.latestText = showLog;
                      this.ifEditDistance = true;
                      this.updateCharacterCount();
                    }
                  })
                  .catch((err) => console.error("failed to git show:", err));
              }
            })
            .catch((err) => {
              console.error("failed:", err);
              this.ifEditDistance = false;
              this.latestText = null;
              this.updateCharacterCount();
            });
        })
        .catch((err) => {
          console.error("git.revparse:", err);
        });
    }
  }

  public _setLatestUpdate(latestGitText: string): void {
    this.latestText = latestGitText;
    console.log("latest from Git:", latestGitText);
    this._updateEditDistanceDelay();
  }

  private keyPressFlag = false;

  public _resetWritingProtgress(): void {
    this.totalCountPrevious = totalLength(draftRoot());
    this.workspaceState?.update("totalCountPrevious", this.totalCountPrevious);
    this.workspaceState?.update("totalCountPreviousDate", new Date());
    this.updateCharacterCount();
    vscode.window.showInformationMessage(`今日の総合進捗をリセットしました`);
  }

  public _updateEditDistanceActual(): void {
    const currentText = window.activeTextEditor?.document.getText();

    if (this.latestText != null && typeof currentText == "string") {
      this.editDistance = distance(this.latestText, currentText);
      this.writingProgress = currentText.length - this.latestText.length;
      this.keyPressFlag = false;
      this.updateCharacterCount();
    }

    delete this.timeoutID;
  }

  public _updateEditDistanceDelay(): void {
    if (!this.keyPressFlag && window.activeTextEditor) {
      this.keyPressFlag = true;
      const updateCounter = Math.min(
        Math.ceil(window.activeTextEditor.document.getText().length / 100),
        500
      );
      //console.log('timeoutID', this.timeoutID, updateCounter);
      this.timeoutID = setTimeout(() => {
        this._updateEditDistanceActual();
      }, updateCounter);
    }
  }

  public _timerCancel(): void {
    if (typeof this.timeoutID == "number") {
      this.clearTimeout(this.timeoutID);
      delete this.timeoutID;
    }
  }

  clearTimeout(timeoutID: number): void {
    throw new Error("Method not implemented." + timeoutID);
  }

  public dispose(): void {
    this._statusBarItem.dispose();
  }
}

export class CharacterCounterController {
  private _characterCounter: CharacterCounter;
  private _disposable: Disposable;

  constructor(characterCounter: CharacterCounter) {
    this._characterCounter = characterCounter;
    this._characterCounter._setEditDistance();
    this._characterCounter.updateCharacterCount();

    const subscriptions: Disposable[] = [];
    window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
    workspace.onDidSaveTextDocument(this._onSave, this, subscriptions);
    window.onDidChangeActiveTextEditor(
      this._onFocusChanged,
      this,
      subscriptions
    );

    this._disposable = Disposable.from(...subscriptions);
  }

  private _onEvent() {
    this._characterCounter.updateCharacterCount();
    if (this._characterCounter.ifEditDistance) {
      console.log("TEST");
      this._characterCounter._updateEditDistanceDelay();
    }
  }

  private _onFocusChanged() {
    this._characterCounter._setIfChildOfTarget();
    //編集処理の初期化
    this._characterCounter.ifEditDistance = false;
    this._characterCounter.latestText = "\n";
    this._characterCounter.editDistance = -1;
    this._characterCounter._setEditDistance();
    this._characterCounter._updateCountingObject();
  }

  private _onSave() {
    this._characterCounter._updateCountingObject();
    this._characterCounter._updateProjectCharacterCount();
  }

  public dispose(): void {
    this._disposable.dispose();
  }
}
