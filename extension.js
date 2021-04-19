const vscode = require('vscode');
var myeditor = vscode.window.activeTextEditor;

function verticalpreview(){
//    vscode.window.showInformationMessage('Hello, world!');
    const panel = vscode.window.createWebviewPanel(
        'preview', // Identifies the type of the webview. Used internally
        '原稿プレビュー', // Title of the panel displayed to the user
        vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
        {
            enableScripts: true
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

function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('Novel.vertical-preview', verticalpreview));
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
        if (paragraph.match(/^\s*$/) ) {
            myHTML += '<p class="blank">_' + paragraph + '</p>';
        } else {
            myHTML += '<p>' + paragraph + '</p>';
        }
    });

    return markUpHtml(myHTML);
}

function markUpHtml( myhtml ){
    var taggedHTML = myhtml.replace(/｜([^｜\n]+?)《([^《]+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
        taggedHTML = taggedHTML.replace(/([一-龠]+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
        taggedHTML = taggedHTML.replace(/(.+?)［＃「\1」に傍点］/g, '<em class="side-dot">$1</em>');
    return taggedHTML;
}

function getWebviewContent() {
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
            var scrollEnd = cursor.offsetLeft - width + 84;
            var panelWidth = window.innerWidth;
            window.scrollTo( scrollEnd , scrollEnd);
                console.log(cursor, cursor.offsetLeft, scrollEnd);

        }

      </script>
      <style>
        html {
        }
        
        body {
            writing-mode: vertical-rl;
            font-family:"ヒラギノ明朝 ProN W3", "HiraMinProN-W3", serif, sans-serif;
            font-size: 1em;
            height: 40em;
        }
        
        body.title {
            writing-mode: horizontal-tb;
            -webkit-writing-mode: horizontal-tb;
            -epub-writing-mode: horizontal-tb;
            background-image: url('../images/cover.jpg');
            background-repeat: no-repeat;
        }
        
        p {
            font-size 1em;;
            margin:0 0 0 0;
        }
        
        #cursor {
            background-color: rgb(96,96,96,);
            animation-duration: 0.5s;
            animation-name: cursorAnimation;
            animation-iteration-count: infinite;
        }

        p {
            font-family:"ヒラギノ明朝 ProN W3", "HiraMinProN-W3", serif, sans-serif;
            line-height: 1.75em;
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

  </head>
  <body>
  ${mytext}
  </body>
  </html>`;
  }