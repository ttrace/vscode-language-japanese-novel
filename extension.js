const vscode = require('vscode');
var myeditor = vscode.window.activeTextEditor;

function verticalpreview(){
//    vscode.window.showInformationMessage('Hello, world!');
    const panel = vscode.window.createWebviewPanel(
        'preview', // Identifies the type of the webview. Used internally
        '原稿プレビュー', // Title of the panel displayed to the user
        vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
        {
            enableScripts: true,
          //  localResourceRoots: [vscode.Uri.file(docrood)]
        } // Webview options. More on these later.
    );

    vscode.workspace.onDidChangeTextDocument((e) => {
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

    // And set its HTML content
    panel.webview.html = getWebviewContent();
}

//縦書きプレビューのコマンド登録
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('Novel.vertical-preview', verticalpreview));
}

//PDF出力のコマンド登録
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('Novel.export-pdf', verticalpreview));
}


function deactivate() {
    return undefined;
}

module.exports = { activate, deactivate };

function editorText(){
    myeditor = vscode.window.activeTextEditor;

    let text = myeditor.document.getText();
    let cursorOffset = myeditor ? myeditor.document.offsetAt(myeditor.selection.anchor) : 0;
    var myHTML = "";

    // カーソル位置
    if ( text.slice(cursorOffset, cursorOffset + 1) == '\n'){
        cursorOffset ++;
    };
    let cursorTaggedHtml = text.slice(0, cursorOffset) + '<span id="cursor">' + text.slice(cursorOffset, cursorOffset + 1) + '</span>' + text.slice(cursorOffset + 1);

    let paragraphs = cursorTaggedHtml.split('\n');

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
    let userregex = config.get('preview.userregex');
    userregex.forEach(element => {
        //if ( thismatch && thisreplace ){
            var thismatch = new RegExp(element[0], 'gi');
            var thisreplace = element[1];
            taggedHTML = taggedHTML.replace(thismatch, thisreplace);
        //}
    });


    taggedHTML = taggedHTML.replace(/｜([^｜\n]+?)《([^《]+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/([一-龠]+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/(.+?)［＃「\1」に傍点］/g, '<em class="side-dot">$1</em>');
    return taggedHTML;
}

function getWebviewContent(userstylesheet) {

    //configuration 読み込み
    const config = vscode.workspace.getConfiguration('Novel');
        let lineheightrate = 1.75;
        let fontsize = config.get('preview.fontsize');
        let numfontsize = /(\d+)(\D+)/.exec(fontsize)[1];
        let unitoffontsize = /(\d+)(\D+)/.exec(fontsize)[2];

        let linelength = config.get('preview.linelength');
        let linesperpage = config.get('preview.linesperpage');

        let pagewidth = ( linesperpage * numfontsize * lineheightrate * 1.003) + unitoffontsize;
        let pageheight = (linelength * numfontsize) + unitoffontsize;
        let lineheight = ( numfontsize * lineheightrate) + unitoffontsize;
        //console.log(lineheight);

    var mytext = editorText();
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cat Coding</title>
      <script>
        window.onload = function(){
            var width = document.body.clientWidth;
            var cursor = document.getElementById('cursor');
            var panelWidth = window.innerWidth;
            var scrollEnd = cursor.offsetLeft - width + (panelWidth / 2);

            window.scrollTo( scrollEnd , scrollEnd);
               // console.log(cursor, cursor.offsetLeft, scrollEnd);

        }

      </script>
      <style>
        html {
        }
        
        body {
            writing-mode: vertical-rl;
            font-family:"ヒラギノ明朝 ProN W3", "HiraMinProN-W3", serif, sans-serif;
            height: ${pageheight};
            overflow-y:hidden;
            padding:0;
        }
        
        #cursor {
            background-color: rgb(96,96,96,);
            animation-duration: 0.5s;
            animation-name: cursorAnimation;
            animation-iteration-count: infinite;
        }

        p {
            height: ${pageheight};
            font-family:"ヒラギノ明朝 ProN W3", "HiraMinProN-W3", serif, sans-serif;
            line-height: ${lineheightrate};
            font-size: ${fontsize};
            margin:0 0 0 0;
            vertical-align: middle;
        }

        p.blank {
            color:transparent;
        }
        
        .indent-3 {
            padding-top: 3em;
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
                    background-color: rgba(96,96,96,0);
                }
            
                to {
                    background-color: rgba(125,125,125,0.5);
                }
            }
      </style>

      <style>
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

        </style>
      <link rel="stylesheet" href="">
  </head>
  <body>
  ${mytext}
  </body>
  </html>`;
  }