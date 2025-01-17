//Original code is published by 8amjp/vsce-charactercount] https://github.com/8amjp/vsce-charactercount under MIT

"use strict";
import * as path from "path";
import * as fs from "fs";
import { draftsObject, ifFileInDraft, resetCounter } from "./compile";
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
import { getConfig } from "./config";
import { get } from "http";

let projectDraftLengthObj = {lengthInNumber: 0, lengthInSheet: 0};
let countingFolderPath = "";
let countingTarget = "";

if (draftRoot() != "") {
  projectDraftLengthObj.lengthInNumber = totalLength(draftRoot()).lengthInNumber;
  projectDraftLengthObj.lengthInSheet = totalLength(draftRoot()).lengthInSheet;
  console.log('プロジェクト総文字数',projectDraftLengthObj);
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
    const docPath: string = editor.document.uri.fsPath.normalize();
    const characterCountNum = this._getCharacterCount(doc).lengthInNumber;
    const characterCount = Intl.NumberFormat().format(characterCountNum);
    const countingTarget = Intl.NumberFormat().format(this._countingTargetNum);

    let savedCharacterCountNum = 0;
    
    // path.relative関数でbasePathからsubPathの相対パスを取得
    const relativePath = path.relative(draftRoot(), docPath);
    if (!draftRoot()) {
    } else if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      // 相対パスが'.'で始まっていない場合、subPathはbasePathに含まれる
      savedCharacterCountNum = characterCountNum;
    } else {
      savedCharacterCountNum = this._lengthByPath(docPath).lengthInNumber;
      console.log("合計文字数",savedCharacterCountNum);
    }
    
    // 合計の計算
    // activeファイルが原稿フォルダにあるかどうか
    const ifActiveDocInDraft = ifFileInDraft(
      window.activeTextEditor?.document.uri.fsPath,
    );
    const totalCharacterCountNum = ifActiveDocInDraft
      ? projectDraftLengthObj.lengthInNumber - savedCharacterCountNum
      : projectDraftLengthObj.lengthInNumber;
    const totalCharacterCount = ifActiveDocInDraft
      ? Intl.NumberFormat().format(totalCharacterCountNum + characterCountNum)
      : Intl.NumberFormat().format(totalCharacterCountNum);

    let editDistance = "";
    let writingProgressString = "";
    //  MARK: 出力部分
    if (this.ifEditDistance) {
      // 増減分のプラス記号、±記号を定義
      let progressIndex = this.writingProgress > 0 ? "+" : "";
      progressIndex = this.writingProgress == 0 ? "±" : progressIndex;

      // 増減分のテキストを定義
      writingProgressString =
        " 進捗" +
        progressIndex +
        Intl.NumberFormat().format(this.writingProgress) +
        "文字";
      if (this.editDistance == -1) {
        editDistance = `／$(compare-changes)$(sync)文字`;
        this._updateEditDistanceDelay();
      } else if (this.keyPressFlag) {
        editDistance = `／$(compare-changes)${Intl.NumberFormat().format(
          this.editDistance,
        )}$(sync)文字`;
      } else {
        editDistance = `／$(compare-changes)${Intl.NumberFormat().format(
          this.editDistance,
        )}文字`;
      }
    }

    // 執筆日またぎ処理
    const launchDay = this.totalCountPreviousDate.getDate();
    const today = new Date().getDate();
    // console.log(this.totalCountPreviousDate, launchDay, today);
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
    if (getConfig().displayProgress) {
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
    }

    // 数字表示
    const activeDocLengthInNumberStr = `${Intl.NumberFormat().format(
      this._getCharacterCount(doc).lengthInNumber,
    )}文字${writingProgressString}`;

    // 原稿用紙表示
    const numberOfSheet = Math.floor(
      this._getCharacterCount(doc).lengthInSheet,
    );
    const numberOfModLines =
      (this._getCharacterCount(doc).lengthInSheet - numberOfSheet) * 20;
    const activeDocLengthInSheetStr = `${Intl.NumberFormat().format(
      numberOfSheet,
    )}枚`;
    // 追加行
    const activeDocLengthInSheetAddLinesStr =
      numberOfModLines > 0
        ? `${Intl.NumberFormat().format(numberOfModLines)}行`
        : "";

    const activeDocLengthStr =
      getConfig().styleOfProgress === "数字"
        ? "$(note)" + activeDocLengthInNumberStr
        : "$(note)" + activeDocLengthInSheetStr +
          activeDocLengthInSheetAddLinesStr + writingProgressString;

    if (draftRoot() == "") {
      console.log(
        "ファイル直接",
        getConfig().styleOfProgress,
        getConfig().styleOfProgress != "数字",
        activeDocLengthStr,
      );
      //テキストファイルを直接開いているときの出力
      this._statusBarItem.text = activeDocLengthStr;
    } else if (this._countingFolder != "") {
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
      this._statusBarItem.text = ` ${totalCharacterCount}${totalWritingProgressString}文字  $(folder-opened) ${this._folderCount.label} ${targetNumberText}文字／${activeDocLengthStr}${editDistance}`;
    } else {
      this._statusBarItem.text = `$(book) ${totalCharacterCount}${totalWritingProgressString}文字／${activeDocLengthStr}${editDistance}`;
    }
    this._statusBarItem.show();
  }

  // MARK: アクティブ文字数取得
  public _getCharacterCount(doc: TextDocument): {
    lengthInNumber: number;
    lengthInSheet: number;
  } {
    let docContent = doc.getText();
    // カウントに含めない文字を削除する
    docContent = docContent
      .replace(/[ \t\r\f\v]/g, "") // 改行以外の空白文字
      .replace(/《(.+?)》/g, "") // ルビ範囲指定記号とその中の文字
      .replace(/[|｜]/g, "") // ルビ開始記号
      .replace(/<!--(.+?)-->/, ""); // コメントアウト
    let characterCount = 0;
    let sheetCount = 0;
    if (docContent !== "") {
      characterCount = docContent.replace(/\s/g, "").length;
      const paragraphs = docContent.split(/\r\n|\r|\n/);

      // 各段落の行数を計算して合算
      let lineCount = 0;
      const lineLength = 20;
      for (const [index, paragraph] of paragraphs.entries()) {
        const paragraphLength = paragraph.length;
        if (paragraphLength === 0 && index < paragraphs.length - 1) {
          lineCount += 1;
        } else {
          lineCount += Math.ceil(paragraphLength / lineLength);
        }
      }
      // 行数から原稿用紙の枚数を計算 (1枚あたり20行)
      sheetCount = lineCount / 20;
      // console.log("段落数", paragraphs.length, sheetCount);
    }
    return { lengthInNumber: characterCount, lengthInSheet: sheetCount };
  }

  public _updateProjectCharacterCount(): void {
    projectDraftLengthObj.lengthInNumber = totalLength(draftRoot()).lengthInNumber;
    projectDraftLengthObj.lengthInSheet = totalLength(draftRoot()).lengthInSheet;
    if (this._countingFolder != "") {
      //締め切りフォルダーの更新
      this._folderCount = {
        label: path.basename(this._countingFolder),
        amountLengthNum: totalLength(this._countingFolder).lengthInNumber,
      };
    }
    this.updateCharacterCount();
  }

  public _setCounterToFolder(
    pathToFolder: string,
    targetCharacter: number,
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

  private _lengthByPath(dirPath: string): {lengthInNumber: number, lengthInSheet: number} {
    // パスを正規化する
    dirPath = dirPath.normalize("NFC"); // NFCに正規化
    if (draftRoot() == "") {
      return {lengthInNumber: 0, lengthInSheet: 0};
    }
    const tree = new TreeModel();
    const draftTree = tree.parse({ dir: draftRoot(), name: "root", length: {lengthInNumber:0, lengthInSheet: 0} });

    resetCounter();
    draftsObject(draftRoot()).forEach((element) => {
      const draftNode = tree.parse(element);
      draftTree.addChild(draftNode);
      console.log(element);
    });
    const targetFileNode = draftTree.first(
      function (node) {
        return node.model.dir.normalize("NFC") === dirPath;
      },
    );


    if (targetFileNode) {
      return targetFileNode.model.length;
    } else {
      return {lengthInNumber: 0, lengthInSheet: 0};
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
