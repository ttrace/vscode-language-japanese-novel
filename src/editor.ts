import * as vscode from "vscode";
import { getConfig } from "./config";
import { draftRoot, fileList } from "./compile";

export type OriginEditor = vscode.TextEditor | "active" | undefined;

export function editorText(originEditor: OriginEditor): string {
  const myEditor =
    originEditor === "active" ? vscode.window.activeTextEditor : originEditor;
  if (!myEditor) {
    return "";
  }
  const text = myEditor.document.getText();
  const cursorOffset = myEditor
    ? myEditor.document.offsetAt(myEditor.selection.anchor)
    : 0;
  let myHTML = "";

  let cursorTaggedHtml = "";
  // カーソル位置
  if (text.slice(cursorOffset, cursorOffset + 1) == "\n") {
    cursorTaggedHtml =
    text.slice(0, cursorOffset) +
    '<span id="cursor" class="blank">↩︎</span>' + text.slice(cursorOffset);
  } else {
    cursorTaggedHtml =
      text.slice(0, cursorOffset) +
      '<span id="cursor">' +
      text.slice(cursorOffset, cursorOffset + 1) +
      "</span>" +
      text.slice(cursorOffset + 1);
  }

  const paragraphs = cursorTaggedHtml.split("\n");
  //console.log(paragraphs);
  let lineNumber = 0;
  paragraphs.forEach((paragraph) => {
    //console.log(paragraph);
    if (paragraph.match(/^\s*$/)) {
      myHTML += `<p id="l-${lineNumber}" class="blank">_${paragraph}</p>`;
    } else if (
      paragraph.match(/^<span id="cursor">$/) ||
      paragraph.match(/^<\/span>$/)
    ) {
      myHTML += `<p id="l-${lineNumber}" class="blank">_</p><span id="cursor">`;
    } else {
      myHTML += `<p id="l-${lineNumber}">${paragraph}</p>`;
    }
    lineNumber++;
  });

  return markUpHtml(myHTML);
}

export function markUpHtml(myHtml: string) {
  let taggedHTML = myHtml;
  //configuration 読み込み
  const config = getConfig();
  const userRegex = config.userRegex;
  if (userRegex.length > 0) {
    userRegex.forEach(function (element) {
      const thisMatch = new RegExp(element[0], "gi");
      const thisReplace = element[1];
      taggedHTML = taggedHTML.replace(thisMatch, thisReplace);
      //}
    });
  }

  taggedHTML = taggedHTML.replace(
    /(?<![0-9\sa-zA-Z"'():])([0-9][0-9])(?![0-9\sa-zA-Z"'():])/g,
    '<span class="tcy">$1</span>'
  );
  taggedHTML = taggedHTML.replace(
    /(.+?)［＃「\1」は縦中横］/g,
    '<span class="tcy">$1</span>'
  );
  taggedHTML = taggedHTML.replace(
    /<p id="l-[0-9]+">［＃ここから[１1一]文字下げ］<\/p>/g,
    '<div class="indent-1">'
  );
  taggedHTML = taggedHTML.replace(
    /<p id="l-[0-9]+">［＃ここから[２2二]文字下げ］<\/p>/g,
    '<div class="indent-2">'
  );
  taggedHTML = taggedHTML.replace(
    /<p id="l-[0-9]+">［＃ここから[３3三]文字下げ］<\/p>/g,
    '<div class="indent-3">'
  );
  taggedHTML = taggedHTML.replace(
    /<p id="l-[0-9]+">［＃ここで字下げ終わり］<\/p>/g,
    "</div>"
  );
  taggedHTML = taggedHTML.replace(
    /<!-- (.+?) -->/g,
    '<div class="comment">$1</div>'
  );
  taggedHTML = taggedHTML.replace(
    /[｜|]([^｜|\n]+?)《([^《]+?)》/g,
    "<ruby>$1<rt>$2</rt></ruby>"
  );
  taggedHTML = taggedHTML.replace(
    /([一-鿏々-〇]+?)《(.+?)》/g,
    "<ruby>$1<rt>$2</rt></ruby>"
  );
  taggedHTML = taggedHTML.replace(
    /(.+?)［＃「\1」に傍点］/g,
    '<em class="side-dot">$1</em>'
  );

  return taggedHTML;
}

let prevSectionStyle = vscode.window.createTextEditorDecorationType({});
let nextSectionStyle = vscode.window.createTextEditorDecorationType({});

export async function previewBesideSection(editor: vscode.TextEditor) {
  if(!getConfig().sceneNav) return;
  //console.log("decoration");
  const decorationsArrayPrev: vscode.DecorationOptions[] = [];
  const decorationsArrayNext: vscode.DecorationOptions[] = [];

  const lastLine = editor.document.lineAt(editor.document.lineCount - 1);

  let range = new vscode.Range(0, 0, 0, 0);
  const decorationPrev = { range };
  decorationsArrayPrev.push(decorationPrev);

  range = new vscode.Range(lastLine.range.end, lastLine.range.end);
  const decorationNext = { range };
  decorationsArrayNext.push(decorationNext);

  getBesideText(editor.document).then((value) => {
    const prevText = value.prevText;
    const nextText = value.nextText;

    const prevDocText = prevText
      .substring(0, 300)
      .replace(/(.{0,30})/g, "$1\\a")
      .replace(/\\a\\a/g, "\\a");

    const nextDocText = nextText
      .substring(0, 300)
      .replace(/(.{0,30})/g, "$1\\a")
      .replace(/\\a\\a/g, "\\a").replace(/\\a$/, "");

    const prevDecorationCss = `;
    display: block;
    opacity: 0.5;
    border-bottom: 1px dotted;
    padding: 0.1em;
    white-space: pre;
    padding-bottom: em;
    height: 2em;
    overflow-y: hidden`;

    const nextDecorationCss = `;
    content: '${nextDocText}……';
    display: block;
    opacity: 0.5;
    border-top: 1px dotted;
    padding: 0.1em;
    white-space: pre;
    margin-top: 0.5em;`;

    const newPrevSectionStyle = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      before: {
        contentText: prevDocText,
        textDecoration: prevDecorationCss,
      },
    });

    const newNextSectionStyle = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      after: {
        textDecoration: nextDecorationCss,
      },
    });

    editor.setDecorations(prevSectionStyle, []);
    editor.setDecorations(nextSectionStyle, []);
    if (value.prevUrl) {
      //editor.setDecorations(newPrevSectionStyle, decorationsArrayPrev);
      prevSectionStyle = newPrevSectionStyle;
    }
    if (value.nextUrl) {
      editor.setDecorations(newNextSectionStyle, decorationsArrayNext);
      nextSectionStyle = newNextSectionStyle;
    }
  });
}

