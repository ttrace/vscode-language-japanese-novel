import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "./config";
import { deadLineFolderPath } from "./extension";

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

  //  空のファイルをつくる
  const compiledTextFilePath = projectPath + "/publish/" + projectName + ".txt";
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

  //  console.log("files from system:", filesInFolder);

  const labelOfList = path.basename(dirPath);
  const files: File[] = [];

  for (const dirent of filesInFolder) {
    if (dirent.isDirectory() && dirent.name == "publish") {
      //console.log("publish folder");
    } else if (dirent.name.match(/^\..*/)) {
      //console.log("invisible docs");
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
        "utf-8"
      );
      //カウントしない文字を除外 from https://github.com/8amjp/vsce-charactercount by MIT license
      readingFile = readingFile
        .replace(/\s/g, "") // すべての空白文字
        .replace(/《(.+?)》/g, "") // ルビ範囲指定記号とその中の文字
        .replace(/[|｜]/g, "") // ルビ開始記号
        .replace(/<!--(.+?)-->/, ""); // コメントアウト
      files.push({
        dir: path.join(dirPath, dirent.name).normalize('NFC'),
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
  dir: string;
  name: string;
  length: number;
};

export function draftsObject(dirPath: string): FileNode[] {
  const results: FileNode[] = [];

  const filesInFolder = getFiles(dirPath);

  for (const dirent of filesInFolder) {
    if (dirent.isDirectory() && dirent.name == "publish") {
      console.log("publish folder");
    } else if (dirent.name.match(/^\..*/)) {
      //console.log('invisible docs');
    } else if (dirent.isDirectory() && dirent.name == "dict") {
      console.log("dictionary folder");
    } else if (dirent.isDirectory()) {
      const directoryPath = path.join(dirPath, dirent.name);
      const containerFiles = draftsObject(directoryPath);

      let containerLength = 0;
      containerFiles.forEach((element) => {
        containerLength += element.length;
      });

      const directory = {
        dir: path.join(dirPath, dirent.name),
        name: dirent.name,
        length: containerLength,
        children: containerFiles,
      };

      results.push(directory);
    } else if (
      dirent.isFile() &&
      [getConfig().draftFileType].includes(path.extname(dirent.name))
    ) {
      //文字数カウントテスト
      let readingFile = fs.readFileSync(
        path.join(dirPath, dirent.name),
        "utf-8"
      );
      //カウントしない文字を除外 from https://github.com/8amjp/vsce-charactercount by MIT license
      readingFile = readingFile
        .replace(/\s/g, "") // すべての空白文字
        .replace(/《(.+?)》/g, "") // ルビ範囲指定記号とその中の文字
        .replace(/[|｜]/g, "") // ルビ開始記号
        .replace(/<!--(.+?)-->/, ""); // コメントアウト

      const fileNode = {
        dir: path.join(dirPath, dirent.name),
        name: dirent.name,
        length: readingFile.length,
      };
      results.push(fileNode);
    }
  }
  return results;
}

export function totalLength(dirPath: string): number {
  let result = 0;
  const drafts = draftsObject(dirPath);
  drafts.forEach((element) => {
    result += element.length;
  });
  return result;
}
