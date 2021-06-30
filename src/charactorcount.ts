//Original code is published by 8amjp/vsce-charactercount] https://github.com/8amjp/vsce-charactercount under MIT

"use strict";
import * as path from 'path';
import { draftsObject } from './compile'; 
import * as TreeModel from 'tree-model';

import { window, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument, workspace } from 'vscode';
import {totalLength, draftRoot} from './compile';

let projectCharacterCountNum = 0;

if( draftRoot() != ""){
    projectCharacterCountNum = totalLength(draftRoot());
} else {
    projectCharacterCountNum = 0;
}

export class CharacterCounter {

    private _statusBarItem!: StatusBarItem;
    private _countingFolder = '';
    private _countingTargetNum = 0;
    private _folderCount = {
                            label: '',
                            amountLengthNum: 0,
                            };
    private _countingObject = draftsObject(draftRoot());
    private _isEditorChildOfTargetFolder = false;

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
        const docPath = editor.document.uri.fsPath;
        const characterCountNum = this._getCharacterCount(doc);
        const characterCount = Intl.NumberFormat().format(characterCountNum);
        const countingTarget = Intl.NumberFormat().format(this._countingTargetNum);

        let savedCharacterCountNum = 0;
        
        if( draftRoot() == ""){
            //テキストファイルを直接開いているとき
            this._statusBarItem.text = `$(pencil) ${Intl.NumberFormat().format(this._getCharacterCount(doc))} 文字`;
        } else {
            savedCharacterCountNum = this._lengthByPath(docPath);
        }
        console.log('全キャラクター',projectCharacterCountNum, savedCharacterCountNum, characterCountNum);
        const totalCharacterCountNum = projectCharacterCountNum - savedCharacterCountNum + characterCountNum;
        const totalCharacterCount = Intl.NumberFormat().format(totalCharacterCountNum)

        if( this._countingFolder != '' ){
            //締め切りフォルダーが設定されている時_countingTargetNum
            let targetNumberTextNum = this._folderCount.amountLengthNum;
            let targetNumberText = Intl.NumberFormat().format(targetNumberTextNum);
            if(this._isEditorChildOfTargetFolder){
                //console.log(targetNumberTextNum);
                targetNumberTextNum = targetNumberTextNum - savedCharacterCountNum + characterCountNum;
                targetNumberText = Intl.NumberFormat().format(targetNumberTextNum);
            }
            if(this._countingTargetNum != 0){
                targetNumberText += '/' + countingTarget;
            }
            this._statusBarItem.text = `$(book) ${totalCharacterCount}文字  $(folder-opened) ${this._folderCount.label} ${targetNumberText}文字  $(pencil) ${characterCount} 文字`;
        } else {
            this._statusBarItem.text = `$(book) ${totalCharacterCount}文字／$(pencil) ${characterCount} 文字`;
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
        projectCharacterCountNum = totalLength(draftRoot());
        if(this._countingFolder != ''){

            this._folderCount = {
                label:path.basename(this._countingFolder),
                amountLengthNum: totalLength(this._countingFolder),
            };
        }
        this.updateCharacterCount();
    }

    public _setCounterToFolder( pathToFolder: string, targetCharacter: number ) : any{
        this._countingFolder = pathToFolder;
        this._countingTargetNum = targetCharacter;
        this._updateProjectCharacterCount();
        this._setIfChildOfTarget();
    }

    private _lengthByPath(dirPath: string): number{
        const tree = new TreeModel();
        const draftTree = tree.parse({dir: draftRoot(),name: 'root',length: 0});
      
        this._countingObject.forEach(element => {
          const draftNode = tree.parse(element);
          draftTree.addChild(draftNode);
        });
      
        const targetFileNode = draftTree.first(node => node.model.dir === dirPath);
        return targetFileNode!.model.length;
    }

    public _setIfChildOfTarget(): boolean{
        const tree = new TreeModel();
        const draftTree = tree.parse({dir: draftRoot(),name: 'root',length: 0});
        const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;

        this._countingObject.forEach(element => {
            const draftNode = tree.parse(element);
            draftTree.addChild(draftNode);
          });
        const deadLineFolderNode = draftTree.first(node => node.model.dir === this._countingFolder);

        if(deadLineFolderNode?.hasChildren){
            const treeForTarget = new TreeModel();
            const targetTree = treeForTarget.parse(deadLineFolderNode!.model);

            const ifEditorIsChild = targetTree.first(node => node.model.dir === activeDocumentPath);
            if(ifEditorIsChild){
                this._isEditorChildOfTargetFolder = true;
                return true;
            }
        }

        this._isEditorChildOfTargetFolder = false;

        return false;
    }

    public _updateCountingObject(){
        this._countingObject = draftsObject(draftRoot());
        return true;
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
        //window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);        
        window.onDidChangeActiveTextEditor(this._onFocusChanged, this, subscriptions);

        this._disposable = Disposable.from(...subscriptions);
    }

    private _onEvent() {
        this._characterCounter.updateCharacterCount();
    }

    private _onFocusChanged() {
        this._characterCounter._setIfChildOfTarget();
    }

    private _onSave() {
        this._characterCounter._updateCountingObject();
        this._characterCounter._updateProjectCharacterCount();
    }

    public dispose() {
        this._disposable.dispose();
    }
}
