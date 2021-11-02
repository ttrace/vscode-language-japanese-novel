import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as websockets from 'ws';
import { getConfig } from './config';
import compileDocs, { draftRoot } from './compile'; 
import { fileList, draftsObject} from './compile'; 
import {CharacterCounter, CharacterCounterController} from './charactorcount';
import { editorText, OriginEditor } from './editor'
import { urlToOptions } from 'vscode-test/out/util';
import { eventNames } from 'process';
import { EventEmitter } from 'stream';

const output = vscode.window.createOutputChannel("Novel");
//リソースとなるhtmlファイル
let html: Buffer;
let documentRoot: vscode.Uri;
let WebViewPanel = false;

//コマンド登録
export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.commands.registerCommand('Novel.compile-draft', compileDocs));
    context.subscriptions.push(vscode.commands.registerCommand('Novel.vertical-preview', verticalpreview));
    context.subscriptions.push(vscode.commands.registerCommand('Novel.export-pdf', exportpdf));
    context.subscriptions.push(vscode.commands.registerCommand('Novel.launch-preview-server', launchserver));

    const characterCounter = new CharacterCounter();
    const controller = new CharacterCounterController(characterCounter);
    context.subscriptions.push(controller);
    context.subscriptions.push(characterCounter);
    context.subscriptions.push(vscode.commands.registerCommand('Novel.set-counter', async (e) => {
        const path = e.fsPath;
        let currentLength = 0
        
        draftsObject(path).forEach(element =>{
            currentLength += element.length;
        });

        // InputBoxを呼び出す。awaitで完了を待つ。
        let result = await vscode.window.showInputBox({
            prompt: '目標となる文字数を入力してください',
            placeHolder: `現在の文字数：${currentLength}`
        });
        // ここで入力を処理する
        if (result) {
            try{
                parseInt(result);
                // 入力が正常に行われている
                vscode.window.showInformationMessage(`目標の文字数を: ${result}文字に設定しました`);
            } catch (error){
                vscode.window.showWarningMessage(`数字を入力してください`);
                result = '0';
            }

        } else {
            // 入力がキャンセルされた
            vscode.window.showWarningMessage(`目標文字数は設定しません`);
            result = '0';
        }
        characterCounter._setCounterToFolder(path, parseInt(result!));
    }));

    documentRoot = vscode.Uri.joinPath(context.extensionUri, 'htdocs');
}


