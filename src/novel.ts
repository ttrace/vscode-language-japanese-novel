import * as vscode from 'vscode';
import { draftRoot, draftsObject } from './compile';

export class DraftWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'draftTree';
  private _context: vscode.ExtensionContext;
  private _webviewView?: vscode.WebviewView;

  private watch: vscode.FileSystemWatcher;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    
    // ファイルシステムの監視を設定
    this.watch = vscode.workspace.createFileSystemWatcher('**/*.txt');
    this.watch.onDidChange(this.handleFileSystemEvent, this);
    this.watch.onDidCreate(this.handleFileSystemEvent, this);
    this.watch.onDidDelete(this.handleFileSystemEvent, this);
  }

  private handleFileSystemEvent(uri: vscode.Uri) {
    console.log('File system event detected:', uri);
    this.refreshWebview();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this._webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(message => {
      if (message.command === 'loadTreeData') {
        this.loadTreeData(webviewView.webview);
        console.log('Treeからデータ取得依頼');
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'bundle.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'media', 'style.css')
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

  private loadTreeData(webview: vscode.Webview) {
    webview.postMessage({
      command: 'treeData',
      data: draftsObject(draftRoot())
    });
  }

  private refreshWebview() {
    if (this._webviewView) {
      this.loadTreeData(this._webviewView.webview);
    }
  }
}
