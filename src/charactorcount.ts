//Original code is published by 8amjp/vsce-charactercount] https://github.com/8amjp/vsce-charactercount under MIT

"use strict";
import * as path from "path";
import * as fs from "fs";
import {
  draftsObject,
  ifFileInDraft,
  resetCounter,
  totalLength,
  draftRoot,
  getLength,
} from "./compile";
import TreeModel from "tree-model";

import {
  window,
  Disposable,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  workspace,
} from "vscode";
import * as vscode from "vscode";

import simpleGit, { SimpleGit } from "simple-git";
import { distance } from "fastest-levenshtein";
import { getConfig } from "./config";
import { get } from "http";
import { escape } from "querystring";

import { count } from "console";

let projectDraftLengthObj = { lengthInNumber: 0, lengthInSheet: 0 };
let countingFolderPath = "";
let countingTarget = "";

if (draftRoot() != "") {
  projectDraftLengthObj.lengthInNumber =
    totalLength(draftRoot()).lengthInNumber;
  projectDraftLengthObj.lengthInSheet = totalLength(draftRoot()).lengthInSheet;
  console.log("プロジェクト総文字数", projectDraftLengthObj);
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
  private _countingTarget = "";
  private _folderCount = {
    label: "",
    amountLength: { lengthInNumber: 0, lengthInSheet: 0 },
  };
  public totalCountPrevious = totalLength(draftRoot()).lengthInNumber;
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
      this.totalCountPrevious = totalLength(draftRoot()).lengthInNumber;
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
          this.totalCountPrevious,
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
          "totalCountPreviousDate",
        );
        // console.log(storedTotalCountDate, typeof storedTotalCountDate);
        this.totalCountPreviousDate =
          typeof storedTotalCountDate == "string"
            ? new Date(storedTotalCountDate)
            : new Date(new Date());
        // console.log("ステータス日", storedTotalCountDate);
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
    const docLength = getLength(doc.getText());
    const docPath: string = editor.document.uri.fsPath.normalize();
    const activeCount = docLength.lengthInNumber;
    const activeheetCount = docLength.lengthInSheet;
    const countingTarget = this._countingTarget;

    let savedCount = 0;
    let savedSheetCount = 0;

    // path.relative関数でbasePathからsubPathの相対パスを取得
    const relativePath = path.relative(draftRoot(), docPath);
    if (!draftRoot()) {
      // プロジェクトフォルダが設定されていない場合
      // 何も行わない
    } else if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      // 相対パスが'.'で始まっていない場合、プロジェクト外部のファイルだとみなします
      savedCount = activeCount;
      savedSheetCount = activeheetCount;
    } else {
      // プロジェクト内部のファイルの場合
      const lengthOfFile = this._lengthByPath(docPath);
      savedCount = lengthOfFile.lengthInNumber;
      savedSheetCount = lengthOfFile.lengthInSheet;
    }

    // 合計の計算
    // activeファイルが原稿フォルダにあるかどうか
    const ifActiveDocInDraft = ifFileInDraft(
      window.activeTextEditor?.document.uri.fsPath,
    );

    // 総数の計算 アクティブドキュメントを開いているときは、保存された文字数を引く
    const totalCount = ifActiveDocInDraft
      ? projectDraftLengthObj.lengthInNumber - savedCount + activeCount
      : projectDraftLengthObj.lengthInNumber;
    const totalSheetCount = ifActiveDocInDraft
      ? projectDraftLengthObj.lengthInSheet - savedSheetCount + activeheetCount
      : projectDraftLengthObj.lengthInSheet;

    let editDistance = "";
    let writingProgressString = "";
    //  MARK: 出力部分
    if (this.ifEditDistance && getConfig().displayEditDistance) {
      // 増減分のプラス記号、±記号を定義
      let progressIndex = this.writingProgress > 0 ? "+" : "";
      progressIndex = this.writingProgress == 0 ? "±" : progressIndex;

      // 増減分のテキストを定義
      if (getConfig().displayProgress) {
        writingProgressString =
          " 進捗" +
          progressIndex +
          Intl.NumberFormat().format(this.writingProgress) +
          "文字";
      }
      if (this.editDistance == -1) {
        editDistance = ` $(compare-changes)$(sync)文字`;
        this._updateEditDistanceDelay();
      } else if (this.keyPressFlag) {
        editDistance = ` $(compare-changes)${Intl.NumberFormat().format(
          this.editDistance,
        )}$(sync)文字`;
      } else {
        editDistance = ` $(compare-changes)${Intl.NumberFormat().format(
          this.editDistance,
        )}文字`;
      }
    }

    // MARK: 進捗

    let totalWritingProgressString = "";
    if (getConfig().displayProgress) {
      // 執筆日またぎ処理
      const launchDay = this.totalCountPreviousDate.getDate();
      const today = new Date().getDate();
      if (launchDay != today) {
        console.log("日跨ぎ発生！", launchDay, today);
        this.workspaceState?.update("totalCountPrevious", totalCount);
        this.workspaceState?.update("totalCountPreviousDate", new Date());
        this.writingDate = new Date();
        this.totalCountPreviousDate = this.writingDate;
        this.totalCountPrevious = totalCount;
      }

      this.totalWritingProgress = totalCount - this.totalCountPrevious;
      console.log(
        "進捗デバッグ",
        totalCount,
        activeCount,
        this.totalCountPrevious,
      );
      // 総量：増減分のプラス記号、±記号を定義
      let progressTotalIndex = this.totalWritingProgress > 0 ? "+" : "";
      progressTotalIndex =
        this.totalWritingProgress == 0 ? "±" : progressTotalIndex;

      // 増減分のテキストを定義
      totalWritingProgressString =
        " 進捗" +
        progressTotalIndex +
        Intl.NumberFormat().format(this.totalWritingProgress) +
        "文字";
    }

    // 数字表示
    const activeDocLengthInNumberStr = `${Intl.NumberFormat().format(
      getLength(doc.getText()).lengthInNumber,
    )}文字${writingProgressString}`;

    // 原稿用紙表示
    const numberOfSheetFloat = getLength(doc.getText()).lengthInSheet;
    const activeDocLengthInSheetStr = formatSheetsAndLines(numberOfSheetFloat);

    let targetNumberStr = "";

    if (this._countingFolder != "") {
      //締め切りフォルダーが設定されている時
      const isDeadLineInNumber = this._countingTarget.includes(".")
        ? false
        : true;
      let targetNumber = isDeadLineInNumber
        ? this._folderCount.amountLength.lengthInNumber
        : this._folderCount.amountLength.lengthInSheet;

      targetNumberStr = isDeadLineInNumber
      ? Intl.NumberFormat().format(parseInt(countingTarget)) + "文字" + "中"
      : formatSheetsAndLines(parseFloat(countingTarget)) + "中";

      if (this._isEditorChildOfTargetFolder) {
        targetNumber = targetNumber - savedCount + activeCount;
      }
      targetNumberStr += isDeadLineInNumber
        ? Intl.NumberFormat().format(targetNumber) + "文字"
        : formatSheetsAndLines(targetNumber);
      
      targetNumberStr = ` $(folder-opened)${this._folderCount.label} ${targetNumberStr}`;
    }

    const totalCountStr = Intl.NumberFormat().format(totalCount) + "文字";
    const totalSheetCountStr = formatSheetsAndLines(totalSheetCount);
    const activeCountStr =
      "$(novel-file-v)" + Intl.NumberFormat().format(activeCount) + "文字";
    const activeCountSheetStr = formatSheetsAndLines(activeheetCount);

    if (draftRoot() == "") {
      //テキストファイルを直接開いているときの出力
      this._statusBarItem.text =
        activeDocLengthInNumberStr + activeDocLengthInSheetStr;
    }

    this._statusBarItem.text = statusBarItem();
    this._statusBarItem.show();

    function statusBarItem(): string {
      let statusBarText = "";
      if (draftRoot() == "") {
        //テキストファイルを直接開いているときの出力
        return (
          "$(file-text)" +
          activeDocLengthInNumberStr +
          activeDocLengthInSheetStr
        );
      }

      // 合計テキストの追加
      let statusBarItemText = "$(folder-library)";
      const showNumber = getConfig().displayCountOfNumber;
      const showSheet = getConfig().displayCountOfSheet;
      const showProgress = getConfig().displayProgress;
      if (getConfig().displayCountOfSheet) {
        statusBarItemText +=
          totalSheetCountStr + (showNumber ? `(${totalCountStr})` : "");
      } else {
        statusBarItemText += totalCountStr;
      }
      statusBarItemText += totalWritingProgressString;

      // 締切フォルダーテキストの追加
      statusBarItemText += targetNumberStr;

      // アクティブテキストの追加
      if (getConfig().displayCountOfSheet) {
        statusBarItemText +=
          " $(file-text)" +
          activeCountSheetStr +
          (showNumber ? `(${activeCountStr})` : "");
      } else {
        statusBarItemText += " $(file-text)" + activeCountStr;
      }
      statusBarItemText += writingProgressString;

      // 編集距離の追加
      statusBarItemText += editDistance;

      return statusBarItemText;
    }
  }

  // MARK: アクティブ文字数取得
  public _getCharacterCount(doc: TextDocument): {
    lengthInNumber: number;
    lengthInSheet: number;
  } {
    return getLength(doc.getText());
  }

  public _updateProjectCharacterCount(): void {
    projectDraftLengthObj.lengthInNumber =
      totalLength(draftRoot()).lengthInNumber;
    projectDraftLengthObj.lengthInSheet =
      totalLength(draftRoot()).lengthInSheet;
    if (this._countingFolder != "") {
      //締め切りフォルダーの更新
      this._folderCount = {
        label: path.basename(this._countingFolder),
        amountLength: {
          lengthInNumber: totalLength(this._countingFolder).lengthInNumber,
          lengthInSheet: totalLength(this._countingFolder).lengthInSheet,
        },
      };
    }
    this.updateCharacterCount();
  }

  public _setCounterToFolder(
    pathToFolder: string,
    targetCharacter: string,
  ): void {
    if (!fs.existsSync(pathToFolder)) {
      this._countingFolder = "";
      this._countingTarget = "";
      countingFolderPath = "";
      this._updateProjectCharacterCount();
      this._setIfChildOfTarget();
      return;
    }
    countingFolderPath = pathToFolder;
    countingTarget = targetCharacter;
    this._countingFolder = pathToFolder;
    this._countingTarget = targetCharacter;
    this._updateProjectCharacterCount();
    this._setIfChildOfTarget();
  }

  private _lengthByPath(dirPath: string): {
    lengthInNumber: number;
    lengthInSheet: number;
  } {
    // パスを正規化する
    dirPath = dirPath.normalize("NFC"); // NFCに正規化
    if (draftRoot() == "") {
      return { lengthInNumber: 0, lengthInSheet: 0 };
    }
    const tree = new TreeModel();
    const draftTree = tree.parse({
      dir: draftRoot(),
      name: "root",
      length: { lengthInNumber: 0, lengthInSheet: 0 },
    });

    resetCounter();
    draftsObject(draftRoot()).forEach((element) => {
      const draftNode = tree.parse(element);
      draftTree.addChild(draftNode);
    });
    const targetFileNode = draftTree.first(function (node) {
      return node.model.dir.normalize("NFC") === dirPath;
    });

    if (targetFileNode) {
      return targetFileNode.model.length;
    } else {
      return { lengthInNumber: 0, lengthInSheet: 0 };
    }
  }

  public _setIfChildOfTarget(): boolean {
    if (draftRoot() == "") {
      return false;
    }
    const tree = new TreeModel();
    const draftTree = tree.parse({ dir: draftRoot(), name: "root", length: 0 });
    const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;

    resetCounter();
    draftsObject(draftRoot()).forEach((element) => {
      const draftNode = tree.parse(element);
      draftTree.addChild(draftNode);
    });
    const deadLineFolderNode = draftTree.first(
      (node) => node.model.dir === this._countingFolder,
    );

    if (deadLineFolderNode?.hasChildren) {
      const treeForTarget = new TreeModel();
      const targetTree = treeForTarget.parse(deadLineFolderNode.model);

      const ifEditorIsChild = targetTree.first(
        (node) => node.model.dir === activeDocumentPath,
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
    return true;
  }

  public editDistance = -1;
  public writingProgress = 0;
  public latestText: null | string = null;
  private projectPath = "";
  public ifEditDistance = false;
  public isEditDistanceInCalc = false;

  public async _setEditDistance(): Promise<void> {
    const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;
    if (
      workspace.workspaceFolders == undefined ||
      !ifFileInDraft(activeDocumentPath) ||
      getConfig().displayEditDistance == false
    ) {
      return;
    }
    if (typeof activeDocumentPath != "string") return;
    this.projectPath = workspace.workspaceFolders[0].uri.fsPath;
    const relatevePath = path
      .relative(this.projectPath, activeDocumentPath)
      .replace(new RegExp("\\" + path.sep, "g"), "/");
    const git: SimpleGit = simpleGit(this.projectPath);

    const isRepo = await git.checkIsRepo();
    if (isRepo) {
      await git
        .revparse("--is-inside-work-tree")
        .then(async () => {
          let latestHash = "";
          const logOption = {
            file: relatevePath,
            "--until": "today00:00:00",
            n: 1,
          };
          let showString = "";
          await git
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
                        `このファイルはまだコミットされていないようです`,
                      );
                      this.ifEditDistance = false;
                      this.latestText = null;
                      this.updateCharacterCount();
                    } else {
                      latestHash = logsLatest.all[0].hash;
                      showString = latestHash + ":" + relatevePath;
                      git
                        .show(showString)
                        .then((showLog) => {
                          if (typeof showLog === "string") {
                            if (showLog == "") showLog = " ";
                            this.latestText = showLog;
                            this.ifEditDistance = true;
                            this.updateCharacterCount();
                          }
                        })
                        .catch((err) =>
                          console.error("failed to git show:", err),
                        );
                    }
                  })
                  .catch((err) => console.error("failed to git show:", err));
              } else {
                latestHash = logs.all[0].hash;
                showString = latestHash + ":" + relatevePath;
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
    this.totalCountPrevious = totalLength(draftRoot()).lengthInNumber;
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
      this.isEditDistanceInCalc = false;
      this.updateCharacterCount();
    }

    delete this.timeoutID;
  }

  public _updateEditDistanceDelay(): void {
    if (!this.keyPressFlag && window.activeTextEditor) {
      this.isEditDistanceInCalc = true;
      this.keyPressFlag = true;
      const updateCounter = Math.min(
        Math.ceil(window.activeTextEditor.document.getText().length / 100),
        500,
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

export function formatSheetsAndLines(sheetFloat: number): string {
  if (sheetFloat == 0) {
    return "0枚0行";
  }
  const sheetInt = Math.floor(sheetFloat);
  const modLines = (sheetFloat - sheetInt) * 20;

  // 行が0でない時だけsheetIntを増やす
  const sheetsStr = `${Intl.NumberFormat().format(sheetInt + (modLines > 0 ? 1 : 0))}枚`;

  // 行の出力は20行から0行に変更
  const linesStr =
    modLines > 0 ? `${Intl.NumberFormat().format(modLines)}行` : "20行";

  return `${sheetsStr}${linesStr ? `${linesStr}` : ""}`;
}

// MARK: コントローラー
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
      subscriptions,
    );

    this._disposable = Disposable.from(...subscriptions);
  }

  private _onEvent() {
    this._characterCounter.updateCharacterCount();
    if (
      this._characterCounter.ifEditDistance &&
      !this._characterCounter.isEditDistanceInCalc
    ) {
      console.log(`Git読んだ直後：${this._characterCounter.ifEditDistance}`);
      this._characterCounter._updateEditDistanceDelay();
    }
  }

  private _onFocusChanged() {
    this._characterCounter._setIfChildOfTarget();
    //編集距離の初期化
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
