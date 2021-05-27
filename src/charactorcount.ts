//Original code is published by 8amjp/vsce-charactercount] https://github.com/8amjp/vsce-charactercount under MIT

"use strict";
import { window, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument, workspace } from 'vscode';
import {fileList, draftRoot} from './compile';

let projectCharacterCount = Intl.NumberFormat().format(fileList(draftRoot(), 0).length);

export class CharacterCounter {

    private _statusBarItem!: StatusBarItem;
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
        this._statusBarItem.text = `$(pencil) ${characterCount} 文字／$(book) ${projectCharacterCount}文字`;
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
        projectCharacterCount = Intl.NumberFormat().format(fileList(draftRoot(), 0).length);
        this.updateCharacterCount();
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
