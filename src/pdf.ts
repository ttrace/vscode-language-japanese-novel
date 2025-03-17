import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { editorText } from "./editor";
import { getConfig, NovelSettings } from "./config";
import * as cp from "child_process";
import { draftRoot } from "./compile";
// const psTree = require('ps-tree');
// import psTree from "ps-tree";

const output = vscode.window.createOutputChannel("Novel");

let vivlioProcess: cp.ChildProcess | null = null;

export function previewpdf(context: vscode.ExtensionContext) {
  exportpdf(context, true);
}

export async function exportpdf(
  context: vscode.ExtensionContext,
  preview: boolean | undefined,
): Promise<void> {
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showWarningMessage(`ワークスペースが見つかりません`);
    return;
  } else {
    // vivliostyle実行準備
    let fileName: string | undefined;
    const folderUri = vscode.workspace.workspaceFolders[0].uri;
    const myPath = vscode.Uri.joinPath(folderUri, "publish.html");
    const myWorkingDirectory = folderUri;
    const vivlioCommand = "npx @vivliostyle/cli";
    const vivlioSubCommand = preview ? "preview" : "build";
    const execPath = draftRoot().match(/^[a-z]:\\/)
      ? myPath.path.replace(/^\//, "")
      : myPath;
    const vivlioExportOption = !preview ? "-f pdf -o" : "";

    // PDF保存するためのファイルパス作成
    if (!preview) {
      const filePath = vscode.window.activeTextEditor?.document.fileName;
      const pdfName = filePath
        ? path.basename(filePath).replace(/\.[a-zA-Z]+$/, "")
        : "名称未設定";
      fileName = await vscode.window.showInputBox({
        title: "ファイル名の設定",
        prompt: `出力するPDFのファイル名を入力してください`,
        placeHolder: pdfName,
        value: pdfName,
        ignoreFocusOut: false,
      });
    }
    const vivlioExportPath = !preview
      ? path.normalize(
          vscode.Uri.joinPath(myWorkingDirectory, `${fileName}.pdf`).fsPath,
        )
      : "";

    output.appendLine(`PDF処理を実行します: ${myPath}`);

    //HTMLの抽出
    const myHtml = await getPrintContent();
    const myHtmlBinary = Buffer.from(myHtml, "utf-8");

    try {
      await vscode.workspace.fs.writeFile(myPath, myHtmlBinary);
    } catch (err) {
      //HTML保存エラー
      output.appendLine(`HTMLの保存時にエラーが発生しました: ${err}`);
      console.error(`HTMLの保存時にエラーが発生しました: ${err}`);
    }

    if (!preview) {
      // PDF保存
      vscode.window.showInformationMessage(
        `Vivliostyle起動中……\n初回起動には少々時間がかかります`,
      );
      cp.exec(
        `${vivlioCommand} ${vivlioSubCommand} ${execPath} ${vivlioExportOption} "${vivlioExportPath}"`,
        (err, stdout, stderr) => {
          if (err) {
            output.appendLine(
              `VivlioStyleの処理でエラーが発生しました: ${err.message}`,
            );
            return;
          }
          if (stdout) {
            console.log(`Vivlio出力： ${stdout}`);
          }
          if (stderr) {
            console.log(`Vivlioエラー出力： ${stderr}`);
          }
          if (!preview) {
            output.appendLine(`ファイル名: ${stdout}`);
            output.appendLine("PDFの保存が終わりました");
          }
          vscode.window.showInformationMessage(`PDFの保存が終わりました`);
        },
      );
    } else {
      launchVivlioStylePreviewOnPanel(context);
    }
  }
}

let currentPanel: vscode.WebviewPanel | undefined = undefined; // 既存のWebViewを追跡
let currentEdior: vscode.TextEditor | undefined = undefined; // Vivliostyleを開いたエディターを追跡;

