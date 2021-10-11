import * as vscode from 'vscode';
import * as path from 'path';
import simpleGit, {SimpleGit} from 'simple-git';
import {CharacterCounter, CharacterCounterController} from './charactorcount';

//instruction: from https://github.com/steveukx/git-js#readme

export class NovelGit {
    private projectPath: string = vscode.workspace.workspaceFolders![0].uri.fsPath;

    public async _isGitRepo(): Promise<boolean>{
        const git: SimpleGit = simpleGit(this.projectPath);
        if(await git.checkIsRepo()){
            return true;
        } else {
            return false;
        }
    }

    public _getDayBackString(filePath: string): any{
        // https://qiita.com/nju33/items/3905105900e7ae726d19
        // Gitで過去のある時点のファイルの内容を見る
        // git show `git log -1 --format='%h' --before=midnight`:package.json
        //let result = '';
        const relatevePath = path.relative(this.projectPath, filePath);

        const git: SimpleGit = simpleGit(this.projectPath);
        let latestHash = "";

        const logOption = {file: relatevePath,'--before': 'yesterday',n: 1};
        let showString = '';
        git.log(logOption)
            .catch((err) => {
                console.error('failed:',err);
                vscode.window.showInformationMessage(`昨日以前に書かれた原稿がGitにコミットされていないようです`);
                })
            .then((logs: any) => {
                console.log(logs);
                if(logs.total === 0){
                    vscode.window.showInformationMessage(`昨日以前に書かれた原稿がGitにコミットされていないようです`);
                } else {
                    latestHash = logs.all[0].hash;
                    showString = latestHash+":"+relatevePath;
                    console.log('showString: ',showString);
                    git.show(showString)
                    .catch((err) => console.error('failed to git show:', err))
                    .then((showLog) =>{
                        const counter = new CharacterCounter();
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        if(typeof showLog == "string"){
                            counter._setLatestUpdate(showLog);
                            console.log('log of Show: ',showLog);
                        }
                    })
                }
            });
    }
}


