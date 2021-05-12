const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

var myeditor = vscode.window.activeTextEditor;
const output = vscode.window.createOutputChannel("Novel");

let html = "";

//コマンド登録
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('Novel.vertical-preview', verticalpreview));
    context.subscriptions.push(vscode.commands.registerCommand('Novel.export-pdf', exportpdf));
    context.subscriptions.push(vscode.commands.registerCommand('Novel.launch-preview-server', launchserver));

    html = fs.readFileSync(path.join(context.extensionPath, 'htdocs', 'index.html'));
}


function launchserver(origineditor){
    //もしサーバーが動いていたら止めて再起動する……のを、実装しなきゃなあ。
    //https://sasaplus1.hatenadiary.com/entry/20121129/1354198092 が良さそう。


    
    // Node http serverを起動する
    const http = require('http');
    const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
//    const html = fs.readFileSync(path.join(folderPath, 'htdocs/index.html'));
    


    var viwerserver = http.createServer(function(request, response) {
        response.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'private, max-age=0'
        });
        response.end(html);
    })
    
    viwerserver.listen(8080);
    
    // Node Websockets Serverを起動する
    const wsserver = require("ws").Server;
    const s = new wsserver({ port: 5001 });
    
    s.on("connection", ws => {
        //console.log(previewvariables());
        ws.on("message", message => {
    
            console.log("Received: " + message);
            console.log(getConfig());
    
            if (message === "hello") {
                ws.send( JSON.stringify(getConfig()));
                //ws.send( editorText());
            } else if (message === "givemedata"){
                console.log("sending body");
                ws.send( editorText(origineditor));
            }
        });
    });
    
    vscode.workspace.onDidChangeTextDocument((e) => {
        var _a;
        if (e.document == ((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document)) {
            publishwebsocketsdelay.presskey(s);
        }
    });
    
    vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor == vscode.window.activeTextEditor) {
            publishwebsocketsdelay.presskey(s);
        }
    });

    vscode.workspace.onDidChangeConfiguration((e) => {
            //設定変更
            console.log('setting changed');
            sendsettingwebsockets(s);
    });


    publishwebsocketsdelay.presskey(s);

    return s;
}

function publishwebsockets(socketserver){
    socketserver.clients.forEach(client => {
        client.send(editorText("active"));
    }); 
}

function sendsettingwebsockets(socketserver){
    socketserver.clients.forEach(client => {
        client.send(( JSON.stringify(getConfig())));
    }); 
}

function getConfig(){
    const config = vscode.workspace.getConfiguration('Novel');

    const lineheightrate = 1.75;
    const fontfamily        = config.get('preview.font-family');
    const fontsize          = config.get('preview.fontsize');
    const numfontsize       = parseInt(/(\d+)(\D+)/.exec(fontsize)[1]);
    const unitoffontsize    = /(\d+)(\D+)/.exec(fontsize)[2];
    const linelength        = config.get('preview.linelength');
    const linesperpage      = config.get('preview.linesperpage');
    const pagewidth         = (linesperpage * numfontsize * lineheightrate * 1.003) + unitoffontsize;
    const pageheight        = (linelength * numfontsize) + unitoffontsize;
    const lineheight        = (numfontsize * lineheightrate) + unitoffontsize;
    
    const previewsettings = {
        lineheightrate,
        fontfamily   , 
        fontsize      ,
        numfontsize   ,
        unitoffontsize,
        linelength    ,
        linesperpage  ,
        pagewidth     ,
        pageheight    ,
        lineheight    ,
    }
    return previewsettings;
}

var keypressflag = false;

var publishwebsocketsdelay = {
    publish: function(socketserver) {
        publishwebsockets(socketserver);
        keypressflag = false;
        delete this.timeoutID;
    },
    presskey: function(s) {
      //this.cancel();
      if (!keypressflag){
            var updatecounter = Math.ceil(vscode.window.activeTextEditor.document.getText().length / 10);
            var self = this;
            var socketserver = s;
            var timer = timer;
            this.timeoutID = setTimeout(function(socketserver) {
                self.publish(socketserver);
                }, updatecounter, socketserver);
                keypressflag = true;
        }
    },
    cancel: function() {
      if(typeof this.timeoutID == "number") {
        window.clearTimeout(this.timeoutID);
        delete this.timeoutID;
      }
    }
  };

