import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "./config";
import { deadLineFolderPath } from "./extension";
import TreeModel from "tree-model";

//fsモジュールの使い方 https://qiita.com/oblivion/items/2725a4b3ca3a99f8d1a3
export default function compileDocs(): void {
  const projectName =
    deadLineFolderPath() == ""
      ? vscode.workspace.workspaceFolders?.[0].name
      : vscode.workspace.workspaceFolders?.[0].name +
        "-" +
        path.basename(deadLineFolderPath());
  const projectPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const config = getConfig();
  const separatorString = "\n\n　　　" + config.separator + "\n\n";
  const draftRootPath =
    deadLineFolderPath() == "" ? draftRoot() : deadLineFolderPath();

  console.log("ProjectName: ", projectName);
  console.log("締め切りフォルダー", deadLineFolderPath());

  //      publishフォルダがなければ作る
  if (!fs.existsSync(projectPath + "/publish")) {
    fs.mkdirSync(projectPath + "/publish");
  }

  //#region BLANK
  //  空のファイルをつくる
  const fileExtension = config.draftFileType;
  const compiledTextFilePath =
    projectPath + "/publish/" + projectName + fileExtension;
  try {
    fs.writeFileSync(compiledTextFilePath, "");
  } catch (err) {
    console.log("ファイル書き込み時のエラー", err);
  }

  //  テキストを書き込む
  const filelist = fileList(draftRootPath).files;
  filelist.forEach((listItem: { dir?: string; depthIndicator?: number }) => {
    let appendingContext = "";
    if (listItem.dir) {
      appendingContext = fs.readFileSync(listItem.dir, "utf8");
    } else if (listItem.depthIndicator) {
      appendingContext = separatorString;
    }
    fs.appendFileSync(compiledTextFilePath, appendingContext);
  });
  //console.log(fileList(draftRootPath, 0).files);
}

export function draftRoot(): string {
  if (
    vscode.workspace.name == undefined ||
    vscode.workspace.workspaceFolders == undefined
  ) {
    return "";
  } else {
    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    let draftRootPath = projectPath;
    const projectFiles = fs.readdirSync(projectPath);
    //「原稿」あるいは「Draft」フォルダーを原稿フォルダのルートにする。
    if (
      projectFiles.includes("Draft") &&
      fs.statSync(projectPath + "/Draft").isDirectory()
    ) {
      draftRootPath = draftRootPath + "/Draft";
    } else if (
      projectFiles.includes("原稿") &&
      fs.statSync(projectPath + "/原稿").isDirectory()
    ) {
      draftRootPath = draftRootPath + "/原稿";
    }

    return draftRootPath;
  }
}

type File = {
  dir?: string;
  name?: string;
  length?: number;
  directoryName?: string;
  directoryLength?: number;
  depthIndicator?: number;
};

type FileList = {
  label: string;
  files: File[];
  length: number;
};

//fileList()は、ファイルパスと（再帰処理用の）ディレクトリ深度を受け取って、ファイルリストの配列と総文字数を返す。
export function fileList(dirPath: string): FileList {
  let characterCount = 0;
  const filesInFolder = getFiles(dirPath);

  const labelOfList = path.basename(dirPath);
  const files: File[] = [];

  for (const dirent of filesInFolder) {
    if (dirent.isDirectory() && dirent.name == "publish") {
    } else if (dirent.name.match(/^\..*/)) {
    } else if (dirent.isDirectory()) {
      const fp = path.join(dirPath, dirent.name);
      const containerFiles = fileList(fp);

      files.push({
        directoryName: dirent.name,
        directoryLength: containerFiles.length,
      });

      characterCount += containerFiles.length;
      files.push(containerFiles.files);
    } else if (
      dirent.isFile() &&
      [getConfig().draftFileType].includes(path.extname(dirent.name))
    ) {
      //文字数カウントテスト
      let readingFile = fs.readFileSync(
        path.join(dirPath, dirent.name),
        "utf-8",
      );
      //カウントしない文字を除外 from https://github.com/8amjp/vsce-charactercount by MIT license
      readingFile = readingFile
        .replace(/\s/g, "") // すべての空白文字
        .replace(/《(.+?)》/g, "") // ルビ範囲指定記号とその中の文字
        .replace(/[|｜]/g, "") // ルビ開始記号
        .replace(/<!--(.+?)-->/, ""); // コメントアウト
      files.push({
        dir: path.join(dirPath, dirent.name).normalize("NFC"),
        name: dirent.name,
        length: readingFile.length,
      });
      characterCount += readingFile.length;
    }
  }
  //ファイルリストの配列と総文字数を返す
  return {
    label: labelOfList,
    files: files.flat(),
    length: characterCount,
  };
}

