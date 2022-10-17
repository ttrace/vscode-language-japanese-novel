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
      '<span id="cursor">　</span>' +
      text.slice(cursorOffset);
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
    /｜([^｜\n]+?)《([^《]+?)》/g,
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

let nextSectionStyle = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  after: {
    color: "#fff",
    backgroundColor: "#333",
    textDecoration: `;
      display: block;
      widht: 100%;
      padding: 0.1em;
      margin: 0em;
      margin-top: 0em;
      border-radius: 0.2em;
      font-size: 0.75em;
      `,
  },
});

export async function previewBesideSection(editor: vscode.TextEditor) {
  console.log("decoration");
  const decorationsArrayNext: vscode.DecorationOptions[] = [];

  const myFileList = fileList(draftRoot());
  const docIndex = myFileList.files.findIndex(
    (e: any) => e.dir == editor.document.fileName
  );
  let nextDocIndex = null;

  //次のファイルがディレクトリの場合
  for (let index = docIndex + 1; index < myFileList.files.length; index++) {
    if (myFileList.files[index].dir) {
      console.log("nextDoc in loop", myFileList.files[index]);
      nextDocIndex = index;
      break;
    }
    nextDocIndex = null;
  }

  // 末尾の場合
  if (nextDocIndex == null) return;

  console.log("nextDoc", myFileList.files[nextDocIndex]);
  const nextDocData = await vscode.workspace.fs.readFile(
    vscode.Uri.file(myFileList.files[nextDocIndex].dir)
  );
  const nextDocText = Buffer.from(nextDocData)
    .toString("utf8")
    .substring(0, 300)
    .replace(/([^\n]{0,30})/g, "$1\\a")
    .replace(/\n/g, "");
  console.log(nextDocText);
  const textDecorationCss = `;
  content: '${nextDocText}';
  display: block;
  opacity: 0.5;
  border-top: 1px dotted;
  padding: 0.1em;
  white-space: pre;
  margin-top: 0.5em;`;
  const newNextSectionStyle = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    after: {
      textDecoration: textDecorationCss,
      // contentText: `${myFileList.files[nextDocIndex].name} ${nextDocText.substring(0, 400)}……`,
    },
  });

  const firstLine = editor.document.lineAt(0);
  const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
  const prevRange = new vscode.Range(lastLine.range.end, lastLine.range.end);
  const range = new vscode.Range(lastLine.range.end, lastLine.range.end);

  const decorationNext = { range };
  decorationsArrayNext.push(decorationNext);

  editor.setDecorations(nextSectionStyle, []);
  editor.setDecorations(newNextSectionStyle, decorationsArrayNext);
  nextSectionStyle = newNextSectionStyle;
}

export class MyCodelensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    return new Promise((resolve, reject) =>{
      const editor = vscode.window.activeTextEditor;
      const topOfDocument = new vscode.Range(0, 0, 0, 0);
      const lastLine = editor?.document.lineAt(editor.document.lineCount - 1);
      const taleOfDocument = new vscode.Range(
        lastLine!.range.end,
        lastLine!.range.end
      );
  
      //const besides = getBesideText(document);
      getBesideText(document).then(value => {
        const prevTitle = value.prevText;
        const nextTitle = value.nextText;
        const prevUrl = value.prevUrl;
        const nextUrl = value.nextUrl;
  
        const prevLens = {
          command: "Novel.openfile",
          title: prevTitle,
          tooltip: "前のシーンのファイルを開く",
          arguments: [prevUrl],
        };
    
        const nextLens = {
          command: "Novel.openfile",
          title: nextTitle,
          tooltip: "次のシーンのファイルを開く",
          arguments: [nextUrl],
    
        };
        
        const CodeLenses = [];
        if(prevTitle!="")CodeLenses.push(new vscode.CodeLens(topOfDocument, prevLens))
        if(nextTitle!="")CodeLenses.push(new vscode.CodeLens(taleOfDocument, nextLens))
        // const prevSection = new vscode.CodeLens(topOfDocument, prevLens);
        // const nextSection = new vscode.CodeLens(taleOfDocument, nextLens);
    
        resolve(CodeLenses);
      });
    });
    
  }
}

async function getBesideText(document: vscode.TextDocument): Promise<{
  prevUrl: vscode.Uri| null;
  prevText: string;
  nextUrl: vscode.Uri| null;
  nextText: string;
}> {
  const myFileList = fileList(draftRoot());
  const docIndex = myFileList.files.findIndex(
    (e: any) => e.dir == document.fileName
  );
  let prevDocIndex = null;
  let nextDocIndex = null;
  let prevDocUrl = null;
  let nextDocUrl = null;
  let prevDocText = "";
  let nextDocText = "";

  console.log("探索", docIndex, myFileList.files[docIndex]);
  //前のシーンファイルを探索
  let prevSearchIndex = docIndex - 1;
  while (prevSearchIndex >= 0) {
    if (myFileList.files[prevSearchIndex].dir) {
      console.log("prevDoc in loop", myFileList.files[prevSearchIndex]);
      prevDocIndex = prevSearchIndex;
      break;
    }
    prevSearchIndex = prevSearchIndex - 1;
  }
  console.log("pre探索結果", prevDocIndex, myFileList.files[prevDocIndex!]);

  //次のファイルを探索
  let nextSearchIndex = docIndex + 1;
  while (nextSearchIndex < myFileList.files.length) {
    if (myFileList.files[nextSearchIndex].dir) {
      console.log("nextDoc in loop", myFileList.files[nextSearchIndex]);
      nextDocIndex = nextSearchIndex;
      break;
    }
    nextSearchIndex++;
  }
  console.log("next探索結果", nextDocIndex, myFileList.files[nextDocIndex!]);

  // 前のファイルが有効な場合
  if (prevDocIndex != null) {
    console.log("nextDoc", myFileList.files[prevDocIndex]);
    prevDocUrl = vscode.Uri.file(myFileList.files[prevDocIndex].dir);
    const nextDocData = await vscode.workspace.fs.readFile(prevDocUrl);
    const dataString = Buffer.from(nextDocData).toString("utf8");
    prevDocText =
      "前のシーン：" +
      myFileList.files[prevDocIndex].name +
      "　〜" +
      dataString.slice(-30).replace(/\n/g, "");
  }

  // 次のファイルが有効な場合
  if (nextDocIndex != null) {
    console.log("nextDoc", myFileList.files[nextDocIndex]);
    nextDocUrl = vscode.Uri.file(myFileList.files[nextDocIndex].dir);
    const nextDocData = await vscode.workspace.fs.readFile(nextDocUrl);
    const dataString = Buffer.from(nextDocData).toString("utf8");
    nextDocText =
      "次のシーン：" +
      myFileList.files[nextDocIndex].name;
  }

  return {
    prevUrl: prevDocUrl,
    prevText: prevDocText,
    nextUrl: nextDocUrl,
    nextText: nextDocText,
  };
}