function verticalpreview(){
    var origineditor = vscode.window.activeTextEditor;
    var s = launchserver(origineditor);

//    vscode.window.showInformationMessage('Hello, world!');
    const panel = vscode.window.createWebviewPanel(
        'preview', // Identifies the type of the webview. Used internally
        '原稿プレビュー', // Title of the panel displayed to the user
        vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
        {
            enableScripts: true,
        } // Webview options. More on these later.
    );

/*     vscode.workspace.onDidChangeTextDocument((e) => {
        var _a;
        if (e.document == ((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document)) {
            panel.webview.html = getWebviewContent();
        }
    });

    vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor == vscode.window.activeTextEditor) {
            panel.webview.html = getWebviewContent();
        }
    });
 */
    // And set its HTML content
    //panel.webview.html = getWebviewContent();
    panel.webview.html = `
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
}

function exportpdf(){
    const myhtml = getWebviewContent();
    //console.log(myhtml);
    const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    let mypath = path.join(folderPath, 'publish.html');
    let myworkingdirectory = path.join(folderPath, '');
    let vivliocommand = 'vivliostyle build ';

    let escapedpath = mypath;
        escapedpath = escapedpath.replace(/ /g, '\\ ');
    let escapeddirectory = myworkingdirectory;
        escapeddirectory = escapeddirectory.replace(/ /g, '\\ ');

        output.appendLine(`startig to publish: ${escapedpath}`);
        vivliocommand = vivliocommand + escapedpath + ' -o ' + escapeddirectory + "/output.pdf";

        output.appendLine(`startig to publish: ${vivliocommand}`);

    fs.writeFile(mypath, myhtml, (err) => {
        if (err) {console.log(err)};
        //https://docs.vivliostyle.org/#/ja/vivliostyle-cli
        output.appendLine(`saving pdf to ${vivliocommand}`);
        cp.exec(vivliocommand, (err, stdout, stderr) => {
                if (err) {
                    console.log(`stderr: ${stderr}`);
                    output.appendLine(`stderr: ${stderr}`);
                    return
                }
                output.appendLine(`stdout: ${stdout}`);
                output.appendLine('PDFの保存が終わりました');
            }
        )
        output.appendLine('HTMLの書き込みが完了しました');
      });

}



function deactivate() {
    return undefined;
}

module.exports = { activate, deactivate };

function editorText(origineditor){
    if(origineditor === "active"){
        myeditor = vscode.window.activeTextEditor;
    } else {
        myeditor = origineditor;
    }

    let text = myeditor.document.getText();
    let cursorOffset = myeditor ? myeditor.document.offsetAt(myeditor.selection.anchor) : 0;
    var myHTML = "";

    let cursorTaggedHtml = "";
    // カーソル位置
    if ( text.slice(cursorOffset, cursorOffset + 1) == '\n'){
        cursorTaggedHtml = text.slice(0, cursorOffset) + '<span id="cursor">　</span>' + text.slice(cursorOffset);
    } else {
        cursorTaggedHtml = text.slice(0, cursorOffset) + '<span id="cursor">' + text.slice(cursorOffset, cursorOffset + 1) + '</span>' + text.slice(cursorOffset + 1);
    }

    let paragraphs = cursorTaggedHtml.split('\n');
    //console.log(paragraphs);
    paragraphs.forEach(paragraph => {
        //console.log(paragraph);
        if (paragraph.match(/^\s*$/)) {
            myHTML += '<p class="blank">_' + paragraph + '</p>';
        } else if( paragraph.match(/^<span id="cursor">$/) || paragraph.match(/^<\/span>$/) ){
            myHTML += '<p class="blank">_</p><span id="cursor">';
        } else {
            myHTML += '<p>' + paragraph + '</p>';
        }
    });

    return markUpHtml(myHTML);
}

function markUpHtml( myhtml ){
    var taggedHTML = myhtml;
    //configuration 読み込み
    const config = vscode.workspace.getConfiguration('Novel');
    let userregex = new Array(0);
        userregex = config.get('preview.userregex');
//    console.log(userregex, userregex.length);
    if (userregex.length > 0){
        
        userregex.forEach( function(element, index){
                   
            //if ( thismatch && thisreplace ){
                var thismatch = new RegExp(element[0], 'gi');
                var thisreplace = element[1];
            //    console.log(element[0], thismatch, thisreplace);
                taggedHTML = taggedHTML.replace(thismatch, thisreplace);
            //}
        });
    }

    taggedHTML = taggedHTML.replace(/<p>［＃ここから[１1一]文字下げ］<\/p>/g, '<div class="indent-1">');
    taggedHTML = taggedHTML.replace(/<p>［＃ここから[２2二]文字下げ］<\/p>/g, '<div class="indent-2">');
    taggedHTML = taggedHTML.replace(/<p>［＃ここから[３3三]文字下げ］<\/p>/g, '<div class="indent-3">');
    taggedHTML = taggedHTML.replace(/<p>［＃ここで字下げ終わり］<\/p>/g, '</div>');
    taggedHTML = taggedHTML.replace(/<!-- (.+?) -->/g, '<span class="comment"><span class="commentbody">$1</span></span>');
    taggedHTML = taggedHTML.replace(/｜([^｜\n]+?)《([^《]+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/([一-鿏々-〇]+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/(.+?)［＃「\1」に傍点］/g, '<em class="side-dot">$1</em>');

/*     s.clients.forEach(client => {
        //client.send(previewvariables());
        client.send(taggedHTML);
    });
 */
    return taggedHTML;
}


function getWebviewContent() {

    //configuration 読み込み
    const config = vscode.workspace.getConfiguration('Novel');
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
        //console.log(lineheight);

    var mytext = editorText("active");
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
          content: "<$fullname>　 "counter(page);
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
        font-size: calc(110mm / ${linelength});
        line height: 1.65;
        text-indent: 0em;
        hanging-punctuation: force-end;
        line-break:strict;
        page-break-inside: auto;
    }
 
      div.indent-1 p:first-of-type, div.indent-2 p:first-of-type, div.indent-3 p:first-of-type{
        padding-block-start: calc( ${fontsize} * ${lineheightrate});
        }

        div.indent-1 p:last-of-type, div.indent-2 p:last-of-type, div.indent-3 p:last-of-type{
        padding-block-end: calc( ${fontsize} * ${lineheightrate});
        }

    
    div.indent-1 p{
    height: calc( 110mm - (${fontsize}));
    padding-top: ${fontsize};
    }

    div.indent-2 p{
    height: calc( 110mm - (${fontsize} * 2));
    padding-top: calc(${fontsize} * 2);
    }

    div.indent-3 p{
    height: calc( 110mm - (${fontsize} * 3));
    padding-top: calc(${fontsize} * 3);
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
      em.sesame_dot {
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
            font-family: ${fontfamily};
            height: ${pageheight};
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
            height: ${pageheight};
            font-family: ${fontfamily};
            font-size: ${fontsize};
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
              background-size:    ${pagewidth} ${pageheight};
              background-repeat:  repeat-x;
              background-position: right 0px;
          }
          p{
              background-image:   linear-gradient( rgba(50, 50, 50, 1) 0.5pt, transparent 1pt),
                                  linear-gradient(to right, rgba(50, 50, 50, 1) 0.5pt, rgba(0, 0, 50, 0.05) 1pt);
              background-size:    ${lineheight} ${fontsize},
                                  ${lineheight} ${fontsize};
              background-repeat:  repeat,
                                  repeat;
              background-position: right 0px,
                                  right 0px;
          }

          div.indent-1 p{
            height: calc( ${pageheight} - (${fontsize}));
            padding-top: ${fontsize};
            }
        
            div.indent-2 p{
            height: calc( ${pageheight} - (${fontsize} * 2));
            padding-top: calc(${fontsize} * 2);
            }
        
            div.indent-3 p{
            height: calc( ${pageheight} - (${fontsize} * 3));
            padding-top: calc(${fontsize} * 3);
            }

        
          span.comment{
            display:block;
            border-radius:1em;
            border:1.5pt solid rgba(70,70,00,0.9);
            padding:0.25em 0.25em;
            position:absolute;
            margin-right: -3em;
            margin-top: 0.5em;
            top: ${pageheight};
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
  ${mytext}
  
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