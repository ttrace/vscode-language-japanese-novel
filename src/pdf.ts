import * as vscode from "vscode";
import * as path from "path";
import { editorText } from "./editor";
import { getConfig, NovelSettings } from "./config";
import * as cp from "child_process";
import { draftRoot } from "./compile";
// const psTree = require('ps-tree');
// import psTree from "ps-tree";

const output = vscode.window.createOutputChannel("Novel");

let vivlioProcess: cp.ChildProcess | null = null;

export function previewpdf() {
  exportpdf(true);
}

export async function exportpdf(preview: boolean | undefined): Promise<void> {
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
      vscode.window.showInformationMessage(
        `プレビュー起動中……\n初回起動には少々時間がかかります`,
      );

      if (vivlioProcess == null) {
        if (myPath.fsPath.match(/^[a-z]:/)) {
          // Windowsの場合、パスをエスケープシーケンスで囲む必要がある
          //const adjustedPath = myPath.path.replace(/^\/[a-zA-Z]:\//, "").replace(/\//g,"\\\\");
          launchVivlioStylePreview(`${execPath}`);
        } else {
          // 他のプラットフォームの場合、そのまま実行
          launchVivlioStylePreview(myPath.fsPath);
        }
      } else {
        vscode.window.showInformationMessage(`プレビューが更新されました`);
      }
    }
  }
}

function launchVivlioStylePreview(path: string) {
  vivlioProcess = cp.exec(`npx @vivliostyle/cli preview --http "${path}"`);

  if (vivlioProcess.stdout !== null) {
    vivlioProcess.stdout.on("data", (data) => {
      output.appendLine(`Vivlio出力1: ${path}`);
      output.appendLine(`Vivlio出力: ${data}`);
    });
  }

  if (vivlioProcess.stderr !== null) {
    vivlioProcess.stderr.on("data", (data) => {
      output.appendLine(`Vivlioエラー出力1: ${path}`);
      output.appendLine(`Vivlioエラー出力2: ${data}`);
    });
  }

  vivlioProcess.on("error", (err) => {
    output.appendLine(
      `VivlioStyleの処理でエラーが発生しました: ${err.message}`,
    );
  });

  vivlioProcess.on("close", (code) => {
    if (code !== 0) {
      output.appendLine(`プロセスはコード ${code} で終了しました`);
    }
    vscode.window.showInformationMessage(`プレビューが終わりました`);
  });
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
  //フォントサイズの計算式のためのコメント
  // console.log(
  //   "fontsize:",
  //   fontSize,
  //   "BoxInlineLength:",
  //   printBoxInlineLength,
  //   "printBoxBlockSize:",
  //   printBoxBlockSize
  // );
  // フォントサイズ in mm
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
  // const pageNumberFormatL = eval(
  //   "`" +
  //     previewSettings.numberFormatR
  //       .replace(/\${pageNumber}/, "counter(page)")
  //       .replace(/(.*)counter\(page\)(.*)/, '"$1"counter(page)"$2"') +
  //     ";`"
  // );

  // console.log(pageNumberFormatR);

  let printCss = `<style>
      @charset "UTF-8";
      html {
      orphans: 1;
      widows: 1;
      }

      body{
        writing-mode: ${previewSettings.writingDirection};
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
      
      ruby > rt {
      font-size: 6.5q;
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
  <body>
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