export class MyCodelensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    return new Promise((resolve) => {
      if(!getConfig().sceneNav) return;
      const editor = vscode.window.activeTextEditor;

      //const besides = getBesideText(document);
      getBesideText(document).then((value) => {
        const prevTitle = value.prevTitle;
        const prevText = value.prevText.slice(-30).replace(/\n/g, "");
        const nextTitle = value.nextTitle;
        const prevUrl = value.prevUrl;
        const nextUrl = value.nextUrl;

        const prevLens = {
          command: "Novel.openfile",
          title: prevTitle + " ……"+ prevText,
          tooltip: "前のシーンのファイルを開く",
          arguments: [prevUrl],
        };

        const nextLens = {
          command: "Novel.openfile",
          title: nextTitle,
          tooltip: "次のシーンのファイルを開く",
          arguments: [nextUrl],
        };

        const topOfDocument = new vscode.Range(0, 0, 0, 0);
        let lastLine = editor?.document.lineAt(editor.document.lineCount - 1);
        if (!lastLine?.isEmptyOrWhitespace && nextTitle != "") {
          editor?.edit((edit) => {
            edit.insert(
              new vscode.Position(editor.document.lineCount, lastLine!.range.contains.length),
              "\n"
            );
            lastLine = editor?.document.lineAt(editor.document.lineCount - 1);
          });
        }
        const taleOfDocument = new vscode.Range(
          lastLine!.range.end,
          lastLine!.range.end
        );
  
        const CodeLenses = [];
        if (prevTitle != "")
          CodeLenses.push(new vscode.CodeLens(topOfDocument, prevLens));
        if (nextTitle != "")
          CodeLenses.push(new vscode.CodeLens(taleOfDocument, nextLens));

        resolve(CodeLenses);
      });
    });
  }
}

async function getBesideText(document: vscode.TextDocument): Promise<{
  prevUrl: vscode.Uri | null;
  prevTitle: string;
  prevText: string;
  nextUrl: vscode.Uri | null;
  nextTitle: string;
  nextText: string;
}> {
  const myFileList = fileList(draftRoot());
  const docIndex = myFileList.files.findIndex(
    (e) => e.dir == document.fileName
  );
  let prevDocIndex = null;
  let nextDocIndex = null;
  let prevDocUrl = null;
  let nextDocUrl = null;
  let prevDocTitle = "";
  let nextDocTitle = "";
  let prevDocText = "";
  let nextDocText = "";

  //console.log("探索", docIndex, myFileList.files[docIndex]);
  //前のシーンファイルを探索
  let prevSearchIndex = docIndex - 1;
  while (prevSearchIndex >= 0) {
    if (myFileList.files[prevSearchIndex].dir) {
      // console.log("prevDoc in loop", myFileList.files[prevSearchIndex]);
      prevDocIndex = prevSearchIndex;
      break;
    }
    prevSearchIndex = prevSearchIndex - 1;
  }
  //console.log("pre探索結果", prevDocIndex, myFileList.files[prevDocIndex!]);

  //次のファイルを探索
  let nextSearchIndex = docIndex + 1;
  while (nextSearchIndex < myFileList.files.length) {
    if (myFileList.files[nextSearchIndex].dir) {
      // console.log("nextDoc in loop", myFileList.files[nextSearchIndex]);
      nextDocIndex = nextSearchIndex;
      break;
    }
    nextSearchIndex++;
  }
  //console.log("next探索結果", nextDocIndex, myFileList.files[nextDocIndex!]);

  // 前のファイルが有効な場合
  if (prevDocIndex != null) {
    // console.log("nextDoc", myFileList.files[prevDocIndex]);
    prevDocUrl = vscode.Uri.file(myFileList.files[prevDocIndex].dir!);
    const nextDocData = await vscode.workspace.fs.readFile(prevDocUrl);
    const dataString = Buffer.from(nextDocData).toString("utf8");
    prevDocTitle = "前のシーン：" + myFileList.files[prevDocIndex].name;
    prevDocText = dataString;
  }

  // 次のファイルが有効な場合
  if (nextDocIndex != null) {
    // console.log("nextDoc", myFileList.files[nextDocIndex]);
    nextDocUrl = vscode.Uri.file(myFileList.files[nextDocIndex].dir!);
    const nextDocData = await vscode.workspace.fs.readFile(nextDocUrl);
    const dataString = Buffer.from(nextDocData).toString("utf8");
    nextDocTitle = "次のシーン：" + myFileList.files[nextDocIndex].name;
    nextDocText = dataString;
  }

  return {
    prevUrl: prevDocUrl,
    prevTitle: prevDocTitle,
    prevText: prevDocText,
    nextUrl: nextDocUrl,
    nextTitle: nextDocTitle,
    nextText: nextDocText,
  };
}
