import * as vscode from "vscode";
import * as http from "http";
import * as net from "net";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { Server, WebSocket } from "ws";
import { getConfig } from "./config";
import compileDocs, { draftRoot } from "./compile";
import { draftsObject } from "./compile"; // filelist オブジェクトもある
import { draftTreeProvider } from "./novel";
import { CharacterCounter, CharacterCounterController } from "./charactorcount";
export * from "./charactorcount";
import { editorText, previewBesideSection, MyCodelensProvider } from "./editor";
import { activateTokenizer, changeTenseAspect, addRuby } from "./tokenize";
import { exportpdf, previewpdf } from "./pdf";

//リソースとなるhtmlファイル
//let html: Buffer;
let documentRoot: vscode.Uri;
let WebViewPanel = false;
let servicePort = 8080;
let previewRedrawing = false;
export let deadlineFolderPath: string;
export let deadlineTextCount: string;

emptyPort(function (port: number) {
  servicePort = port;
  // console.log('真の空きポート',port);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emptyPort(callback: any) {
  let port = 8080;

  const socket = new net.Socket();
  const server = new net.Server();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  socket.on("error", function (e) {
    console.log("try:", port);
    server
      .on("listening", () => {
        server.close();
        console.log("ok:", port);
        callback(port);
      })
      .on("error", () => {
        console.log("ng:", port);
        loop();
      })
      .listen(port, "127.0.0.1");
  });

  function loop() {
    port = port + 2;
    if (port >= 20000) {
      callback(new Error("empty port not found"));
      return;
    }

    socket.connect(port, "127.0.0.1", function () {
      socket.destroy();
      loop();
    });
  }
  loop();
}

export function activate(context: vscode.ExtensionContext): void {
  //コマンド登録
  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.compile-draft", compileDocs)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.vertical-preview", verticalpreview)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.export-pdf", exportpdf)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.preview-pdf", previewpdf)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "Novel.launch-preview-server",
      launchHeadlessServer
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "Novel.change-tenseAspect",
      changeTenseAspect
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.add-ruby", addRuby)
  );

  const draftNodeTreeProvider = new draftTreeProvider();
  vscode.window.registerTreeDataProvider(
    "draftTreePanel",
    draftNodeTreeProvider
  );

  vscode.commands.registerCommand("draftTree.refresh", () =>
    draftNodeTreeProvider.refresh()
  );

  // 品詞ハイライトの初期化
  const kuromojiPath = context.extensionPath + "/node_modules/kuromoji/dict";
  activateTokenizer(context, kuromojiPath);

  // 文字数カウントの初期化
  const characterCounter = new CharacterCounter(context);
  const controller = new CharacterCounterController(characterCounter);
  context.subscriptions.push(controller);
  context.subscriptions.push(characterCounter);

  // 前回記録したテキスト総数と記録日
  
  // 前日までの進捗が存在しなかった時の処理
  // 進捗がなかった場合、現在の文字数を前日分として比較対象にする。
  if (typeof context.workspaceState.get("totalCountPrevious") != "number") {
    console.log("ステータス初回保存");
    //現在の文字総数を保存
    context.workspaceState.update(
      "totalCountPrevious",
      characterCounter.totalCountPrevious
    );
    //前日の日付を保存
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);

    context.workspaceState.update(
      "totalCountPreviousDate",
      yesterday
    );
  }

  const ifTest = false;
  //テスト用
  if(ifTest){
    context.workspaceState.update("totalCountPrevious", undefined);
    context.workspaceState.update("totalCountPreviousDate", undefined);
  }

  console.log("前日の執筆数", context.workspaceState.get("totalCountPrevious"));
  console.log(
    "前日",
    context.workspaceState.get("totalCountPreviousDate")
  );

  const storedTotalCount = context.workspaceState.get("totalCountPrevious");
  characterCounter.totalCountPrevious =
    typeof storedTotalCount == "number"
      ? storedTotalCount
      : characterCounter.totalCountPrevious;

  const storedTotalCountDate = context.workspaceState.get(
    "totalCountPreviousDate"
  );
  characterCounter.totalCountPreviousDate =
    typeof storedTotalCountDate == "number"
      ? new Date(storedTotalCountDate)
      : new Date(new Date());

  // 前回記録した締切テキスト総数と記録日
  const storedDeadlineCount = context.workspaceState.get("totacCountDeadline");
  characterCounter.deadlineCountPrevious =
    typeof storedDeadlineCount == "string" ? parseInt(storedDeadlineCount) : 0;
  const storedDeadlineCountDate = context.workspaceState.get(
    "totalCountDeadlineDate"
  );
  characterCounter.deadlineCountPreviousDate =
    typeof storedDeadlineCountDate == "number"
      ? storedDeadlineCountDate
      : new Date(new Date()).getDate() - 1;

  const deadLineFolderPath = context.workspaceState.get("deadlineFolderPath");
  const deadLineTextCount = context.workspaceState.get("deadlineTextCount");
  console.log("memento", deadLineFolderPath, deadLineTextCount);
  if (
    typeof deadLineFolderPath == "string" &&
    typeof deadLineTextCount == "string"
  ) {
    characterCounter._setCounterToFolder(
      deadLineFolderPath,
      parseInt(deadLineTextCount)
    );
  }

  //締め切りカウンター
  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.set-counter", async (e) => {
      let path = e.collapsibleState ? e.resourceUri.path : e.fsPath;
      if (draftRoot().match(/^[a-z]:\\/)) {
        path = path.replace(/^\//, "").split("/").join("\\");
      }
      let currentLength = 0;
      draftsObject(path).forEach((element) => {
        currentLength += element.length;
      });

      // InputBoxを呼び出す。awaitで完了を待つ。
      let result = await vscode.window.showInputBox({
        prompt: `設定する文字数を入力してください。数字を入力せずにEnterを押すと締め切りフォルダーの設定を解除します`,
        placeHolder: `現在の文字数：${currentLength}`,
      });
      // ここで入力を処理する
      if (result) {
        try {
          parseInt(result);
          // 入力が正常に行われている
          context.workspaceState.update("deadlineFolderPath", path);
          context.workspaceState.update("deadlineTextCount", result);
          deadlineFolderPath = path;
          deadlineTextCount = result;
          console.log("saving memento", deadlineFolderPath, deadlineTextCount);
          characterCounter._setCounterToFolder(path, parseInt(result));

          vscode.window.showInformationMessage(
            `目標の文字数を: ${result}文字に設定しました`
          );
        } catch (error) {
          vscode.window.showWarningMessage(`数字を入力してください`);
          result = "0";
        }
      } else {
        // 入力がキャンセルされた
        vscode.window.showWarningMessage(`目標文字数は設定しません`);
        characterCounter._setCounterToFolder("", 0);
        context.workspaceState.update("deadlineFolderPath", null);
        context.workspaceState.update("deadlineTextCount", null);
        deadlineFolderPath = "";
        deadlineTextCount = "";

        result = "0";
      }
      //ツリービュー更新
      vscode.commands.executeCommand("draftTree.refresh");
    })
  );

  documentRoot = vscode.Uri.joinPath(context.extensionUri, "htdocs");

  context.subscriptions.push(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vscode.commands.registerCommand("Novel.openfile", (args: any) => {
      vscode.commands.executeCommand("vscode.open", args);
    })
  );
  const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    { language: "novel", scheme: "file" },
    new MyCodelensProvider()
  );

  context.subscriptions.push(codeLensProviderDisposable);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  vscode.workspace.onDidOpenTextDocument((e) => {
    const editor = vscode.window.activeTextEditor;
    if (typeof editor != "undefined") {
      latestEditor = editor;
      console.log("editor changed!");
    }
    if (editor?.document.languageId == "novel") {
      previewBesideSection(editor);
    }
  });
}

