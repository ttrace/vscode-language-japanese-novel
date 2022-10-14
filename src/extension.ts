import * as vscode from "vscode";
import * as cp from "child_process";
import * as http from "http";
import * as net from "net";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as websockets from "ws";
import { getConfig } from "./config";
import compileDocs, { draftRoot } from "./compile";
import { draftsObject } from "./compile"; // filelist オブジェクトもある
import { CharacterCounter, CharacterCounterController } from "./charactorcount";
export * from "./charactorcount";
import { editorText, OriginEditor } from "./editor";
import {
  activateTokenizer,
  changeTenseAspect,
  desableTokenizer,
  enableTokenizer,
} from "./tokenize";

const output = vscode.window.createOutputChannel("Novel");
//リソースとなるhtmlファイル
//let html: Buffer;
let documentRoot: vscode.Uri;
let WebViewPanel = false;
let servicePort = 8080;
let previewRedrawing = false;

emptyPort(function (port: number) {
  servicePort = port;
  // console.log('真の空きポート',port);
});

function emptyPort(callback: any) {
  let port = 8080;

  const socket = new net.Socket();
  const server = new net.Server();

  socket.on("error", function (e) {
    console.log('try:', port);
    server.on('listening', () => {
      server.close();
      console.log('ok:', port);
      callback(port);
    }).on('error', () => {
      console.log('ng:', port);
      loop();
    }).listen(port, '127.0.0.1');
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

//コマンド登録
export function activate(context: vscode.ExtensionContext): void {
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
    vscode.commands.registerCommand("Novel.launch-preview-server", launchserver)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.hide-morpheme", async () =>{
      desableTokenizer(context);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.show-morpheme",  async () =>{
      enableTokenizer(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "Novel.change-tenseAspect",
      changeTenseAspect
    )
  );

  const kuromojiPath = context.extensionPath + "/node_modules/kuromoji/dict";
  activateTokenizer(context, kuromojiPath);

  //context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'novel'}, new DocumentSemanticTokensProvider(), legend));

  const characterCounter = new CharacterCounter();
  const controller = new CharacterCounterController(characterCounter);
  context.subscriptions.push(controller);
  context.subscriptions.push(characterCounter);

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

  context.subscriptions.push(
    vscode.commands.registerCommand("Novel.set-counter", async (e) => {
      const path = e.fsPath;
      let currentLength = 0;

      draftsObject(path).forEach((element) => {
        currentLength += element.length;
      });

      // InputBoxを呼び出す。awaitで完了を待つ。
      let result = await vscode.window.showInputBox({
        prompt:
          "文字数を入力してください　数字を入力せずにEnterを押すと現在の設定を解除します",
        placeHolder: `現在の文字数：${currentLength}`,
      });
      // ここで入力を処理する
      if (result) {
        try {
          parseInt(result);
          // 入力が正常に行われている
          context.workspaceState.update("deadlineFolderPath", path);
          context.workspaceState.update("deadlineTextCount", result);
          console.log("saving memento", path, result);
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

        result = "0";
      }
    })
  );

  documentRoot = vscode.Uri.joinPath(context.extensionUri, "htdocs");
}

let latestEditor: vscode.TextEditor;

function launchserver(originEditor: vscode.TextEditor) {
  //もしサーバーが動いていたらポートの番号をずらす
  latestEditor = originEditor;

  //Webサーバの起動。ドキュメントルートはnode_modules/novel-writer/htdocsになる。
  const viewerServer = http.createServer(function (request, response) {
    const Response = {
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
  const wsServer = websockets.Server;
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
      } else if (message == "giveMeObject") {
        // メタデータ送信要求を受け取った時
        const sendingObjects = draftsObject(draftRoot());
        console.log("send:", sendingObjects);
        ws.send(JSON.stringify(sendingObjects));
      } else if (typeof message == "string" && message.match(/^jump/)) {
        //行のタップを検知した時
        //const originalEditor = vscode.window.activeTextEditor;

        const targetLine = parseInt(message.split("-")[1]);
        const range = latestEditor.document.lineAt(targetLine).range;

        if (typeof range != "undefined") {
          console.log("go to line!");
          latestEditor.selection = new vscode.Selection(
            range?.start,
            range?.end
          );
          latestEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
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

  if (WebViewPanel) {
    //    vscode.window.showInformationMessage('Hello, world!');
    const serversHostname = os.hostname();
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
              overflor:hidden;
          }
          </style>
      </head>
      <body>
          <iframe src="http://localhost:${servicePort}" frameBorder="0" style="min-width: 100%; min-height: 100%" />
      </body>
  </html>`;
  }
}

function publishwebsockets(socketServer: websockets.Server) {
  socketServer.clients.forEach((client: websockets) => {
    client.send(editorText("active"));
  });
}

function sendsettingwebsockets(socketServer: websockets.Server) {
  socketServer.clients.forEach((client: websockets) => {
    client.send(JSON.stringify(getConfig()));
  });
}

//let keyPressFlag = false;
const publishWebsocketsDelay: any = {
  publish: function (socketServer: websockets.Server) {
    publishwebsockets(socketServer);
  },
  presskey: function (s: websockets.Server) {
    if (previewRedrawing) return;
    previewRedrawing = true;
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

function exportpdf(): void {
  const myHtml = getPrintContent();
  if (!vscode.workspace.workspaceFolders) {
    output.appendLine(`not found workspace folders to publish.`);
    return;
  } else {
    const folderUri = vscode.workspace.workspaceFolders[0].uri;
    const myPath = vscode.Uri.joinPath(folderUri, "publish.html");
    const myWorkingDirectory = folderUri;
    const vivlioCommand = "vivliostyle";
    const vivlioSubCommand = "build";

    output.appendLine(`starting to publish: ${myPath}`);
    const vivlioParams = [
      vivlioSubCommand,
      myPath.fsPath,
      "-o",
      vscode.Uri.joinPath(myWorkingDirectory, "output.pdf").fsPath,
    ];

    output.appendLine(`starting to publish: ${vivlioCommand} ${vivlioParams}`);
    const myHtmlBinary = Buffer.from(myHtml, "utf8");

    vscode.workspace.fs.writeFile(myPath, myHtmlBinary).then(() => {
      output.appendLine(`saving pdf to ${vivlioCommand}`);
      vscode.window.showInformationMessage(`PDF出力開始……`);

      cp.execFile(vivlioCommand, vivlioParams, (err, stdout, stderr) => {
        if (err) {
          console.log(`エラー: ${err.message}`);
          output.appendLine(`エラー: ${err.message}`);
          return;
        }
        output.appendLine(`ファイル名: ${stdout}`);
        output.appendLine("PDFの保存が終わりました");
        vscode.window.showInformationMessage(`PDFの保存が終わりました`);
      });
      output.appendLine("HTML");
    });
  }
}

function deactivate() {
  //
}

module.exports = { activate, deactivate };

function getPrintContent() {
  //configuration 読み込み

  const myText = editorText("active");
  const previewSettings = getConfig();
  const printBoxHeight = 140;
  const printBoxWidth = 100;
  const fontSize =
    previewSettings.lineLength > previewSettings.linesPerPage * 1.75
      ? printBoxHeight / previewSettings.lineLength
      : printBoxWidth / (previewSettings.linesPerPage * 1.75);
  // フォントサイズ in mm
  const fontSizeWithUnit = fontSize + "mm";
  const lineHeightWithUnit = fontSize * 1.75 + "mm";
  const projectTitle = vscode.workspace.workspaceFolders![0].name;
  const typeSettingHeight = fontSize * previewSettings.lineLength;
  const typeSettingHeightUnit = typeSettingHeight + "mm";
  const typeSettingWidth = fontSize * 1.75 * previewSettings.linesPerPage;
  const typeSettingWidthUnit = typeSettingWidth + "mm";
  const columnCount = Math.floor(printBoxHeight / typeSettingHeight);

  return `<!DOCTYPE html>
  <html lang="ja">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${projectTitle}</title>

      <style>
      @charset "UTF-8";
      html {
      /* 組み方向 */
      -epub-writing-mode: vertical-rl;
      -ms-writing-mode: tb-rl;
      writing-mode: vertical-rl;
  
      orphans: 1;
      widows: 1;
      }
  
      * {
      margin: 0;
      padding: 0;
      }
  
      @page {
      size: 130mm 190mm;
      width: calc(${typeSettingWidthUnit} + 0.5mm);
      height: calc(140mm + 0.5mm);
      margin-top: 20mm;
      margin-bottom: auto;
      margin-left: auto;
      margin-right: auto;
      /* 以下、マージンボックスに継承される */
      font-size: 6pt;
      font-family: "游明朝", "YuMincho", serif;
      /* 本来不要（<span class="smaller"><span class="smaller">ルート要素の指定が継承される</span></span>）だが、現時点のvivliostyle.jsの制限により必要 */
      vertical-align: top;
      }
  
      @page :left {
      margin-right: 15mm;
      @top-left {
          content: counter(page) "  ${projectTitle}";
          margin-left: 0mm;
          margin-top: 170mm;
          writing-mode: horizontal-tb;
          /* CSS仕様上は@pageルール内に書けばよいが、現時点のvivliostyle.jsの制限によりここに書く */
      }
      }
      @page :right {
      margin-right: 15mm;
      /* border-bottom: 1pt solid black; */
      /* 右下ノンブル */
      @top-right {
          content: " ${projectTitle}  "counter(page);
          margin-right: 0mm;
          margin-top: 170mm;
          writing-mode: horizontal-tb;
          /* CSS仕様上は@pageルール内に書けばよいが、現時点のvivliostyle.jsの制限によりここに書く */
      }
      }
  
      html {
      font-family: "游明朝", "YuMincho", serif;
      font-weight: Medium;
      text-align: justify;
      }
  
      body{
        column-count: ${columnCount};
      }
  
      div#draft{

      }

      h1 {
      /* フォント */
      font-weight: Extrabold;
      /* フォントサイズ */
      font-size: 24q;
      /* 字下げ */
      text-indent: 0;
      /* 直後の改ページ・改段禁止 */
      page-break-before: always;
      page-break-after: always;
      line-height: 42q;
      letter-spacing: 0.25em;
      display: flex;
      align-items: center;
      }
  
      h2 {
      /* フォント */
      font-weight: Demibold;
      /* フォントサイズ */
      font-size: 16q;
      /* 字下げ */
      text-indent: 3em;
      /* 直後の改ページ・改段禁止 */
      page-break-before: always;
      page-break-after: avoid;
      line-height: 42q;
      margin-left: 2em;
      }
  
      h2.part {
      width: 80mm;
      padding: 0mm 35mm;
      font-weight: bold;
      font-size: 16q;
      page-break-before: always;
      page-break-after: always;
      margin-left: 4em;
      }
  
      h1 + h2 {
      margin-right: 16pt;
      }
  
      ruby > rt {
      font-size: 6.5q;
      }
  
      p {
        font-size: ${fontSizeWithUnit};
        line-height: 1.75;
        height: calc(${fontSizeWithUnit} * ${previewSettings.lineLength} + 0.5mm);
        text-indent: 0em;
        hanging-punctuation: force-end;
        line-break:strict;
        page-break-inside: auto;
      }

    div.indent-1 p:first-of-type, div.indent-2 p:first-of-type, div.indent-3 p:first-of-type{
      padding-block-start: calc( ${fontSizeWithUnit} * ${previewSettings.lineHeightRate});
      }

      div.indent-1 p:last-of-type, div.indent-2 p:last-of-type, div.indent-3 p:last-of-type{
      padding-block-end: calc( ${fontSizeWithUnit} * ${previewSettings.lineHeightRate});
      }

    
    div.indent-1 p{
    height: calc( 110mm - (100vh * ${previewSettings.fontSize}));
    padding-top: calc( ${fontSizeWithUnit});
    }

    div.indent-2 p{
    height: calc( 110mm - (100vh * ${previewSettings.fontSize} * 2));
    padding-top: calc(${fontSizeWithUnit} * 2);
    }

    div.indent-3 p{
    height: calc( 110mm - (${fontSizeWithUnit} * 3));
    padding-top: calc(${fontSizeWithUnit} * 3);
    }

    p.goth {
    margin-top: 3em;
    font-family: "游ゴシック", "YuGothic", san-serif;
    margin-block-start: 1em;
    margin-block-end: 1em;
    }

    p.align-rb {
    text-align: right;
    }

    p.goth + p.goth {
    margin-block-start: -1em;
    }

    div.codes {
    display: inline-block;
    margin: 3em 1em;
    writing-mode: horizontal-tb;
    padding: 1em;
    font-family: "Courier", monospace;
    font-size: 0.8em;
    }
  
    div.codes p {
    text-orientation: sideways;
    }

    p.star {
    text-indent: 3em;
    margin-right: 16pt;
    margin-left: 16pt;
    }

    hr {
    border: none;
    border-right: 1pt solid black;
    height: 6em;
    margin: auto 8.5pt;
    }

    /* 縦中横 */
    .tcy {
    -webkit-text-combine: horizontal;
    text-combine: horizontal;
    -ms-text-combine-horizontal: all;
    text-combine-horizontal: digit 2;
    text-combine-upright: digit 2;
    }

    /* 圏点（<span class="smaller">ゴマ</span>） */
    em.side-dot, em.sesame_dot {
    font-style: normal;
    -webkit-text-emphasis-style: sesame;
    text-emphasis-style: sesame;
    margin-right: -1em;
    display: inline-block;
    }

    /*著作者*/
    .author {
    position: absolute;
    bottom: 0;
    font-size: 8.5pt;
    margin-top: 50pt;
    letter-spacing: normal;
    }

    /*画像＋キャプション*/
    figure {
    display: block;
    width: 236pt;
    -ms-writing-mode: lr-tb;
    -webkit-writing-mode: horizontal-tb;
    writing-mode: horizontal-tb;
    }

    figure img {
    width: 100%;
    height: auto;
    vertical-align: bottom;
    }

    figcaption {
    text-align: left;
    font-size: 7pt;
    }

    /*奥付*/
    .colophon {
    font-size: 7pt;
    margin-right: 48pt;
    }
    /* 級さげ */
    span.smaller{
        font-size:6.5pt
    }
  
    div.comment {
        display:none;
    }

    p.blank {
        color:transparent;
    }
    </style>

  </head>
  <body>
  <div id="draft">
  ${myText}
  </div>
  </body>
  </html>`;
}
