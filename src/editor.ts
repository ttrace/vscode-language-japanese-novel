import * as vscode from 'vscode';

export type OriginEditor = vscode.TextEditor | "active" | undefined;

export function editorText(originEditor: OriginEditor) {
    let myEditor = vscode.window.activeTextEditor;

    if(originEditor === "active"){
        myEditor = vscode.window.activeTextEditor;
    } else {
        myEditor = originEditor;
    }

    const text = myEditor!.document.getText();
    const cursorOffset = myEditor ? myEditor.document.offsetAt(myEditor.selection.anchor) : 0;
    let myHTML = "";

    let cursorTaggedHtml = "";
    // カーソル位置
    if ( text.slice(cursorOffset, cursorOffset + 1) == '\n'){
        cursorTaggedHtml = text.slice(0, cursorOffset) + '<span id="cursor">　</span>' + text.slice(cursorOffset);
    } else {
        cursorTaggedHtml = text.slice(0, cursorOffset) + '<span id="cursor">' + text.slice(cursorOffset, cursorOffset + 1) + '</span>' + text.slice(cursorOffset + 1);
    }

    const paragraphs = cursorTaggedHtml.split('\n');
    //console.log(paragraphs);
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

function markUpHtml( myHtml: string ){
    let taggedHTML = myHtml;
    //configuration 読み込み
    const config = vscode.workspace.getConfiguration('Novel');
    const userRegex = config.get<Array<[string, string]>>('preview.userregex', []);
    if (userRegex.length > 0){
        userRegex.forEach( function(element){
                const thisMatch = new RegExp(element[0], 'gi');
                const thisReplace = element[1];
                taggedHTML = taggedHTML.replace(thisMatch, thisReplace);
            //}
        });
    }

    taggedHTML = taggedHTML.replace(/<p>［＃ここから[１1一]文字下げ］<\/p>/g, '<div class="indent-1">');
    taggedHTML = taggedHTML.replace(/<p>［＃ここから[２2二]文字下げ］<\/p>/g, '<div class="indent-2">');
    taggedHTML = taggedHTML.replace(/<p>［＃ここから[３3三]文字下げ］<\/p>/g, '<div class="indent-3">');
    taggedHTML = taggedHTML.replace(/<p>［＃ここで字下げ終わり］<\/p>/g, '</div>');
    taggedHTML = taggedHTML.replace(/<!-- (.+?) -->/g, '<span class="comment"><span class="commentbody">$1</span></span>');
    taggedHTML = taggedHTML.replace(/｜([^｜\n]+?)《([^《]+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/([一-鿏々-〇]+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    taggedHTML = taggedHTML.replace(/(.+?)［＃「\1」に傍点］/g, '<em class="side-dot">$1</em>');

    return taggedHTML;
}


