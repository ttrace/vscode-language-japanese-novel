import * as vscode from "vscode";
import * as path from "path";
import { draftRoot, draftsObject, resetCounter } from "./compile";
import { getDraftWebViewProviderInstance } from "./extension";
import { v4 as uuidv4 } from "uuid";

let isFileOperating = false;
const debugWebView = false;
const configuration = vscode.workspace.getConfiguration();
const draftFileType =
  configuration.get("Novel.general.filetype") == ".txt" ? ".txt" : ".md";

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
          "Novel.general.filetype 設定が変更されました"
        );

        // 変更後の新しい設定値を取得
        const newFileType = vscode.workspace
          .getConfiguration("Novel.general")
          .get<string>("filetype");
        console.log(`新しいファイルタイプ: ${newFileType}`);
      } else if (e.affectsConfiguration("Novel.DraftTree.renumber")) {
        // ドラッグ&ドロップの設定が変更された場合の処理
        const configuration = vscode.workspace.getConfiguration();
        const isDndActivate = configuration.get("Novel.DraftTree.renumber");
        console.log(isDndActivate);
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
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (this._webviewView) {
        this._webviewView.webview.postMessage({ command: "clearHighlight" });
      }
    });
  }

  private handleFileSystemEvent(uri: vscode.Uri) {
    // console.log("File system event detected:", uri);
    if (debugWebView) {
      console.log(uri);
    }
    this.refreshWebview();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken
  ) {
    this._webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      // MARK: Command一覧
      // ツリーデータの要求
      if (message.command === "loadTreeData") {
        this.loadTreeData(webviewView.webview);
        this.sendIsOrdable(webviewView.webview);
        // console.log("Treeからデータ取得依頼");

        // ファイルを開く
      } else if (message.command === "openFile") {
        const uri = vscode.Uri.file(message.filePath);
        await vscode.commands.executeCommand("vscode.open", uri);

        // ログの出力
      } else if (message.command === "log") {
        console.log(message.log);

        // アラート
      } else if (message.command === "alert") {
        vscode.window.showErrorMessage(
          `Novelーwriter原稿ツリー：${message.alertMessage}`
        );

        // 順番管理の読み込み
      } else if (message.command === "loadIsOrdable") {
        this.sendIsOrdable(webviewView.webview);
      } else if (message.command === "moveCommmand") {
        // console.log(message.fileTransferData);
        moveAndReorderFiles(
          message.fileTransferData.destinationPath,
          message.fileTransferData.insertPoint,
          message.fileTransferData.movingFileDir
        );
      } else if (message.command === "rename") {
        console.log(
          `ファイル名変更 ${message.renameFile.targetPath}を${message.renameFile.newName}`
        );
        renameFile(message.renameFile.targetPath, message.renameFile.newName);
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "dist",
        "webview",
        "bundle.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "style.css")
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
    webview.postMessage({
      command: "treeData",
      data: draftsObject(draftRoot()),
    });
  }

  private sendIsOrdable(webview: vscode.Webview) {
    const configuration = vscode.workspace.getConfiguration();
    const renumberSetting = configuration.get("Novel.DraftTree.renumber");
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
}

// MARK: ドラッグ&ドロップ
async function moveAndReorderFiles(
  destinationPath: string,
  insertPoint: "before" | "inside" | "after",
  movingFileDir: string
) {
  // ワークスペースフォルダを取得します
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return vscode.window.showErrorMessage(
      "ワークスペースを開いていない時は、ファイルの並び替えは行いません"
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
    vscode.Uri.joinPath(movingFileUri, "..").fsPath
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
          file[1] === vscode.FileType.Directory)
    );

    // destinationPathがdestinationFilesの何番目にあるかを見つけます
    let destinationIndex = destinationFiles.findIndex(
      (file) =>
        vscode.Uri.joinPath(destinationUpperUri, file[0]).fsPath ===
        destinationUri.fsPath
    );
    if (isOnlySort) {
      const movingFileIndex = destinationFiles.findIndex(
        (file) =>
          vscode.Uri.joinPath(destinationUpperUri, file[0]).fsPath ===
          movingFileUri.fsPath
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

    await vscode.workspace.fs.copy(
      movingFileUri,
      vscode.Uri.joinPath(
        targetUri,
        `moving-${uniqueId}-${String(fileIndex).padStart(
          digits,
          "0"
        )}-${fileName.replace(/^\d+[-_\s]*/, "")}`
      ),
      { overwrite: true }
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
          file[1] === vscode.FileType.Directory)
    );

    // 移動先のフォルダーの中のファイルに連番を付与します
    // 戻り値は、移動元ディレクトリの新しいパスです。
    const currentMovingFileUpperUri = await addSequentialNumberToFiles(
      targetUri,
      destinationFiles,
      destinationIndex,
      insertPoint,
      movingFileUpperUri,
      uniqueId
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
            file[1] === vscode.FileType.Directory)
      );

      // 移動元のフォルダーの中のファイルに連番を付与します
      await addSequentialNumberToFiles(
        currentMovingFileUpperUri,
        movingFiles,
        -1,
        insertPoint,
        movingFileUpperUri,
        uniqueId
      );
    }
  } catch (error) {
    // エラーハンドリング
    if (error instanceof Error) {
      vscode.window.showErrorMessage(
        `ファイルの移動中にエラーが発生しました ${error.message}`
      );
    } else {
      vscode.window.showErrorMessage(
        `ファイルの移動中にエラーが発生しました: ${String(error)}`
      );
    }
  }

  isFileOperating = false;
  // ツリービューの更新
  const draftWebViewProvider = getDraftWebViewProviderInstance();
  draftWebViewProvider.loadTreeData(draftWebViewProvider._webviewView!.webview);
}