function launchserver(originEditor: OriginEditor){
    //もしサーバーが動いていたら止めて再起動する……のを、実装しなきゃなあ。
    //https://sasaplus1.hatenadiary.com/entry/20121129/1354198092 が良さそう。
    
    //Webサーバの起動。ドキュメントルートはnode_modules/novel-writer/htdocsになる。
    const viewerServer = http.createServer(function(request, response) {
        const Response = {
            "200":function(file: Buffer, filename:string){
                //const extname = path.extname(filename);
                const header = {
                    "Access-Control-Allow-Origin":"*",
                    "Pragma": "no-cache",
                    "Cache-Control" : "no-cache"       
                }
    
                response.writeHead(200, header);
                response.write(file, "binary");
                response.end();
            },
            "404":function(){
                response.writeHead(404, {"Content-Type": "text/plain"});
                response.write("404 Not Found\n");
                response.end();
    
            },
            "500":function(err:unknown){
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write(err + "\n");
                response.end();
    
            }
        }
    
        const uri = request.url;
        let filename = path.join(documentRoot.fsPath, uri!);
    
        fs.stat(filename, (err, stats) => {

            console.log(filename+" "+stats);
            if (err) { Response["404"](); return ; }
            if (fs.statSync(filename).isDirectory()) { filename += '/index.html'; }

            fs.readFile(filename, function(err, file){
            if (err) { Response["500"](err); return ; }
                Response["200"](file, filename);   
            }); 
        });
    })
    
    viewerServer.listen(8080);
    
    // Node Websockets Serverを起動する
    const wsServer = websockets.Server;
    const s = new wsServer({ port: 5001 });
    
    s.on("connection", ws => {
        //console.log(previewvariables());
        ws.on("message", message => {
    
            console.log("Received: " + message);

    
            if (message === "hello") {
                ws.send( JSON.stringify(getConfig()));
                //ws.send( editorText());
            } else if (message === "givemedata"){
                console.log("sending body");
                ws.send( editorText(originEditor));
            } else if (message === "giveMeObject"){
                const sendingObjects = draftsObject(draftRoot());
                console.log('send:',sendingObjects);
                ws.send( JSON.stringify(sendingObjects));
            }
        });
    });
    
    vscode.workspace.onDidChangeTextDocument((e) => {
        let _a;
        if (e.document == ((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document)) {
            const editor = vscode.window.activeTextEditor;
            if (editor?.document.languageId == "novel" || editor?.document.languageId == "markdown" || editor?.document.languageId == "plaintext") {
                publishWebsocketsDelay.presskey(s);
            }

        }
    });
    
    vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor == vscode.window.activeTextEditor) {
            const editor = vscode.window.activeTextEditor;
            if (editor?.document.languageId == "novel" || editor?.document.languageId == "markdown" || editor?.document.languageId == "plaintext") {
                publishWebsocketsDelay.presskey(s);
            }
        }
    });

    vscode.workspace.onDidChangeConfiguration(() => {
            //設定変更
            console.log('setting changed');
            sendsettingwebsockets(s);
    });

    vscode.window.onDidChangeVisibleTextEditors((e) => {
        //ウインドウの状態変更
        //プレビューが閉じたかどうか
        console.log('WindowState Changed:',e);
    });

    publishWebsocketsDelay.presskey(s);

    if(WebViewPanel){

    //    vscode.window.showInformationMessage('Hello, world!');
    const panel = vscode.window.createWebviewPanel(
        'preview', // Identifies the type of the webview. Used internally
        '原稿プレビュー', // Title of the panel displayed to the user
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
            <iframe src="http://localhost:8080" frameBorder="0" style="min-width: 100%; min-height: 100%" />
        </body>
    </html>`;

    panel.onDidDispose(() =>{
        console.log('closed');
        viewerServer.close(function() {
            console.log('HTTP サーバーを停止させました。');
          });
          s.close(function() {
            console.log('WebSockets サーバーを停止させました。');
          });
        });
    }
    
    return s;
}

function publishwebsockets(socketServer: websockets.Server){
    socketServer.clients.forEach((client: websockets) => {
        client.send(editorText("active"));
    }); 
}

function sendsettingwebsockets(socketServer: websockets.Server){
    socketServer.clients.forEach((client: websockets) => {
        client.send(( JSON.stringify(getConfig())));
    }); 
}

let keyPressFlag = false;

const publishWebsocketsDelay: any = {
    publish: function(socketServer: websockets.Server) {
        publishwebsockets(socketServer);
        keyPressFlag = false;
        delete this.timeoutID;
    },
    presskey: function(s: websockets.Server) {
        //this.cancel();
        if (!keyPressFlag){
            const currentEditor = vscode.window.activeTextEditor;
            if (currentEditor) {
                const updateCounter = Math.min(
                                        Math.ceil(currentEditor.document.getText().length / 50),
                                        1500
                                        );
                this.timeoutID = setTimeout(socketServer => {
                    this.publish(socketServer);
                }, updateCounter, s);
                keyPressFlag = true;
            }
        }
    },
    cancel: function() {
      if(typeof this.timeoutID == "number") {
        this.clearTimeout(this.timeoutID);
        delete this.timeoutID;
      }
    }
  };

function verticalpreview(){
    const originEditor = vscode.window.activeTextEditor;
    WebViewPanel = true;
    launchserver(originEditor);
/*
//    vscode.window.showInformationMessage('Hello, world!');
    const panel = vscode.window.createWebviewPanel(
        'preview', // Identifies the type of the webview. Used internally
        '原稿プレビュー', // Title of the panel displayed to the user
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
            <iframe src="http://localhost:8080" frameBorder="0" style="min-width: 100%; min-height: 100%" />
        </body>
    </html>`;

    panel.onDidDispose(() =>{
        console.log('closed');
    });

    */
}

function exportpdf(): void {
    const myHtml = getWebviewContent();
    if (!vscode.workspace.workspaceFolders) {
        output.appendLine(`not found workspace folders to publish.`);
        return;
    } else {
        const folderUri = vscode.workspace.workspaceFolders[0].uri;
        const myPath = vscode.Uri.joinPath(folderUri, 'publish.html');
        const myWorkingDirectory = folderUri;
        const vivlioCommand = 'vivliostyle';
        const vivlioSubCommand = 'build';

        output.appendLine(`starting to publish: ${myPath}`);
        const vivlioParams = [vivlioSubCommand, myPath.fsPath, '-o', vscode.Uri.joinPath(myWorkingDirectory, "output.pdf").fsPath];

        output.appendLine(`starting to publish: ${vivlioCommand} ${vivlioParams}`);
        const myHtmlBinary = Buffer.from(myHtml, 'utf8');

        vscode.workspace.fs.writeFile(myPath, myHtmlBinary).then(() => {
            output.appendLine(`saving pdf to ${vivlioCommand}`);
            cp.execFile(vivlioCommand, vivlioParams, (err, stdout, stderr) => {
                if (err) {
                    console.log(`stderr: ${stderr}`);
                    output.appendLine(`stderr: ${stderr}`);
                    return
                }
                output.appendLine(`stdout: ${stdout}`);
                output.appendLine('PDFの保存が終わりました');
            })
            output.appendLine('HTMLの書き込みが完了しました');
        });
    }
}



function deactivate() {
    return undefined;
}

module.exports = { activate, deactivate };

function getWebviewContent() {

    //configuration 読み込み
    const previewSettings = getConfig();
/*     const config = vscode.workspace.getConfiguration('Novel');
        let lineheightrate = 1.75;
        let fontfamily = config.get('preview.font-family');
        let fontsize = config.get('preview.fontsize');
        let numfontsize = parseInt(/(\d+)(\D+)/.exec(fontsize)[1]);
        let unitoffontsize = /(\d+)(\D+)/.exec(fontsize)[2];

        let linelength = config.get('preview.linelength');
        let linesperpage = config.get('preview.linesperpage');

        let pagewidth = ( linesperpage * numfontsize * lineheightrate * 1.003) + unitoffontsize;
        let pageheight = (linelength * numfontsize) + unitoffontsize;
        let lineheight = ( numfontsize * lineheightrate) + unitoffontsize;
  */       //console.log(lineheight);

    const myText = editorText("active");
    return `<!DOCTYPE html>
  <html lang="ja">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cat Coding</title>

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
      size: 105mm 148mm;
      width: 88mm;
      /*  width: calc(84mm - 1q); */
      height: 110mm;
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
      margin-right: 10mm;
      @top-left {
          content: counter(page) "  <$projecttitle>";
          margin-left: 12q;
          margin-top: 135mm;
          writing-mode: horizontal-tb;
          /* CSS仕様上は@pageルール内に書けばよいが、現時点のvivliostyle.jsの制限によりここに書く */
      }
      }
      @page :right {
      margin-right: 14mm;
      /* border-bottom: 1pt solid black; */
      /* 右下ノンブル */
      @top-right {
          content: "<$fullname>   "counter(page);
          margin-right: 12q;
          margin-top: 135mm;
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
        font-size: calc(110mm / ${previewSettings.lineLength});
        line height: 1.65;
        text-indent: 0em;
        hanging-punctuation: force-end;
        line-break:strict;
        page-break-inside: auto;
    }
 
      div.indent-1 p:first-of-type, div.indent-2 p:first-of-type, div.indent-3 p:first-of-type{
        padding-block-start: calc( ${previewSettings.fontSize} * ${previewSettings.lineHeightRate});
        }

        div.indent-1 p:last-of-type, div.indent-2 p:last-of-type, div.indent-3 p:last-of-type{
        padding-block-end: calc( ${previewSettings.fontSize} * ${previewSettings.lineHeightRate});
        }

    
    div.indent-1 p{
    height: calc( 110mm - (${previewSettings.fontSize}));
    padding-top: ${previewSettings.fontSize};
    }

    div.indent-2 p{
    height: calc( 110mm - (${previewSettings.fontSize} * 2));
    padding-top: calc(${previewSettings.fontSize} * 2);
    }

    div.indent-3 p{
    height: calc( 110mm - (${previewSettings.fontSize} * 3));
    padding-top: calc(${previewSettings.fontSize} * 3);
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

  @media screen{
      body {
            writing-mode: vertical-rl;
            font-family: ${previewSettings.fontFamily};
            height: ${previewSettings.pageHeight};
            overflow-y:hidden;
            padding:0;
        }
        
        #cursor {
            background-color: rgb(125,125,125,);
            animation-duration: 0.5s;
            animation-name: cursorAnimation;
            animation-iteration-count: infinite;
        }
  
        p {
            height: ${previewSettings.pageHeight};
            font-family: ${previewSettings.fontFamily};
            font-size: ${previewSettings.fontSize};
            margin:0 0 0 0;
            vertical-align: middle;
        }
          
        em.side-dot {
            font-style: normal;
            text-emphasis: filled sesame rgb(128,128,128);
            -webkit-text-emphasis: filled sesame rgb(128,128,128);
        }
        
        span.tcy {
            text-combine: horizontal;
            -webkit-text-combine:horizontal;
        }

        @keyframes cursorAnimation {
                from {
                    background-color: rgba(66,66,66,0);
                }
            
                to {
                    background-color: rgba(125,125,125,0.7);
                }
            }
  
          body{
              background-image:   linear-gradient(to right, rgba(50, 50, 50, 0.5) 0.5pt, rgba(0, 0, 50, 0.05) 10em);
              background-size:    ${previewSettings.pageWidth} ${previewSettings.pageHeight};
              background-repeat:  repeat-x;
              background-position: right 0px;
          }
          p{
              background-image:   linear-gradient( rgba(50, 50, 50, 1) 0.5pt, transparent 1pt),
                                  linear-gradient(to right, rgba(50, 50, 50, 1) 0.5pt, rgba(0, 0, 50, 0.05) 1pt);
              background-size:    ${previewSettings.lineHeight} ${previewSettings.fontSize},
                                  ${previewSettings.lineHeight} ${previewSettings.fontSize};
              background-repeat:  repeat,
                                  repeat;
              background-position: right 0px,
                                  right 0px;
          }

          div.indent-1 p{
            height: calc( ${previewSettings.pageHeight} - (${previewSettings.fontSize}));
            padding-top: ${previewSettings.fontSize};
            }
        
            div.indent-2 p{
            height: calc( ${previewSettings.pageHeight} - (${previewSettings.fontSize} * 2));
            padding-top: calc(${previewSettings.fontSize} * 2);
            }
        
            div.indent-3 p{
            height: calc( ${previewSettings.pageHeight} - (${previewSettings.fontSize} * 3));
            padding-top: calc(${previewSettings.fontSize} * 3);
            }

        
          span.comment{
            display:block;
            border-radius:1em;
            border:1.5pt solid rgba(70,70,00,0.9);
            padding:0.25em 0.25em;
            position:absolute;
            margin-right: -3em;
            margin-top: 0.5em;
            top: ${previewSettings.pageHeight};
            background-color:rgba(50,50,00,0.5);
            max-width: 20em;
          }

          span.comment::before{
            content: '';
            position: absolute;
            right: 1em;
            top: -15px;
            display: block;
            width: 0;
            height: 0;
            border-right: 15px solid transparent;
            border-bottom: 15px solid rgba(70,70,00,0.9);
            border-left: 15px solid transparent;
          }

          span.commentbody{
              margin:0.5em 1em;
              writing-mode:lr-tb;
              font-family:sans-serif;
              font-size:0.8em;
              line-height:1;
          }
  
      }
        </style>
      <link rel="stylesheet" href="">
  </head>
  <body>
  ${myText}
  
  <script>
  
  setTimeout( (function(){
      var width = document.body.clientWidth;
      var cursor = document.getElementById('cursor');
      var panelWidth = window.innerWidth;
      var scrollEnd = cursor.offsetLeft - width + (panelWidth / 2);
      window.scrollTo( scrollEnd , scrollEnd);
      console.log(width, cursor, panelWidth, scrollEnd);
  }), 1);

</script>
  </body>
  </html>`;
  }