function launchVivlioStylePreviewOnPanel(context: vscode.ExtensionContext) {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showErrorMessage("アクティブなエディターがありません。");
    return;
  }

  // 既存のWebViewがpdfPreviewであるか確認
  if (currentPanel && currentPanel.viewType === "pdfPreview") {
    sendMessageToPanel(currentPanel, activeEditor); // activeEditorを渡す
    currentPanel.reveal(vscode.ViewColumn.Two); // 既存のパネルを表示
    return;
  }

  currentEdior = vscode.window.activeTextEditor;

  const panel = vscode.window.createWebviewPanel(
    "pdfPreview",
    "PDFプレビュー",
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  const colorTheme = vscode.window.activeColorTheme.kind;
  const iconfile =
    colorTheme === vscode.ColorThemeKind.Dark
      ? "preview-pdf-dark.svg"
      : "preview-pdf-light.svg";
  const iconPath = vscode.Uri.file(
    path.join(context.extensionPath, "media", iconfile),
  );
  panel.iconPath = iconPath;

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("ワークスペースが開かれていません。");
    return;
  }

  const htmlFilePath = path.join(
    vscode.extensions.getExtension("TaiyoFujii.novel-writer")?.extensionPath ||
      "",
    "dist",
    "vivlioViewer",
    "index.html",
  );
  const htmlContent = fs.readFileSync(htmlFilePath, "utf8");

  const extensionPath = vscode.extensions.getExtension(
    "TaiyoFujii.novel-writer",
  )?.extensionPath;

  if (extensionPath) {
    panel.webview.html = htmlContent
      .replace(
        /src="(.*?)"/g,
        (_, src) =>
          `src="${panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, "dist", "vivlioViewer", src)))}"`,
      )
      .replace(
        /href="(.*?)"/g,
        (_, href) =>
          `href="${panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, "dist", "vivlioViewer", href)))}"`,
      );

    // WebViewの作成後にメッセージを送信
    sendMessageToPanel(panel, activeEditor);

    // パネルが閉じられたときにcurrentPanelをクリア
    panel.onDidDispose(() => {
      currentPanel = undefined;
    });

    // 現在のパネルを追跡
    currentPanel = panel;
  } else {
    vscode.window.showErrorMessage("Extension path is undefined.");
  }
}

// メッセージ送信ロジックを関数化
interface PanelMessage {
  command: string;
  content: string;
}

let selectionChangeDisposable: vscode.Disposable | undefined;

