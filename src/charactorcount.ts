//Original code is published by 8amjp/vsce-charactercount] https://github.com/8amjp/vsce-charactercount under MIT

"use strict";
import * as path from 'path';
import { window, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument, workspace } from 'vscode';
import {totalLength, draftRoot} from './compile';

let projectCharacterCount = "";

if( draftRoot() != ""){
    projectCharacterCount = Intl.NumberFormat().format(totalLength(draftRoot()));
} else {
    projectCharacterCount = "0";
}

export class CharacterCounter {

    private _statusBarItem!: StatusBarItem;
    private _countingFolder = '';
    private _countingTarget = '0';
    private _folderCount = {
                            label: '',
                            amountLength: '',
                            };
    public updateCharacterCount() {
        if (!this._statusBarItem) {
            this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        } 
        const editor = window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }
        const doc = editor.document;

        const characterCount = Intl.NumberFormat().format(this._getCharacterCount(doc));
        if( draftRoot() == ""){
            //テキストファイルを開いているとき
            this._statusBarItem.text = `$(pencil) ${characterCount} 文字`;
        } else if( this._countingFolder != '' ){
            //締め切りフォルダーが設定されている時
            let targetNumberText = this._folderCount.amountLength;
            if(this._countingTarget != '0'){
                targetNumberText += '/' + this._countingTarget;
            }
            this._statusBarItem.text = `$(book) ${projectCharacterCount}文字  $(folder-opened) ${this._folderCount.label} ${targetNumberText}文字  $(pencil) ${characterCount} 文字`;
        } else {
            this._statusBarItem.text = `$(book) ${projectCharacterCount}文字／$(pencil) ${characterCount} 文字`;
        }
        this._statusBarItem.show();
    }

    public _getCharacterCount(doc: TextDocument): number {
        let docContent = doc.getText();
        // カウントに含めない文字を削除する
        docContent = docContent
            .replace(/\s/g, '')          // すべての空白文字
            .replace(/《(.+?)》/g, '')    // ルビ範囲指定記号とその中の文字
            .replace(/[|｜]/g, '')       // ルビ開始記号
            .replace(/<!--(.+?)-->/, ''); // コメントアウト
        let characterCount = 0;
        if (docContent !== "") {
            characterCount = docContent.length;
        }
        return characterCount;
    }

    public _updateProjectCharacterCount(): any{
        projectCharacterCount = Intl.NumberFormat().format(totalLength(draftRoot()));
        if(this._countingFolder != ''){

            this._folderCount = {
                label:path.basename(this._countingFolder),
                amountLength: Intl.NumberFormat().format(totalLength(this._countingFolder)),
            };
        }
        this.updateCharacterCount();
    }

    public _setCounterToFolder( pathToFolder: string, targetCharacter: number ) : any{
        this._countingFolder = pathToFolder;
        this._countingTarget = Intl.NumberFormat().format(targetCharacter);
        this._updateProjectCharacterCount();
    }



    public dispose() {
        this._statusBarItem.dispose();
    }
}

export class CharacterCounterController {

    private _characterCounter: CharacterCounter;
    private _disposable: Disposable;

    constructor(characterCounter: CharacterCounter) {
        this._characterCounter = characterCounter;
        this._characterCounter.updateCharacterCount();

        const subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        workspace.onDidSaveTextDocument(this._onSave, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        this._disposable = Disposable.from(...subscriptions);
    }

    private _onEvent() {
        this._characterCounter.updateCharacterCount();
    }

    private _onSave() {
        this._characterCounter._updateProjectCharacterCount();
    }

    public dispose() {
        this._disposable.dispose();
    }
}
