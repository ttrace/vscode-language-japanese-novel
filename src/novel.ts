/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-namespace */
import * as vscode from "vscode";
//import * as fs from "fs";
// import * as path from "path";
import { draftRoot, draftsObject } from "./compile";
// import { deadLineFolderPath, deadLineTextCount } from "./charactorcount";

console.log(draftRoot, draftsObject);

export class DraftTreeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'draftTree';
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    console.log(context, token);
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "main.js")
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
}
