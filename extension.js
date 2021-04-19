const vscode = require('vscode');

function verticalpreview(){
//    vscode.window.showInformationMessage('Hello, world!');
    const panel = vscode.window.createWebviewPanel(
        'preview', // Identifies the type of the webview. Used internally
        '原稿プレビュー', // Title of the panel displayed to the user
        vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
        {} // Webview options. More on these later.
    );

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

function getWebviewContent() {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cat Coding</title>
      <style>
        html {
        }
        
        body {
            writing-mode: vertical-rl;
            -webkit-writing-mode: vertical-rl;
            -epub-writing-mode: vertical-rl;
            font-family:"ヒラギノ明朝 ProN W3", "HiraMinProN-W3", serif, sans-serif;
            font-size: 1em;
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
        
        p {
            font-family:"ヒラギノ明朝 ProN W3", "HiraMinProN-W3", serif, sans-serif;
            line-height: 1.75em;
            vertical-align: middle;
            -webkit-text-orientation: use-glyph-orientation;
            -epub-text-orientation: use-glyph-orientation;
        }
        
        .indent-3 {
            padding-top: 3em;
        }
        
        em.side-dot {
            text-emphasis-style: sesame;
        }
        
        span.tcy {
            text-combine: horizontal;
        }
        
        
        .title {
            font-size:28pt;
            text-align:center;
            font-family:Helvetica;
        }
        
        .author {
            font-size:26pt;
            text-align:right;
        }
        
        .chapterTitle {
            font-size:1.5em;
        }
        
        .chapterText {
            font-size:12pt;
        }
      </style>
  </head>
  <body>
        日本語だよ。
      <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
  </body>
  </html>`;
  }