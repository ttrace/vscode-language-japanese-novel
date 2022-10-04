import * as vscode from 'vscode';
import { getConfig } from './config';

export type OriginEditor = vscode.TextEditor | "active" | undefined;

export function editorText(originEditor: OriginEditor): string {
    const myEditor = (originEditor === "active") ? vscode.window.activeTextEditor : originEditor;
    if (!myEditor) {
        return "";
    }
    const text = myEditor.document.getText();
    const cursorOffset = myEditor ? myEditor.document.offsetAt(myEditor.selection.anchor) : 0;
    let myHTML = "";

    let cursorTaggedHtml = "";
    // カーソル位置
    if (text.slice(cursorOffset, cursorOffset + 1) == '\n') {
        cursorTaggedHtml = text.slice(0, cursorOffset) + '<span id="cursor">　</span>' + text.slice(cursorOffset);
    } else {
        cursorTaggedHtml = text.slice(0, cursorOffset) + '<span id="cursor">' + text.slice(cursorOffset, cursorOffset + 1) + '</span>' + text.slice(cursorOffset + 1);
    }

    const paragraphs = cursorTaggedHtml.split('\n');
    //console.log(paragraphs);
    let lineNumber = 0;
    paragraphs.forEach(paragraph => {
        //console.log(paragraph);
        if (paragraph.match(/^\s*$/)) {
            myHTML += `<p id="l-${lineNumber}" class="blank">_${paragraph}</p>`;
        } else if (paragraph.match(/^<span id="cursor">$/) || paragraph.match(/^<\/span>$/)) {
            myHTML += `<p id="l-${lineNumber}" class="blank">_</p><span id="cursor">`;
        } else {
            myHTML += `<p id="l-${lineNumber}">${paragraph}</p>`;
        }
        lineNumber ++;
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
            const thisMatch = new RegExp(element[0], 'gi');
            const thisReplace = element[1];
            taggedHTML = taggedHTML.replace(thisMatch, thisReplace);
            //}
        });
    }

    taggedHTML = taggedHTML.replace(/(?<![0-9\sa-zA-Z"'():])([0-9][0-9])(?![0-9\sa-zA-Z"'():])/g, '<span class="tcy">$1</span>');
    taggedHTML = taggedHTML.replace(/(.+?)［＃「\1」は縦中横］/g, '<span class="tcy">$1</span>');
    taggedHTML = taggedHTML.replace(/<p id="l-[0-9]+">［＃ここから[１1一]文字下げ］<\/p>/g, '<div class="indent-1">');
    taggedHTML = taggedHTML.replace(/<p id="l-[0-9]+">［＃ここから[２2二]文字下げ］<\/p>/g, '<div class="indent-2">');
    taggedHTML = taggedHTML.replace(/<p id="l-[0-9]+">［＃ここから[３3三]文字下げ］<\/p>/g, '<div class="indent-3">');
    taggedHTML = taggedHTML.replace(/<p id="l-[0-9]+">［＃ここで字下げ終わり］<\/p>/g, '</div>');
    taggedHTML = taggedHTML.replace(/<!-- (.+?) -->/g, '<div class="comment">$1</div>');
    taggedHTML = taggedHTML.replace(/｜([^｜\n]+?)《([^《]+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/([一-鿏々-〇]+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/(.+?)［＃「\1」に傍点］/g, '<em class="side-dot">$1</em>');

    return taggedHTML;
}