// MARK: ファイル通し番号
// ファイルとフォルダーにdestinationUriとinsertPointで示される位置の番号を抜いた連番をつける関数
async function addSequentialNumberToFiles(
  targetUri: vscode.Uri,
  destinationFiles: [string, vscode.FileType][],
  destinationIndex: number,
  insertPoint: "before" | "inside" | "after",
  movingFileUpperUri: vscode.Uri,
  uniqueId?: string
) {
  console.log("sort!");

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
      console.log("移動中ファイル発見？", fileName, uniqueId);
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
      "0"
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
      // console.log(`ファイル名変更" ${oldUri} to ${newUri}`);
      // まずエディターでファイルを閉じます
      await closeFileInEditor(oldUri);
      await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: true });
    } catch (error) {
      console.error(
        `ファイル名の修正に失敗しました rename ${oldUri} to ${newUri}: ${error}`
      );
    }
  }

  if (uniqueId) {
    // UUIDの削除
    try {
      const uidHandlerRegex = new RegExp(`^moving-${uniqueId}-(.+)`);
      const movingFilesUri = vscode.Uri.joinPath(targetUri, movigFileName);
      const movingFilesNewUri = vscode.Uri.joinPath(
        targetUri,
        movigFileName.replace(uidHandlerRegex, "$1")
      );
      console.log("移動中ファイルのUIDつきファイル名", movigFileName);
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
        "workbench.action.closeActiveEditor"
      );
    }
  }
}

// MARK: ファイルのリネーム
async function renameFile(targetPath: string, newName: string) {
  const targetFileUri = vscode.Uri.file(targetPath);
  // const newFileName = newName;
  const oldFileName = path.basename(targetPath);
  const targetFileDir = vscode.Uri.file(path.dirname(targetPath));
  const newFileName = oldFileName.replace(
    /^(\d+[-_\s]*)*(.+?)(\.(txt|md))?$/,
    `$1${newName}$3`
  );
  const newFieUri = vscode.Uri.joinPath(targetFileDir, newFileName);
  try {
    await vscode.workspace.fs.rename(targetFileUri, newFieUri, {
      overwrite: true,
    });
  } catch (error) {
    vscode.window.showErrorMessage(
      `${oldFileName}を${newFileName}に書き換えることができませんでした`
    );
  }
  const draftWebViewProvider = getDraftWebViewProviderInstance();
  draftWebViewProvider.loadTreeData(draftWebViewProvider._webviewView!.webview);
}