function getFiles(dirPath: string) {
  //console.log("getFiles",dirPath);
  const filesInFolder = fs.existsSync(dirPath)
    ? fs.readdirSync(dirPath, { withFileTypes: true })
    : [];
  if (!filesInFolder) console.log(`${dirPath}が見つかりませんでした`);
  return filesInFolder;
}

type FileNode = {
  id: string;
  dir: string;
  name: string;
  length: {
    lengthInNumber: number;
    lengthInSheet: number;
  };
  children?: FileNode[];
  isClosed?: boolean;
};


let globalCounter = 0;

export function resetCounter() {
  globalCounter = 0;
}

resetCounter();
//フォルダーの開閉情報など、キャッシュを扱う必要があるときはcontextを渡す
export function draftsObject(
  dirPath: string,
  context: vscode.ExtensionContext | null = null,
): FileNode[] {
  const results: FileNode[] = [];

  const folderStates = context
    ? context.workspaceState.get<{ [key: string]: boolean }>("folderStates", {})
    : {};

  const filesInFolder = getFiles(dirPath);

  for (const dirent of filesInFolder) {
    if (dirent.isDirectory() && dirent.name === "publish") {
      // console.log("publish folder");
    } else if (dirent.name.match(/^\..*/)) {
      // console.log('invisible docs');
    } else if (dirent.isDirectory() && dirent.name === "dict") {
      // console.log("dictionary folder");
    } else if (dirent.isDirectory()) {
      const directoryPath = path.join(dirPath, dirent.name);
      const containerFiles = draftsObject(directoryPath, context);

      let containerLength = 0;
      let containerLengthInSheet = 0;
      containerFiles.forEach((element) => {
        containerLength += element.length.lengthInNumber;
        containerLengthInSheet += element.length.lengthInSheet;
      });

      const nodeId = `node_${globalCounter++}`;
      const directory: FileNode = {
        id: nodeId,
        dir: directoryPath,
        name: dirent.name,
        length: {
          lengthInNumber: containerLength,
          lengthInSheet: containerLengthInSheet,
        },
        children: containerFiles,
        isClosed: folderStates[nodeId] ?? false, // キャッシュされた状態を使用
      };

      results.push(directory);
    } else if (
      dirent.isFile() &&
      [getConfig().draftFileType].includes(path.extname(dirent.name))
    ) {
      // 文字数カウントテスト
      let readingFile = fs.readFileSync(
        path.join(dirPath, dirent.name),
        "utf-8",
      );

      const fileNode: FileNode = {
        id: `node_${globalCounter++}`,
        dir: path.join(dirPath, dirent.name),
        name: dirent.name,
        length: getLength(readingFile),
      };

      results.push(fileNode);
    }
  }

  return results;
}

export function totalLength(dirPath: string): {
  lengthInNumber: number;
  lengthInSheet: number;
} {
  let result = { lengthInNumber: 0, lengthInSheet: 0 };
  const drafts = draftsObject(dirPath);
  drafts.forEach((element) => {
    result.lengthInNumber += element.length.lengthInNumber;
    result.lengthInSheet += element.length.lengthInSheet;
  });
  return result;
}

export function ifFileInDraft(DocumentPath: string | undefined): boolean {
  if (draftRoot() == "") {
    return false;
  }
  //Treeモデル構築
  const tree = new TreeModel();
  const draftTree = tree.parse({ dir: draftRoot(), name: "root", length: 0 });
  //const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;
  draftsObject(draftRoot()).forEach((element) => {
    const draftNode = tree.parse(element);
    draftTree.addChild(draftNode);
  });
  const activeDocumentObject = draftTree.first(
    (node) => node.model.dir === DocumentPath,
  );
  return activeDocumentObject ? true : false;
}

// MARK: 長さの計算
export function getLength(textDocument: string): {
  lengthInNumber: number;
  lengthInSheet: number;
} {
  let docContent = textDocument;
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

type CachedFolderState = { [key: string]: boolean };


export function updateFolderCache(
  context: vscode.ExtensionContext,
  nodeId: string,
  isClosed: boolean,
) {
  const folderStates: CachedFolderState = context.workspaceState.get(
    "folderStates",
    {},
  );
  folderStates[nodeId] = isClosed;
  context.workspaceState.update("folderStates", folderStates);
}

export function getCachedFolderStates(
  context: vscode.ExtensionContext,
): CachedFolderState {
  return context.workspaceState.get("folderStates", {});
}

function cleanUpFolderStates(currentFolderIds: string, context: vscode.ExtensionContext) {
  const folderStates: CachedFolderState = context.workspaceState.get('folderStates', {});

  // 現在のフォルダーIDに存在しないデータを削除
  for (const id in folderStates) {
    if (!currentFolderIds.includes(id)) {
      delete folderStates[id];
    }
  }

  // 更新された状態を再保存
  context.workspaceState.update('folderStates', folderStates);
}