function sendMessageToPanel(
  panel: vscode.WebviewPanel,
  editor: vscode.TextEditor,
) {
  const previewSettings: NovelSettings = getConfig();
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("ワークスペースが開かれていません。");
    return;
  }

  const publishFilePath = path.join(
    workspaceFolders[0].uri.fsPath,
    "publish.html",
  );
  try {
    const publishContent = fs.readFileSync(publishFilePath, "utf8");

    const activeEditor = editor;
    let lineNumber;
    if (activeEditor) {
      const visibleRange = activeEditor.visibleRanges[0];
      // カーソル位置を取得
      const cursorPosition = activeEditor.selection.active;

      // カーソルが画面内にある場合、その行番号を優先する
      if (
        cursorPosition.line >= visibleRange.start.line &&
        cursorPosition.line <= visibleRange.end.line
      ) {
        lineNumber = cursorPosition.line + 1;
      } else {
        // カーソルが画面外の場合は最上部の行番号を利用する
        const startLine = visibleRange.start.line;
        lineNumber = startLine + 1;
      }
    } else {
      lineNumber = 1;
    }
    panel.webview.postMessage({
      command: "loadDocument",
      content: publishContent,
      lineNumber: lineNumber,
      pageProgression: previewSettings.writingDirection,
    });

    // すでにイベントハンドラーが登録されている場合は解除
    if (selectionChangeDisposable) {
      selectionChangeDisposable.dispose();
    }

    let isNavigatingFromWebView = false;
    let isTypingOrDeleting = false;
    let lastLineNumber: number | null = null;
    // 追加: テキストエディターの選択が変更された時のイベントハンドラーを設定
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (isNavigatingFromWebView || isTypingOrDeleting) {
        // WebViewからの行移動イベント時には、通常の動作を一時的にキャンセルする
        isNavigatingFromWebView = false;
        return;
      }
      const newSelection = event.selections[0];
      if (newSelection && event.textEditor === activeEditor) {
        const newLineNumber = newSelection.active.line;

        // もし新しい行番号が前回と同じであれば、何もせず終了
        if (lastLineNumber !== null && newLineNumber === lastLineNumber) {
          return;
        }

        // 行番号を更新
        lastLineNumber = newLineNumber;
        panel.webview.postMessage({
          command: "goToLine",
          lineNumber: newLineNumber,
        });
      }
    });

    // テキストエディタ内での内容変更（タイピングや削除）を監視
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        vscode.window.activeTextEditor &&
        event.document === vscode.window.activeTextEditor.document
      ) {
        isTypingOrDeleting = true;

        // 少しの待機時間後にフラグをリセット
        setTimeout(() => {
          isTypingOrDeleting = false;
        }, 300); // 500ms後にリセット。状況に応じて調整可。
      }
    });

    panel.webview.onDidReceiveMessage(async (messageFromPreview) => {
      if (!messageFromPreview) {
        console.error("No message received.");
        return;
      }

      const { command, linenNumberToGo, offset } = messageFromPreview;

      if (!command) {
        console.error("Command not found in message.");
        return;
      }

      switch (command) {
        case "previewClicked":
          const lineNumber = parseInt(linenNumberToGo);
          const position = new vscode.Position(lineNumber, offset);
          const range = new vscode.Range(position, position);
          if (activeEditor) {
            isNavigatingFromWebView = true; // フラグを設定してイベントの発火を無効化
            // エディターをアクティブにする
            vscode.window.showTextDocument(activeEditor.document, {
              viewColumn: activeEditor.viewColumn,
            });
            const activeLineMovingEditor = vscode.window.activeTextEditor;
            if (!activeLineMovingEditor) return;
            activeLineMovingEditor.revealRange(
              range,
              vscode.TextEditorRevealType.AtTop,
            );
            activeLineMovingEditor.selection = new vscode.Selection(
              position,
              position,
            );

            const lineStart = new vscode.Position(lineNumber, 0);
            const lineEnd = new vscode.Position(
              lineNumber,
              activeLineMovingEditor.document.lineAt(lineNumber).text.length,
            );
            const hightlightRange = new vscode.Range(lineStart, lineEnd);
            // console.log(hightlightRange);
            const highlightDuration = 500; // ハイライト時間 (ミリ秒)
            const decorationType = vscode.window.createTextEditorDecorationType(
              {
                backgroundColor: "rgba(245, 165, 119, 0.3)", // ハイライト色 (半透明)
                borderStyle: "none", // ハイライトの境界線のスタイル
                borderRadius: "2px", // ハイライトの角丸
              },
            );

            // 選択されたテキストにデコレーションを適用
            activeLineMovingEditor.setDecorations(decorationType, [
              hightlightRange,
            ]);

            // タイマーをセットしてデコレーションを削除
            setTimeout(() => {
              decorationType.dispose();
            }, highlightDuration);
          } else {
            console.error("エディターが見つかりません");
          }

          break;
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(
      "ファイルを読み込めませんでした: " + (error as Error).message,
    );
  }
}

async function getPrintContent(): Promise<string> {
  //configuration 読み込み

  const myText = editorText("active").replace(
    /<span id="cursor">(.*?)<\/span>/g,
    "$1",
  );
  const previewSettings: NovelSettings = getConfig();
  const writingDirection = previewSettings.writingDirection;
  const linesPerPage = previewSettings.linesPerPage;
  const printBoxInlineLength =
    writingDirection === "vertical-rl" ? 168 : 124.32; // ドキュメント高さの80%(上下マージン10%を抜いた数)
  // ドキュメント幅の84%(左右マージン16%を抜いた数)
  const printBoxBlockSize = writingDirection === "vertical-rl" ? 124.32 : 168;
  const fontSize =
    previewSettings.lineLength >
    linesPerPage * 1.75 * (printBoxInlineLength / printBoxBlockSize)
      ? printBoxInlineLength / previewSettings.lineLength
      : printBoxBlockSize / (linesPerPage * 1.75);

  const fontSizeWithUnit = fontSize + "mm";
  const projectTitle = vscode.workspace.workspaceFolders![0].name;
  const typeSettingHeight = fontSize * previewSettings.lineLength;
  const columnCount = Math.floor(
    printBoxInlineLength / (typeSettingHeight + fontSize * 2),
  );
  const pageStartingCss =
    previewSettings.pageStarting == "左"
      ? "break-before: left;\n"
      : "break-before: right;\n";
  console.log(
    "column",
    `${printBoxInlineLength} / (${typeSettingHeight} + ${fontSize} * 2)`,
  );
  const originPageNumber = previewSettings.originPageNumber;

  // const noColumnGap = columnCount == 1 ? "2em" : "0";
  const columnCSS =
    columnCount > 1
      ? `column-count: ${columnCount};
  column-fill: auto;`
      : "";
  const columnHeitghtRate =
    "calc(" + fontSize * previewSettings.lineLength + "mm + 0.5em)";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const typesettingInformation = `${previewSettings.lineLength}字×${linesPerPage}行`;

  const pageNumberFormatR = eval(
    "`" +
      previewSettings.numberFormatR
        .replace(/\${pageNumber}/, "counter(page)")
        .replace(/(.*)counter\(page\)(.*)/, '"$1"counter(page)"$2"') +
      ";`",
  );

  let printCss = `<style>
      @charset "UTF-8";
      :root {
        --font-size: ${fontSizeWithUnit}
      }
      html {
      orphans: 1;
      widows: 1;
      color: black;
      }

      body{
        writing-mode: ${previewSettings.writingDirection};
        color: black;
      }

      * {
      margin: 0;
      padding: 0;
      }

      @page {
        size: 148mm 210mm;
        block-size: calc(${fontSizeWithUnit} * 1.75 * ${linesPerPage} + (${fontSizeWithUnit} * 0.4));
        margin-top: 10%;
        margin-bottom: 10%;
        margin-left: 8%;
        margin-right: 8%;
        /* 以下、マージンボックスに継承される */
        font-size: 6pt;
        font-family: "游明朝", "YuMincho", serif;
        /* 本来不要（<span class="smaller"><span class="smaller">ルート要素の指定が継承される</span></span>）だが、現時点のvivliostyle.jsの制限により必要 */
        vertical-align: top;
      }

      @page : first {
        counter-reset: page ${originPageNumber - 1};
      }

      @page :left {
        margin-right: 6%;
        margin-left: 10%;
        @bottom-left {
          content: ${pageNumberFormatR}
          margin-left: 0mm;
          margin-bottom: 5%;
          writing-mode: horizontal-tb;
          font-size:10q;
          /* CSS仕様上は@pageルール内に書けばよいが、現時点のvivliostyle.jsの制限によりここに書く */
      }
    }
      
      @page :right {
        margin-left: 6%;
        margin-right: 10%;
        /* border-bottom: 1pt solid black; */
      /* 右下ノンブル */
      @bottom-right {
          content: ${pageNumberFormatR}
          margin-right: 0mm;
          margin-bottom: 5%;
          writing-mode: horizontal-tb;
          font-size:10q;
          /* CSS仕様上は@pageルール内に書けばよいが、現時点のvivliostyle.jsの制限によりここに書く */
      }
      }
  
      html {
      font-family: "游明朝", "YuMincho", serif;
      font-weight: Medium;
      text-align: justify;
      hanging-punctuation: allow-end;
      text-spacing: none;
      }
  
      body{
        ${pageStartingCss}
        ${columnCSS}
      }
  
      div#draft{
        inline-size: ${columnHeitghtRate};
        margin-inline-start: auto;
        margin-inline-end: auto;
      }

      h1 {
        /* 五行トリ2倍角 */
        display:flex;
        align-items: center;
        block-size: calc(${fontSizeWithUnit} * 1.75 * 5);
        /* フォント */
        font-weight: Extrabold;
        letter-spacing: 0.25em;
        font-size: calc(${fontSizeWithUnit} * 2);
        /* 字下げ */
        text-indent: 0;
        /* 直後の改ページ・改段禁止 */
      }
  
      h2 {
        /* 二行トリ1.6倍角 */
        display:flex;
        align-items: center;
        block-size: calc(${fontSizeWithUnit} * 1.75 * 2);
        /* フォント */
        font-weight: Extrabold;
        font-size: calc(${fontSizeWithUnit} * 1.6);
        /* 字下げ */
        text-indent: calc(${fontSizeWithUnit} * 1 * ${previewSettings.writingDirection == "horizontal-tb" ? 0 : 1});
        /* 直後の改ページ・改段禁止 */
      }

      h3 {
        /* 一行トリ1.2倍角 */
        display:flex;
        align-items: center;
        block-size: calc(${fontSizeWithUnit} * 1.75);
        /* フォント */
        font-weight: demi-bold;
        font-size: calc(${fontSizeWithUnit} * 1.2);
        /* 字下げ */
        text-indent: calc(${fontSizeWithUnit} * 1 * ${previewSettings.writingDirection == "horizontal-tb" ? 0 : 1});
        /* 直後の改ページ・改段禁止 */
        page-break-after:avoid;
      }

      h4,h5,h6 {
        /* 一行トリ1.2倍角 */
        display:flex;
        align-items: center;
        block-size: calc(${fontSizeWithUnit} * 1.75);
        /* フォント */
        font-weight: demi-bold;
        font-size: calc(${fontSizeWithUnit} * 1);
        /* 字下げ */
        text-indent: calc(${fontSizeWithUnit} * 1 * ${previewSettings.writingDirection == "horizontal-tb" ? 0 : 1});
        /* 直後の改ページ・改段禁止 */
        page-break-after:avoid;
      }

      h1 + h2 {
      margin-block-start: 16pt;
      }

      p + h3 {
        margin-block-start: calc(${fontSizeWithUnit} * 1.75);
      }
      
      body.vertical-rl ruby > rt {
        font-size: 0.5em;
        width: 0.75em;
      }

      body.horizontal-tb ruby > rt {
        font-size: 0.5em;
        width: 0.75em;
      }

      p {
        font-size: ${fontSizeWithUnit};
        line-height: 1.75;
        inline-size: ${columnHeitghtRate};
        text-indent: 0em;
        hanging-punctuation: allow-end;
        line-break:strict;
        page-break-inside: auto;
      }

    div.indent-1 p:first-of-type, div.indent-2 p:first-of-type, div.indent-3 p:first-of-type{
      padding-block-start: calc( ${fontSizeWithUnit} * ${
        previewSettings.lineHeightRate
      });
      }

      div.indent-1 p:last-of-type, div.indent-2 p:last-of-type, div.indent-3 p:last-of-type{
      padding-block-end: calc( ${fontSizeWithUnit} * ${
        previewSettings.lineHeightRate
      });
      }

    
    div.indent-1 p{
    inline-size: calc( ${columnHeitghtRate} - ${fontSizeWithUnit});
    padding-inline-start: calc( ${fontSizeWithUnit});
    }

    div.indent-2 p{
    inline-size: calc( ${columnHeitghtRate} - (${fontSizeWithUnit} * 2));
    padding-inline-start: calc(${fontSizeWithUnit} * 2);
    }

    div.indent-3 p{
    inline-size: calc( ${columnHeitghtRate} - (${fontSizeWithUnit} * 3));
    padding-inline-start: calc(${fontSizeWithUnit} * 3);
    }

    p.goth {
    margin-inline-start: 3em;
    font-family: "游ゴシック", "YuGothic", san-serif;
    margin-block-start: 1em;
    margin-block-end: 1em;
    }

    p.align-rb {
    text-align: end;
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
    block-size: 6em;
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

    span.bottom {
      display: block;
      float: right;
    }
    
    span.bottom-1 {
      display: block;
      float: right;
      padding-inline-end: 1em;
    }
    
    span.bottom-2 {
      display: block;
      float: right;
      padding-inline-end: 2em;
    }
    
    span.bottom-3 {
      display: block;
      float: right;
      padding-inline-end: 3em;
    }
        

    /* 圏点（<span class="smaller">ゴマ</span>） */
    em.side-dot, em.sesame_dot {
    font-style: normal;
    -webkit-text-emphasis-style: sesame;
    text-emphasis-style: sesame;
    margin-block-start: -1em;
    display: inline-block;
    }

    /*著作者*/
    .author {
    position: absolute;
    bottom: 0;
    font-size: 8.5pt;
    margin-inline-start: 50pt;
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
    block-size: auto;
    vertical-align: bottom;
    }

    figcaption {
    text-align: start;
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

    span.blank{
      display:none;
    }
    </style>`;

  const folderUri = vscode.workspace.workspaceFolders![0].uri;
  const cssUri = vscode.Uri.joinPath(folderUri, "css", "print.css");

  try {
    await vscode.workspace.fs.stat(cssUri);
    const cssContent = await vscode.workspace.fs.readFile(cssUri);
    let cssString = cssContent.toString();

    const variables: Record<string, string> = {
      writingDirection,
      fontSizeWithUnit,
      linesPerPage: String(linesPerPage),
      originPageNumber: String(originPageNumber),
      pageNumberFormatR,
      pageStartingCss,
      columnCSS,
      columnHeitghtRate,
    };

    cssString = evaluateTemplate(cssString, variables);
    printCss = `<style>${cssString}</style>`;
  } catch (error) {
    console.log("css/print.css not found, using default printCss.", cssUri);
  }

  return `<!DOCTYPE html>
  <html lang="ja">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${projectTitle}</title>
      ${printCss}
  </head>
  <body class="${previewSettings.writingDirection}">
  <div id="draft">
  ${myText}
  </div>
  </body>
  </html>`;
}

function evaluateTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\$\{(.*?)\}/g, (_, v) => variables[v] ?? "");
}