let latestEditor: vscode.TextEditor;

function launchserver(originEditor: vscode.TextEditor) {
  latestEditor = originEditor;
  console.log("サーバー起動", latestEditor);

  //Webサーバの起動。ドキュメントルートはnode_modules/novel-writer/htdocsになる。
  const viewerServer = http.createServer(function (request, response) {
    const Response = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      "200": function (file: Buffer, filename: string) {
        //const extname = path.extname(filename);
        const header = {
          "Access-Control-Allow-Origin": "*",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        };

        response.writeHead(200, header);
        response.write(file, "binary");
        response.end();
      },
      "404": function () {
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.write("404 Not Found\n");
        response.end();
      },
      "500": function (err: unknown) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.write(err + "\n");
        response.end();
      },
    };

    const uri = request.url;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let filename = path.join(documentRoot.fsPath, uri!);

    fs.stat(filename, (err, stats) => {
      console.log(filename + " " + stats);
      if (err) {
        Response["404"]();
        return;
      }
      if (fs.statSync(filename).isDirectory()) {
        filename += "/index.html";
      }

      fs.readFile(filename, function (err, file) {
        if (err) {
          Response["500"](err);
          return;
        }
        Response["200"](file, filename);
      });
    });
  });

  viewerServer.listen(servicePort);

  // Node Websockets Serverを起動する
  const wsServer = WebSocket.Server;
  const s = new wsServer({ port: servicePort + 1 });

  s.on("connection", (ws) => {
    //console.log(previewvariables());
    ws.on("message", (messageRaw, isBinary) => {
      //const messageAsString = JSON.stringify(messageRaw);
      const message = isBinary ? messageRaw : messageRaw.toString();

      console.log("Received: " + message);

      if (message == "hello") {
        //通信確立
        ws.send(JSON.stringify(getConfig()));
        ws.send(editorText(originEditor));
      } else if (message == "givemedata") {
        // データ送信要求を受け取った時
        console.log("sending body");
        ws.send(editorText(originEditor));
      } else if (message == "redrawFinished") {
        // 再描画終了を受け取った時
        previewRedrawing = false;
        if (keyPressStored) publishWebsocketsDelay.presskey(s);
      } else if (message == "giveMeObject") {
        // メタデータ送信要求を受け取った時
        const sendingObjects = draftsObject(draftRoot());
        console.log("send:", sendingObjects);
        ws.send(JSON.stringify(sendingObjects));
      } else if (
        typeof message == "string" &&
        message.match(/^{"label":"jump"/)
      ) {
        const messageObject = JSON.parse(message);
        //行のタップを検知した時
        //const originalEditor = vscode.window.activeTextEditor;

        const targetLine = parseInt(messageObject.id.split("-")[1]);
        const targetPosition = new vscode.Position(
          targetLine,
          messageObject.cursor
        );
        latestEditor.selection = new vscode.Selection(
          targetPosition,
          targetPosition
        );

        latestEditor.revealRange(
          latestEditor.selection,
          vscode.TextEditorRevealType.InCenter
        );
        vscode.window.showTextDocument(
          latestEditor.document,
          latestEditor.viewColumn
        );
        ws.send(editorText(latestEditor));
      }
    });
  });

  vscode.workspace.onDidChangeTextDocument((e) => {
    let _a;
    if (
      e.document ==
      ((_a = vscode.window.activeTextEditor) === null || _a === void 0
        ? void 0
        : _a.document)
    ) {
      const editor = vscode.window.activeTextEditor;
      if (typeof editor != "undefined") {
        latestEditor = editor;
        console.log("editor changed!");
      }
      if (
        editor?.document.languageId == "novel" ||
        editor?.document.languageId == "markdown" ||
        editor?.document.languageId == "plaintext"
      ) {
        publishWebsocketsDelay.presskey(s);
      }
    }
  });

  vscode.window.onDidChangeTextEditorSelection((e) => {
    if (e.textEditor == vscode.window.activeTextEditor) {
      const editor = vscode.window.activeTextEditor;
      if (typeof editor != "undefined") {
        latestEditor = editor;
        console.log("editor changed!");
      }
      if (
        editor?.document.languageId == "novel" ||
        editor?.document.languageId == "markdown" ||
        editor?.document.languageId == "plaintext"
      ) {
        publishWebsocketsDelay.presskey(s);
      }
    }
  });

  vscode.workspace.onDidChangeConfiguration(() => {
    //設定変更
    console.log("setting changed");
    sendsettingwebsockets(s);
  });

  vscode.window.onDidChangeVisibleTextEditors((e) => {
    //ウインドウの状態変更
    //プレビューが閉じたかどうか
    console.log("WindowState Changed:", e);
  });

  publishWebsocketsDelay.presskey(s);

  const serversHostname = os.hostname();
  if (WebViewPanel) {
    //    vscode.window.showInformationMessage('Hello, world!');
    const panel = vscode.window.createWebviewPanel(
      "preview", // Identifies the type of the webview. Used internally
      "原稿プレビュー http://" + serversHostname + ":" + servicePort, // Title of the panel displayed to the user
      vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
      {
        enableScripts: true,
      } // Webview options. More on these later.
    );

    panel.webview.html = `<!DOCTYPE html>
  <html>
      <head>
          <style>
          body{
              width:100vw;
              height:100vh;
              padding:0;
              overflow-y:hidden;
          }
          </style>
      </head>
      <body>
          <iframe src="http://localhost:${servicePort}" frameBorder="0" style="margin:none;width:100%;min-width: 100%; min-height: 100%" />
      </body>
  </html>`;
  } else {
    vscode.window.showInformationMessage(
      `http://${serversHostname}:${servicePort} でサーバーを起動しました`
    );
  }
}

function publishwebsockets(socketServer: { clients: WebSocket[] }) {
  socketServer.clients.forEach((client: WebSocket) => {
    client.send(editorText("active"));
  });
}

function sendsettingwebsockets(socketServer: Server<WebSocket>) {
  socketServer.clients.forEach((client: WebSocket) => {
    client.send(JSON.stringify(getConfig()));
  });
}

let keyPressStored = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const publishWebsocketsDelay: any = {
  publish: function (socketServer: { clients: WebSocket[] }) {
    publishwebsockets(socketServer);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  presskey: function (s: any) {
    if (previewRedrawing) {
      //リドロー中
      keyPressStored = true;
      return;
    }
    previewRedrawing = true;
    keyPressStored = false;
    this.publish(s);
  },
};

function verticalpreview() {
  const originEditor = vscode.window.activeTextEditor;
  WebViewPanel = true;
  if (typeof originEditor != "undefined") {
    launchserver(originEditor);
  }
}

function launchHeadlessServer() {
  const originEditor = vscode.window.activeTextEditor;
  if (typeof originEditor != "undefined") {
    launchserver(originEditor);
  }
}

function deactivate() {
  //
}

module.exports = { activate, deactivate };
