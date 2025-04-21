import * as vscode from "vscode";
import * as path from "path";
import {
  draftRoot,
  draftsObject,
  resetCounter,
  updateFolderCache,
  writeFolderStates,
} from "./compile";
import {
  getDraftWebViewProviderInstance,
  isFileSelectedOnTree,
} from "./extension";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "./config";

let debugIncrement = 0;

let isFileOperating = false;
let ignorEditorChanges = false;
const debugWebView = false;
const configuration = vscode.workspace.getConfiguration();
const draftFileType =
  configuration.get("Novel.general.filetype") == ".txt" ? ".txt" : ".md";

const output = vscode.window.createOutputChannel("Novel");

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

export class DraftWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "draftTree";
  private _context: vscode.ExtensionContext;
  public _webviewView?: vscode.WebviewView;

  private watch: vscode.FileSystemWatcher;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    // ファイルシステムの監視を設定
    this.watch = vscode.workspace.createFileSystemWatcher("**/*");
    this.watch.onDidChange(this.handleFileSystemEvent, this);
    this.watch.onDidCreate(this.handleFileSystemEvent, this);
    this.watch.onDidDelete(this.handleFileSystemEvent, this);

    // VS Codeの設定が変更された場合
    const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("Novel.general.filetype")) {
        // `Novel.general.filetype` の設定が変更された場合の処理
        vscode.window.showInformationMessage(
          "Novel.general.filetype 設定が変更されました",
        );

        // 変更後の新しい設定値を取得
        const newFileType = vscode.workspace
          .getConfiguration("Novel.general")
          .get<string>("filetype");
        // console.log(`新しいファイルタイプ: ${newFileType}`);
      } else if (e.affectsConfiguration("Novel.DraftTree.renumber")) {
        // ドラッグ&ドロップの設定が変更された場合の処理
        const configuration = vscode.workspace.getConfiguration();
        const isDndActivate = configuration.get("Novel.DraftTree.renumber");
        // console.log(isDndActivate);
        if (this._webviewView) {
          this._webviewView.webview.postMessage({
            command: "configIsOrdable",
            data: isDndActivate,
          });
        }
      }
    });
    context.subscriptions.push(disposable);

    // エディターが変更されたときにwebviewにメッセージを送信
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      // エディターの変更を検知しない場合（上位フォルダーの移動など）;
      if (ignorEditorChanges) {
        console.log("エディターの変更が無視された");
        return;
      }
      console.log("エディターの変更を検知");
      if (this._webviewView && editor) {
        this.highlightFile(
          this._webviewView.webview,
          editor.document.uri.fsPath,
        );
      }
    });
  }

  private handleFileSystemEvent(uri: vscode.Uri) {
    // console.log("File system event detected:", uri);
    if (debugWebView) {
      // console.log(uri);
    }
    this.refreshWebview();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken,
  ) {
    this._webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    const folderStates: Record<string, boolean> =
      this._context.workspaceState.get("folderStates", {});
    // console.log("フォルダー開閉状態", folderStates);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      console.log("TreeViewメッセージ受信", message);
      // MARK: ツリーからのコマンド
      switch (message.command) {
        // ツリーデータの要求
        case "loadTreeData":
          // console.log(`${debugIncrement} loadTreeDataの要求`);
          // MARK: loadTreeDataの要求
          // console.time("loadTreeDataTime");
          this.loadTreeData(webviewView.webview);
          // console.timeEnd("loadTreeDataTime");
          this.sendIsOrdable(webviewView.webview);
          break;

        // ファイルを開く
        case "openFile":
          {
            const uri = vscode.Uri.file(message.filePath);
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type !== vscode.FileType.Directory) {
              await vscode.commands.executeCommand("vscode.open", uri);
            }
          }
          break;

        case "sendFolderState":
          {
            // console.log("sendFolderState", message);
            const { nodeId, isClosed } = message;
            // キャッシュされている状態を更新
            folderStates[nodeId] = isClosed;
            this._context.workspaceState.update("folderStates", folderStates);
            // console.log(
            //   `フォルダー状態が更新されました: ノード ${nodeId} は現在 ${isClosed ? "閉じ" : "開き"}です`,
            // );
          }
          break;

        case "log":
          // 対応する処理なし
          break;

        case "alert":
          vscode.window.showErrorMessage(
            `Novelーwriter原稿ツリー：${message.alertMessage}`,
          );
          break;

        // 順番管理の読み込み
        case "loadIsOrdable":
          this.sendIsOrdable(webviewView.webview);
          break;

        case "moveCommmand":
          // console.log(message.fileTransferData);
          moveAndReorderFiles(
            message.fileTransferData.destinationPath,
            message.fileTransferData.insertPoint,
            message.fileTransferData.movingFileDir,
          );
          break;

        case "moveFileUp":
          console.log("moveFileUp", message.fileData);
          console.log(draftsObject(draftRoot(), this._context));
          this.swapFileUpDown(
            message.fileData.destinationPath,
            "up",
            this._context,
          );
          break;

        case "moveFileDown":
          console.log("moveFileDown", message.fileData);
          this.swapFileUpDown(
            message.fileData.destinationPath,
            "down",
            this._context,
          );
          break;

        case "rename":
          renameFile(message.renameFile.targetPath, message.renameFile.newName);
          break;

        case "insert":
          // console.log(
          //   `ファイル挿入 ${message.renameFile.targetPath}の後ろに${message.renameFile.insertingNode}の${message.renameFile.newName}を挿入`
          // );
          insertFile(
            message.renameFile.targetPath,
            message.renameFile.insertingNode,
            message.renameFile.newName,
          );
          // renameFile(message.renameFile.targetPath, message.renameFile.newName);
          break;

        case "fileSelection":
          {
            const isFileSelected = message.node != null ? true : false;
            // console.log(`${message.node}が選択されました`);
            vscode.commands.executeCommand(
              "setContext",
              "isFileSelectedOnTree",
              isFileSelected,
            );
          }
          break;

        default:
          // 対応するコマンドがありません
          break;
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "dist",
        "webview",
        "bundle.js",
      ),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "style.css"),
    );

    return /* html */ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Draft Tree</title>
      </head>
      <body>
        <div id="root"></div>
        <script src="${scriptUri}"></script>
      </body>
    </html>`;
  }

  public loadTreeData(webview: vscode.Webview) {
    resetCounter();
    // console.time("loadTreeDataTime");
    const configuration = getConfig();
    const draftFileType = configuration.draftFileType;
    const countOfNumber = configuration.displayCountOfNumber;
    const countOfSheet = configuration.displayCountOfSheet;
    webview.postMessage({
      command: "treeData",
      data: draftsObject(draftRoot(), this._context),
      displayNumber: countOfNumber,
      displaySheet: countOfSheet,
      draftFileType: draftFileType,
    });
    // console.timeEnd("loadTreeDataTime");
  }

  private async sendIsOrdable(webview: vscode.Webview) {
    // const configuration = vscode.workspace.getConfiguration();
    const renumberSetting = (await waitForConfiguration()).get("renumber");
    webview.postMessage({
      command: "configIsOrdable",
      data: renumberSetting,
    });
  }

  private refreshWebview() {
    if (this._webviewView && !isFileOperating) {
      this.loadTreeData(this._webviewView.webview);
    }
  }

  public insertFile(webview: vscode.Webview, fileType: "file" | "folder") {
    // console.log(`${fileType}の挿入をツリービューに送ります`);
    webview.postMessage({
      command: "insertFile",
      data: fileType,
    });
  }
  public highlightFile(webview: vscode.Webview, targetPath: string) {
    webview.postMessage({
      command: "setHighlight",
      highlitingNode: targetPath,
    });
  }

  // MARK: ファイルの前後移動
  public async swapFileUpDown(
    filePath: string,
    direction: "up" | "down",
    context: vscode.ExtensionContext,
  ) {
    const fileTree = draftsObject(draftRoot(), context);
    writeFolderStates(context, fileTree);

    // ワークスペースが開いているかチェック
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return vscode.window.showErrorMessage("ワークスペースが開かれていません");
    }

    // 対象ファイルの URI と親ディレクトリ URI を生成
    const fileUri = vscode.Uri.file(filePath);
    const parentDirPath = path.dirname(filePath);
    const parentUri = vscode.Uri.file(parentDirPath);

    try {
      // 親ディレクトリ内のファイル一覧を取得（フィルタリングあり）
      let files = await vscode.workspace.fs.readDirectory(parentUri);
      files = files.filter(
        (item) =>
          !item[0].startsWith(".") && // 隠しファイル除外
          !(item[0] === "publish" || item[0] === "dict" || item[0] === "css") &&
          // 指定の拡張子またはディレクトリの場合のみ対象（※必要に応じて修正）
          (item[0].endsWith(draftFileType) ||
            item[1] === vscode.FileType.Directory),
      );

      // 連番が先頭に付いている前提なので、連番部分を取り出して数値順にソート
      files.sort((a, b) => {
        const regex = /^(\d+)/;
        const numA = parseInt(a[0].match(regex)?.[1] ?? "0", 10);
        const numB = parseInt(b[0].match(regex)?.[1] ?? "0", 10);
        return numA - numB;
      });

      // 対象ファイルのインデックスを調べる
      const currentIndex = files.findIndex(
        (item) =>
          vscode.Uri.joinPath(parentUri, item[0]).fsPath === fileUri.fsPath,
      );
      if (currentIndex === -1) {
        return vscode.window.showErrorMessage(
          "対象ファイルがディレクトリ内に見つかりません",
        );
      }

      // 入れ替える相手のインデックスを決定
      const swapIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= files.length) {
        return vscode.window.showErrorMessage("これ以上並び替えられません");
      }

      // 対象ファイルと入れ替え対象ファイルのファイル名を取得
      const currentFileOldName = files[currentIndex][0];
      const swapFileOldName = files[swapIndex][0];

      const currentFileOldNode = getFileNodeByPath(
        fileTree,
        path.join(parentDirPath, currentFileOldName),
      );
      const swapFileOldNode = getFileNodeByPath(
        fileTree,
        path.join(parentDirPath, swapFileOldName),
      );

      // 必要に応じてツリービュー等の更新も行ってください
      // ファイルの開閉キャッシュの入れ替え
      if (swapFileOldNode?.id) {
        if (currentFileOldNode) {
          updateFolderCache(
            context,
            swapFileOldNode.id,
            currentFileOldNode.isClosed ?? false,
          );
          console.log(
            "入れ替え先の開閉キャッシュ",
            swapFileOldNode.id,
            currentFileOldNode.isClosed,
          );
          updateFolderCache(
            context,
            currentFileOldNode.id,
            swapFileOldNode.isClosed ?? false,
          );
          console.log(
            "入れ替えもとの開閉キャッシュ",
            currentFileOldNode.id,
            swapFileOldNode.isClosed,
          );
        }
      }

      // 「連番-ファイル名.ext」の形式かどうかを正規表現でチェックして分解
      const regex = /^(\d+)([-_\s])(.*)$/;
      const currentMatch = currentFileOldName.match(regex);
      const swapMatch = swapFileOldName.match(regex);
      if (!currentMatch || !swapMatch) {
        return vscode.window.showErrorMessage(
          "ファイル名が連番付きではないため並び替えできません",
        );
      }

      // 桁数は現在の番号部分の長さとし、連番の部分だけを交換する
      const digits = currentMatch[1].length;
      const separatorCurrent = currentMatch[2];
      const separatorSwap = swapMatch[2]; // 多くの場合同じセパレータであるはずですが…
      const restCurrent = currentMatch[3];
      const restSwap = swapMatch[3];

      // 新しいファイル名を生成
      // 対象ファイルは、入れ替え対象の番号を使用し、入れ替え対象ファイルは対象の番号を使用する
      const newCurrentFileName = `${swapMatch[1].padStart(digits, "0")}${separatorCurrent}${restCurrent}`;
      const newSwapFileName = `${currentMatch[1].padStart(digits, "0")}${separatorSwap}${restSwap}`;

      // 各ファイルの URI を生成
      const currentFileUri = vscode.Uri.joinPath(parentUri, currentFileOldName);
      const swapFileUri = vscode.Uri.joinPath(parentUri, swapFileOldName);
      const regexForFileType = new RegExp(`.*${draftFileType}$`);
      console.log(regexForFileType);
      if (!currentFileOldName.match(regexForFileType)) {
        console.log("エディターの変更を無視");
        ignorEditorChanges = true;
      }
      // 一時ファイル名（衝突を避けるため）を生成して、対象ファイルを一旦リネーム
      const tempFileName = `temp-${uuidv4()}-${currentFileOldName}`;
      const tempFileUri = vscode.Uri.joinPath(parentUri, tempFileName);

      // リネーム操作
      await vscode.workspace.fs.rename(currentFileUri, tempFileUri);
      await vscode.workspace.fs.rename(
        swapFileUri,
        vscode.Uri.joinPath(parentUri, newSwapFileName),
      );
      await vscode.workspace.fs.rename(
        tempFileUri,
        vscode.Uri.joinPath(parentUri, newCurrentFileName),
      );

      vscode.window.showInformationMessage(`ファイルの並び替えが完了しました`);
      this.highlightFile(
        this._webviewView!.webview,
        vscode.Uri.joinPath(parentUri, newCurrentFileName).fsPath,
      );
      setTimeout(() => {
        ignorEditorChanges = false;
      }, 300);
    } catch (error) {
      if (error instanceof Error) {
        vscode.window.showErrorMessage(
          `ファイル並び替え中にエラーが発生しました: ${error.message}`,
        );
      } else {
        vscode.window.showErrorMessage(
          `ファイル並び替え中にエラーが発生しました: ${String(error)}`,
        );
      }
    }
  }
}

// MARK: ドラッグ&ドロップ
async function moveAndReorderFiles(
  destinationPath: string,
  insertPoint: "before" | "inside" | "after",
  movingFileDir: string,
) {
  // ワークスペースフォルダを取得します
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return vscode.window.showErrorMessage(
      "ワークスペースを開いていない時は、ファイルの並び替えは行いません",
    );
  }

  isFileOperating = true;

  // パスをURIに変換
  const destinationUri = vscode.Uri.file(destinationPath);
  const movingFileUri = vscode.Uri.file(movingFileDir);

  // 上位ディレクトリURIを返す変数を作成
  // insideの時は、destinationUriがdestinationUpperUriになる
  const destinationUpperUri =
    insertPoint !== "inside"
      ? vscode.Uri.file(vscode.Uri.joinPath(destinationUri, "..").fsPath)
      : destinationUri;

  const movingFileUpperUri = vscode.Uri.file(
    vscode.Uri.joinPath(movingFileUri, "..").fsPath,
  );
  // 同じディレクトリ内でのソーとか、それとも別のフォルダーからの移動か
  const isOnlySort =
    destinationUpperUri.path === movingFileUpperUri.path ? true : false;

  try {
    // 移動先ディレクトリの内容を読み取ります。
    let destinationFiles = await (
      await vscode.workspace.fs.readDirectory(destinationUpperUri)
    ).filter(
      (file) =>
        // ファイル名の先頭に'.'が付いているもの(不可視ファイル)を除外
        !file[0].startsWith(".") &&
        !(file[0] == "publish" || file[0] == "dict" || file[0] == "css") &&
        // 指定されたファイルタイプまたはディレクトリのみを保持
        (file[0].endsWith(draftFileType) ||
          file[1] === vscode.FileType.Directory),
    );

    // destinationPathがdestinationFilesの何番目にあるかを見つけます
    let destinationIndex = destinationFiles.findIndex(
      (file) =>
        vscode.Uri.joinPath(destinationUpperUri, file[0]).fsPath ===
        destinationUri.fsPath,
    );
    if (isOnlySort) {
      const movingFileIndex = destinationFiles.findIndex(
        (file) =>
          vscode.Uri.joinPath(destinationUpperUri, file[0]).fsPath ===
          movingFileUri.fsPath,
      );
      destinationIndex =
        destinationIndex > movingFileIndex
          ? destinationIndex - 1
          : destinationIndex;
    }

    // ファイルを移動元ディレクトリから移動先ディレクトリに移動させます。
    // まずエディターでファイルを閉じます
    await closeFileInEditor(movingFileUri);

    // 移動用のUUIDを作成
    const uniqueId = uuidv4();

    const fileName = path.basename(movingFileDir);
    const fileIndex =
      insertPoint === "before" || insertPoint === "inside"
        ? 1
        : destinationIndex + 2;
    // 桁数判断 同一ディレクトリ内での入れ替えならファイル総数は変わらないが、挿入の時は1増える
    const digits = (destinationFiles.length + (isOnlySort ? 0 : 1)).toString()
      .length;

    const targetUri =
      insertPoint === "inside" ? destinationUri : destinationUpperUri;
    const newFileName = `${String(fileIndex).padStart(
      digits,
      "0",
    )}-${fileName.replace(/^\d+[-_\s]*/, "")}`;

    await vscode.workspace.fs.copy(
      movingFileUri,
      vscode.Uri.joinPath(targetUri, `moving-${uniqueId}-${newFileName}`),
      { overwrite: true },
    );

    await vscode.workspace.fs.delete(movingFileUri, { recursive: true });

    // 移動先ディレクトリの内容を読み取ります。
    destinationFiles = await (
      await vscode.workspace.fs.readDirectory(targetUri)
    ).filter(
      (file) =>
        // ファイル名の先頭に'.'が付いているもの(不可視ファイル)を除外
        !file[0].startsWith(".") &&
        !(file[0] == "publish" || file[0] == "dict" || file[0] == "css") &&
        // 指定されたファイルタイプまたはディレクトリのみを保持
        (file[0].endsWith(draftFileType) ||
          file[1] === vscode.FileType.Directory),
    );

    // 移動先のフォルダーの中のファイルに連番を付与します
    // 戻り値は、移動元ディレクトリの新しいパスです。
    const currentMovingFileUpperUri = await addSequentialNumberToFiles(
      targetUri,
      destinationFiles,
      destinationIndex,
      insertPoint,
      movingFileUpperUri,
      uniqueId,
    );

    if (!isOnlySort) {
      // 移動元ディレクトリの内容を読み取ります。
      const movingFiles = await (
        await vscode.workspace.fs.readDirectory(currentMovingFileUpperUri)
      ).filter(
        (file) =>
          // ファイル名の先頭に'.'が付いているもの(不可視ファイル)を除外
          !file[0].startsWith(".") &&
          !(file[0] == "publish" || file[0] == "dict" || file[0] == "css") &&
          // 指定されたファイルタイプまたはディレクトリのみを保持
          (file[0].endsWith(draftFileType) ||
            file[1] === vscode.FileType.Directory),
      );

      // 移動元のフォルダーの中のファイルに連番を付与します
      await addSequentialNumberToFiles(
        currentMovingFileUpperUri,
        movingFiles,
        -1,
        insertPoint,
        movingFileUpperUri,
        uniqueId,
      );
    }
    isFileOperating = false;
    // ツリービューの更新
    const draftWebViewProvider = getDraftWebViewProviderInstance();
    draftWebViewProvider.loadTreeData(
      draftWebViewProvider._webviewView!.webview,
    );
    draftWebViewProvider.highlightFile(
      draftWebViewProvider._webviewView!.webview,
      vscode.Uri.joinPath(targetUri, newFileName).fsPath,
    );
  } catch (error) {
    // エラーハンドリング
    if (error instanceof Error) {
      vscode.window.showErrorMessage(
        `ファイルの移動中にエラーが発生しました ${error.message}`,
      );
    } else {
      vscode.window.showErrorMessage(
        `ファイルの移動中にエラーが発生しました: ${String(error)}`,
      );
    }
  }

  isFileOperating = false;
}

// ファイルのパスからnodeを取得
function getFileNodeByPath(
  nodes: FileNode[],
  dirPath: string,
): FileNode | null {
  // 配列内の各ノードをチェック
  console.log("ノード", nodes, dirPath);
  for (const node of nodes) {
    if (node.dir === dirPath) {
      return node; // 一致する場合、id を返す
    }
    if (node.children) {
      // 子ノードがある場合は再帰的に探索
      const result = getFileNodeByPath(node.children, dirPath);
      if (result !== null) {
        return result;
      }
    }
  }
  return null; // 見つからなかった場合は null を返す
}

// MARK: ファイル通し番号
// ファイルとフォルダーにdestinationUriとinsertPointで示される位置の番号を抜いた連番をつける関数
async function addSequentialNumberToFiles(
  targetUri: vscode.Uri,
  destinationFiles: [string, vscode.FileType][],
  destinationIndex: number,
  insertPoint: "before" | "inside" | "after",
  movingFileUpperUri: vscode.Uri,
  uniqueId?: string,
) {
  // console.log("sort!");

  let renamedMovingFileUpperUrl = movingFileUpperUri;
  let fileIndex = 1;
  // ディレクトリ内のファイルとフォルダの名前を変更
  //スキップするindex beforeなら0、afterならdestinationIndexの一つ後ろ
  const skipIndex = insertPoint === "before" ? 0 : destinationIndex + 1;

  // ドラッグ元が削除されたフォルダーの連番やり直し
  const postNumbering = destinationIndex == -1 ? true : false;
  let movigFileName = "";

  for (let i = 0; i < destinationFiles.length; i++) {
    let fileName = destinationFiles[i][0];

    if (fileName.startsWith("moving-")) {
      // console.log("移動中ファイル発見？", fileName, uniqueId);
      movigFileName = fileName;
      continue;
    }

    // 挿入ポイント
    if (i == skipIndex && !postNumbering) {
      fileIndex++;
    }

    const oldUri = vscode.Uri.joinPath(targetUri, fileName);

    // 先頭に /(^\d+[-_])/ の形式がある場合、それを削除します
    fileName = fileName.replace(/^\d+[-_\s]*/, "");

    const digits = destinationFiles.length.toString().length;
    const newFileName = `${String(fileIndex).padStart(
      digits,
      "0",
    )}-${fileName}`;
    fileIndex++;

    const newUri = vscode.Uri.joinPath(targetUri, newFileName);

    if (oldUri.path == movingFileUpperUri.path) {
      // 上位ディレクトリから
      renamedMovingFileUpperUrl = newUri;
    } else if (movingFileUpperUri.path.startsWith(oldUri.path)) {
      // 下位ディレクトリから
      const subDir = movingFileUpperUri.path.replace(oldUri.path, "");
      renamedMovingFileUpperUrl = vscode.Uri.joinPath(newUri, subDir);
    }

    try {
      // まずエディターでファイルを閉じます
      await closeFileInEditor(oldUri);
      await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: true });
    } catch (error) {
      console.error(
        `ファイル名の修正に失敗しました rename ${oldUri} to ${newUri}: ${error}`,
      );
    }
  }

  if (uniqueId) {
    // console.log("UUIDの削除");
    try {
      const uidHandlerRegex = new RegExp(`^moving-${uniqueId}-(.+)`);
      const movingFilesUri = vscode.Uri.joinPath(targetUri, movigFileName);
      const movingFilesNewUri = vscode.Uri.joinPath(
        targetUri,
        movigFileName.replace(uidHandlerRegex, "$1"),
      );
      // console.log("移動中ファイルのUIDつきファイル名", movigFileName);
      await vscode.workspace.fs.rename(movingFilesUri, movingFilesNewUri, {
        overwrite: true,
      });
    } catch (error) {
      console.error(`移動中のファイルのUUID削除に失敗しました`);
    }
  }

  return renamedMovingFileUpperUrl;
}

// MARK: エディターを閉じる
async function closeFileInEditor(fileUri: vscode.Uri) {
  const allOpenEditors = vscode.window.visibleTextEditors;

  for (const editor of allOpenEditors) {
    if (editor.document.uri.toString() === fileUri.toString()) {
      await vscode.window.showTextDocument(editor.document);
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    }
  }
}

// Configの読み込み
async function waitForConfiguration(): Promise<vscode.WorkspaceConfiguration> {
  // ここでは、たとえば設定が特定の値になっているかを監視する例です
  return new Promise((resolve) => {
    const configuration = vscode.workspace.getConfiguration("Novel.DraftTree");
    resolve(configuration);
  });
}

// MARK: ファイルのリネーム
async function renameFile(targetPath: string, newName: string) {
  // console.log(`ファイル名変更： ${targetPath} を ${newName} に変更`);
  const targetFileUri = vscode.Uri.file(targetPath);
  // const newFileName = newName;
  const oldFileName = path.basename(targetPath);
  const targetFileDir = vscode.Uri.file(path.dirname(targetPath));
  let newFileName = newName;
  const ifRenumber = (await waitForConfiguration()).get("renumber");
  if (ifRenumber) {
    newFileName = oldFileName.replace(
      /^(\d+[-_\s]*)*(.+?)(\.(txt|md))?$/,
      `$1${newName}$3`,
    );
  }
  const newFieUri = vscode.Uri.joinPath(targetFileDir, newFileName);
  try {
    await vscode.workspace.fs.rename(targetFileUri, newFieUri, {
      overwrite: true,
    });
  } catch (error) {
    vscode.window.showErrorMessage(
      `${oldFileName}を${newFileName}に書き換えることができませんでした`,
    );
  }
  const draftWebViewProvider = getDraftWebViewProviderInstance();
  draftWebViewProvider.loadTreeData(draftWebViewProvider._webviewView!.webview);
}

// MARK: ファイル挿入
async function insertFile(
  targetPath: string,
  insertingNodeType: "file" | "folder",
  insertingNodeName: string,
) {
  const targetFileUri = vscode.Uri.file(targetPath);
  const documentFileType = configuration.get("Novel.general.filetype");
  // 並び替えなし
  const ifRenumber = (await waitForConfiguration()).get("renumber");
  if (!ifRenumber) {
    // 並び替えなしでファイルを作成
    if (insertingNodeType == "file") {
      // 拡張子が一致しない場合、拡張子を付与する
      const fileTypeDetectingRegex = new RegExp(`${draftFileType}$`);
      console.log(
        "ファイルかどうか",
        fileTypeDetectingRegex,
        insertingNodeName.match(fileTypeDetectingRegex),
      );
      const insertingFileName = insertingNodeName.match(fileTypeDetectingRegex)
        ? insertingNodeName
        : insertingNodeName + draftFileType;
      const insertingFileUri = vscode.Uri.joinPath(
        vscode.Uri.file(path.dirname(targetPath)),
        insertingFileName,
      );
      const emptyFileData = new Uint8Array();
      try {
        await vscode.workspace.fs.writeFile(insertingFileUri, emptyFileData);
        await vscode.commands.executeCommand("vscode.open", insertingFileUri);
        const draftWebViewProvider = getDraftWebViewProviderInstance();
        draftWebViewProvider.highlightFile(
          draftWebViewProvider._webviewView!.webview,
          insertingFileUri.fsPath,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          "ファイルの作成に失敗しました: " + error,
        );
      }
      // 並び替えなしでフォルダーを作成
    } else if (insertingNodeType == "folder") {
      const insertingFileUri = vscode.Uri.joinPath(
        vscode.Uri.file(path.dirname(targetPath)),
        insertingNodeName,
      );
      try {
        await vscode.workspace.fs.createDirectory(insertingFileUri);
      } catch (error) {
        vscode.window.showErrorMessage(
          "フォルダーの作成に失敗しました: " + error,
        );
      }
    }
    // 連番管理あり
  } else {
    isFileOperating = true;
    // targetPathの親のUriを作成
    const destinationUpperUri = vscode.Uri.file(path.dirname(targetPath));
    let destinationFiles = await (
      await vscode.workspace.fs.readDirectory(destinationUpperUri)
    ).filter(
      (file) =>
        // ファイル名の先頭に'.'が付いているもの(不可視ファイル)を除外
        !file[0].startsWith(".") &&
        !(file[0] == "publish" || file[0] == "dict" || file[0] == "css") &&
        // 指定されたファイルタイプまたはディレクトリのみを保持
        (file[0].endsWith(draftFileType) ||
          file[1] === vscode.FileType.Directory),
    );
    // destinationPathがdestinationFilesの何番目にあるかを見つけます
    let destinationIndex = destinationFiles.findIndex(
      (file) =>
        vscode.Uri.joinPath(destinationUpperUri, file[0]).fsPath === targetPath,
    );
    // 移動用のUUIDを作成
    const uniqueId = uuidv4();
    const fileIndex = destinationIndex + 2;
    const digits = (destinationFiles.length + 1).toString().length;
    const insertingUidNodeName = `moving-${uniqueId}-${String(
      fileIndex,
    ).padStart(digits, "0")}-${insertingNodeName}`;
    const newInsertingNodeName = `${String(fileIndex).padStart(
      digits,
      "0",
    )}-${insertingNodeName}`;
    const newInsertingNodeUri = vscode.Uri.file(path.dirname(targetPath));
    // 並び替えありでファイルを作成
    if (insertingNodeType == "file") {
      const emptyFileData = new Uint8Array();
      const writingTextFileUri = vscode.Uri.joinPath(
        newInsertingNodeUri,
        insertingUidNodeName + documentFileType,
      );
      try {
        await vscode.workspace.fs.writeFile(writingTextFileUri, emptyFileData);
      } catch (error) {
        vscode.window.showErrorMessage(
          "ファイルの作成に失敗しました: " + error,
        );
      }
    } else if (insertingNodeType == "folder") {
      // 並び替えありでフォルダーを作成
      const writingFolderUri = vscode.Uri.joinPath(
        newInsertingNodeUri,
        insertingUidNodeName,
      );

      try {
        await vscode.workspace.fs.createDirectory(writingFolderUri);
      } catch (error) {
        vscode.window.showErrorMessage(
          "フォルダーの作成に失敗しました: " + error,
        );
      }
    }
    destinationFiles = await (
      await vscode.workspace.fs.readDirectory(destinationUpperUri)
    ).filter(
      (file) =>
        // ファイル名の先頭に'.'が付いているもの(不可視ファイル)を除外
        !file[0].startsWith(".") &&
        !(file[0] == "publish" || file[0] == "dict" || file[0] == "css") &&
        // 指定されたファイルタイプまたはディレクトリのみを保持
        (file[0].endsWith(draftFileType) ||
          file[1] === vscode.FileType.Directory),
    );

    await addSequentialNumberToFiles(
      newInsertingNodeUri,
      destinationFiles,
      destinationIndex,
      "after",
      vscode.Uri.file(draftRoot()),
      uniqueId,
    );

    const insertedNodeName =
      insertingNodeType === "file"
        ? newInsertingNodeName + documentFileType
        : newInsertingNodeName;

    const insertedNodeUrl = vscode.Uri.joinPath(
      newInsertingNodeUri,
      insertedNodeName,
    );
    if (insertingNodeType === "file") {
      await vscode.commands.executeCommand("vscode.open", insertedNodeUrl);
    }
    const draftWebViewProvider = getDraftWebViewProviderInstance();
    draftWebViewProvider.highlightFile(
      draftWebViewProvider._webviewView!.webview,
      insertedNodeUrl.fsPath,
    );
    isFileOperating = false;
  }
}
