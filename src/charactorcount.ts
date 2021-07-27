//Original code is published by 8amjp/vsce-charactercount] https://github.com/8amjp/vsce-charactercount under MIT

"use strict";
import * as path from 'path';
import { draftsObject } from './compile'; 
import * as TreeModel from 'tree-model';

import { window, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument, workspace } from 'vscode';

import {totalLength, draftRoot} from './compile';
import {NovelGit} from './git';
import simpleGit, {SimpleGit} from 'simple-git';
import {distance} from 'fastest-levenshtein';

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

    private _isEditorChildOfTargetFolder = false;
    timeoutID: any;

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

        const totalCharacterCountNum = projectCharacterCountNum - savedCharacterCountNum + characterCountNum;
        const totalCharacterCount = Intl.NumberFormat().format(totalCharacterCountNum);

        let editDistance = '';
        if(this.ifEditDistance){
            if(this.editDistance == -1){
                editDistance = `／$(record-keys)$(sync)文字`;
            }else if(this.keyPressFlag){
                editDistance = `／$(record-keys)${Intl.NumberFormat().format(this.editDistance)}$(sync)文字`;
            } else{
                editDistance = `／$(record-keys)${Intl.NumberFormat().format(this.editDistance)}文字`;
            }
        }

        if( this._countingFolder != '' ){
            //締め切りフォルダーが設定されている時_countingTargetNum
            let targetNumberTextNum = this._folderCount.amountLengthNum;
            let targetNumberText = Intl.NumberFormat().format(targetNumberTextNum);
            if(this._isEditorChildOfTargetFolder){
                targetNumberTextNum = targetNumberTextNum - savedCharacterCountNum + characterCountNum;
                targetNumberText = Intl.NumberFormat().format(targetNumberTextNum);
            }
            if(this._countingTargetNum != 0){
                targetNumberText += '/' + countingTarget;
            }
            this._statusBarItem.text = ` ${totalCharacterCount}文字  $(folder-opened) ${this._folderCount.label} ${targetNumberText}文字  $(pencil) ${characterCount} 文字${editDistance}`;
        } else {
            this._statusBarItem.text = `$(book) ${totalCharacterCount}文字／$(pencil) ${characterCount} 文字${editDistance}`;
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

            //締め切りフォルダーの更新
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
        if(draftRoot() == ""){
            return 0;
        }
        const tree = new TreeModel();
        const draftTree = tree.parse({dir: draftRoot(),name: 'root',length: 0});
        console.log('rootだけ',draftsObject(draftRoot()));

        draftsObject(draftRoot()).forEach(element => {
          const draftNode = tree.parse(element);
          draftTree.addChild(draftNode);
        });
        const targetFileNode = draftTree.first(node => node.model.dir === dirPath);
        if(targetFileNode){
            return targetFileNode!.model.length;
        } else {
            return 0;
        }
    }

    public _setIfChildOfTarget(): boolean{
        if(draftRoot() == ""){
            return false;
        }
        const tree = new TreeModel();
        const draftTree = tree.parse({dir: draftRoot(),name: 'root',length: 0});
        const activeDocumentPath = window.activeTextEditor?.document.uri.fsPath;

        draftsObject(draftRoot()).forEach(element => {
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
        //this._countingObject = draftsObject(draftRoot());
        return true;
    }

    public editDistance = -1;
    public latestText ='';
    private projectPath: string = workspace.workspaceFolders![0].uri.fsPath;
    public ifEditDistance = false;

    public _setEditDistance(){
        const activeDocumentPath = window.activeTextEditor!.document.uri.fsPath;

        const relatevePath = path.relative(this.projectPath, activeDocumentPath);

        const git: SimpleGit = simpleGit(this.projectPath);
        console.log('git.revparse()',git.revparse(['--is-inside-work-tree']));
        git.revparse('--is-inside-work-tree')
            .then(() => {
            let latestHash = '';
            const logOption = {file: relatevePath,'--until': 'today00:00:00',n: 1};
            let showString = '';
            git.log(logOption)
                .then((logs: any) => {
                    console.log(logs);
                    if(logs.total === 0){
                        window.showInformationMessage(`比較対象になるファイルがGitにコミットされていないようです`);
                        this.ifEditDistance = false;
                        this.latestText = '';
                        this.updateCharacterCount();
                    } else {
                        latestHash = logs.all[0].hash;
                        showString = latestHash+":"+relatevePath;
                        console.log('showString: ',showString);
                        git.show(showString)
                        .then((showLog) =>{
                            if(typeof showLog === 'string'){
                                this.latestText = showLog;
                                this.ifEditDistance = true;
                                this.updateCharacterCount();
                            }
                        })
                        .catch((err) => console.error('failed to git show:', err))
                    }
                })
                .catch((err) => {
                    console.error('failed:',err);
                    window.showInformationMessage(`Gitのレポジトリを確かめてください`);
                    this.ifEditDistance = false;
                    this.latestText = '';
                    this.updateCharacterCount();
                    });
            })
            .catch((err) => {
                console.error('git.revparse:',err);
            })
    }

    public _setLatestUpdate(latestGitText: any){
        this.latestText = latestGitText;
        console.log('latest from Git:', latestGitText);
        this._updateEditDistanceDelay();
    }

    private keyPressFlag = false;

    public _updateEditDistanceActual(){
        const currentText = window.activeTextEditor?.document.getText();
        console.log('現在の原稿',currentText);
        console.log('latestの原稿',this.latestText);
        if(this.latestText != ''){
            this.editDistance = distance(this.latestText, currentText!);
            this.keyPressFlag = false;
            this.updateCharacterCount();
        }
        delete this.timeoutID;
    }

    public _updateEditDistanceDelay(){
        if (!this.keyPressFlag){
            this.keyPressFlag = true;
            const updateCounter = Math.min(
                Math.ceil(
                    window.activeTextEditor!.document.getText().length / 100),
                    500
                );
                console.log('timeoutID',this.timeoutID,updateCounter);
            this.timeoutID = setTimeout(socketServer => {
                this._updateEditDistanceActual();
            }, updateCounter);

            }
        }

    public _timerCancel(){
      if(typeof this.timeoutID == "number") {
        this.clearTimeout(this.timeoutID);
        delete this.timeoutID;
      }
    }

    clearTimeout(timeoutID: number) {
        throw new Error('Method not implemented.');
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
        this._characterCounter._setEditDistance();
        this._characterCounter.updateCharacterCount();

        const subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        workspace.onDidSaveTextDocument(this._onSave, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onFocusChanged, this, subscriptions);

        this._disposable = Disposable.from(...subscriptions);
    }

    private _onEvent() {
        this._characterCounter.updateCharacterCount();
        if(this._characterCounter.ifEditDistance) this._characterCounter._updateEditDistanceDelay();
    }

    private _onFocusChanged() {
        this._characterCounter._setIfChildOfTarget();
        //編集処理の初期化
        this._characterCounter.ifEditDistance = false;
        this._characterCounter.latestText = '';
        this._characterCounter.editDistance = -1;
        this._characterCounter._setEditDistance();
        this._characterCounter._updateCountingObject();
    }

    private _onSave() {
        this._characterCounter._updateCountingObject();
        this._characterCounter._updateProjectCharacterCount();
    }

    public dispose() {
        this._disposable.dispose();
    }
}
