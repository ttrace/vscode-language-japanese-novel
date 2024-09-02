import * as vscode from "vscode";
import * as path from "path";
import { draftRoot, draftsObject, resetCounter } from "./compile";
import { getDraftWebViewProviderInstance } from "./extension";
import { v4 as uuidv4 } from "uuid";

export class DraftWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "draftTree";
  private _context: vscode.ExtensionContext;
  public _webviewView?: vscode.WebviewView;

  private watch: vscode.FileSystemWatcher;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    // ファイルシステムの監視を設定
    this.watch = vscode.workspace.createFileSystemWatcher("**/*.txt");
    this.watch.onDidChange(this.handleFileSystemEvent, this);
    this.watch.onDidCreate(this.handleFileSystemEvent, this);
    this.watch.onDidDelete(this.handleFileSystemEvent, this);

    // エディターが変更されたときにwebviewにメッセージを送信
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (this._webviewView) {
        this._webviewView.webview.postMessage({ command: "clearHighlight" });
      }
    });
  }

  private handleFileSystemEvent(uri: vscode.Uri) {
    console.log("File system event detected:", uri);
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
      if (message.command === "loadTreeData") {
        this.loadTreeData(webviewView.webview);
        console.log("Treeからデータ取得依頼");
      } else if (message.command === "openFile") {
        const uri = vscode.Uri.file(message.filePath);
        await vscode.commands.executeCommand("vscode.open", uri);
      } else if (message.command === "log") {
        console.log(message.log);
      } else if (message.command === "moveCommmand") {
        console.log(message.fileTransferData);
        moveAndReorderFiles(
          message.fileTransferData.destinationPath,
          message.fileTransferData.insertPoint,
          message.fileTransferData.movingFileDir
        );
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

  private refreshWebview() {
    if (this._webviewView) {
      this.loadTreeData(this._webviewView.webview);
    }
  }
}

async function moveAndReorderFiles(
  destinationPath: string,
  insertPoint: "before" | "after",
  movingFileDir: string
) {
  // ワークスペースフォルダを取得します
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return vscode.window.showErrorMessage(
      "ワークスペースを開いていない時は、ファイルの並び替えは行いません"
    );
  }

  // パスをURIに変換
  const destinationUri = vscode.Uri.file(destinationPath);
  const movingFileUri = vscode.Uri.file(movingFileDir);

  // 上位ディレクトリURIを返す変数を作成
  const destinationUpperUri = vscode.Uri.file(
    vscode.Uri.joinPath(destinationUri, "..").fsPath
  );
  const movingFileUpperUri = vscode.Uri.file(
    vscode.Uri.joinPath(movingFileUri, "..").fsPath
  );

  try {
    // 移動先ディレクトリの内容を読み取ります。
    let destinationFiles = await vscode.workspace.fs.readDirectory(
      destinationUpperUri
    );

    // destinationPathがdestinationFilesの何番目にあるかを見つけます
    const destinationIndex = destinationFiles.findIndex(
      (file) =>
        vscode.Uri.joinPath(destinationUpperUri, file[0]).fsPath ===
        destinationUri.fsPath
    );

    // ファイルを移動元ディレクトリから移動先ディレクトリに移動させます。
    // まずエディターでファイルを閉じます
    await closeFileInEditor(movingFileUri);

    // 移動用のUUIDを作成
    const uniqueId = uuidv4();

    const fileName = path.basename(movingFileDir);
    const fileIndex = insertPoint == "before" ? 1 : destinationIndex + 1;
    const digits = destinationFiles.length.toString().length;

    await vscode.workspace.fs.copy(
      movingFileUri,
      vscode.Uri.joinPath(
        destinationUpperUri,
        `moving-${uniqueId}-${String(fileIndex).padStart(digits, '0')}-${fileName.replace(/^\d+[-_]/, "")}`
      ),
      { overwrite: true }
    );
    await vscode.workspace.fs.delete(movingFileUri, { recursive: true });

    // 移動先ディレクトリの内容を読み取ります。
    destinationFiles = await vscode.workspace.fs.readDirectory(
      destinationUpperUri
    );

    // ファイル名に連番を付与して移動させる関数を呼び出します
    await addSequentialNumberToFiles(
      destinationUpperUri,
      destinationFiles,
      destinationIndex,
      insertPoint,
      uniqueId
    );

    // 移動元ディレクトリの内容を読み取ります。
    const movingFiles = await vscode.workspace.fs.readDirectory(
      movingFileUpperUri
    );

    // 削除したフォルダーの連番化
    await addSequentialNumberToFiles(
      movingFileUpperUri,
      movingFiles,
      -1,
      insertPoint
    );
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
}

// ファイルとフォルダーにdestinationUriとinsertPointで示される位置の番号を抜いた連番をつける関数
async function addSequentialNumberToFiles(
  destinationUpperUri: vscode.Uri,
  destinationFiles: [string, vscode.FileType][],
  destinationIndex: number,
  insertPoint: "before" | "after",
  uniqueId?: string
) {
  console.log("sort!");
  const draftWebViewProvider = getDraftWebViewProviderInstance();

  let fileIndex = 1;
  // ディレクトリ内のファイルとフォルダの名前を変更
  //スキップするindex beforeなら0、afterならdestinationIndexの一つ後ろ
  const skipIndex = insertPoint === "before" ? 0 : destinationIndex + 1;

  // ドラッグ元が削除されたフォルダーの連番やり直し
  const postNumbering = destinationIndex == -1 ? true : false;
  let movigFileName = "";

  for (let i = 0; i < destinationFiles.length; i++) {
    let fileName = destinationFiles[i][0];
    const fileType = destinationFiles[i][1];

    if (fileName.startsWith("moving-")) {
      console.log("移動中ファイル発見？", fileName, uniqueId);
      movigFileName = fileName;
      continue;
    }

    // フォルダーまたは .txt ファイルでない場合はスキップします
    if (fileType !== vscode.FileType.Directory && !fileName.endsWith(".txt")) {
      continue;
    }

    // 挿入ポイント
    if (i == skipIndex && !postNumbering) {
      fileIndex++;
    }

    const oldUri = vscode.Uri.joinPath(destinationUpperUri, fileName);

    
    // 先頭に /(^\d+[-_])/ の形式がある場合、それを削除します
    fileName = fileName.replace(/^\d+[-_]/, "");

    const digits = destinationFiles.length.toString().length;
    const newFileName = `${String(fileIndex).padStart(digits, '0')}-${fileName}`;
    fileIndex++;

    const newUri = vscode.Uri.joinPath(destinationUpperUri, newFileName);

    try {
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
      const movingFilesUri = vscode.Uri.joinPath(
        destinationUpperUri,
        movigFileName
      );
      const movingFilesNewUri = vscode.Uri.joinPath(
        destinationUpperUri,
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
  // ツリービューの更新
  draftWebViewProvider.loadTreeData(draftWebViewProvider._webviewView!.webview);
}

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
