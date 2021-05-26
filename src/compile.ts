import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const projectName = vscode.workspace.workspaceFolders![0].name;
const projectPath = vscode.workspace.workspaceFolders![0].uri.fsPath;

//fsモジュールの使い方 https://qiita.com/oblivion/items/2725a4b3ca3a99f8d1a3
export default function compileDocs(): void
{
    //もしも「原稿」あるいは「Draft」フォルダーがあったらその下だけ。なければ最上位パスから再帰処理をする。
    console.log(projectName);
    //ファイル一覧取得
    const projectFiles = fs.readdirSync( projectPath );

    if (projectFiles.includes('Draft') || projectFiles.includes('原稿') ){
        console.log("draft directory exists");
    }

    try {
        console.log(projectFiles)
      } catch (err) {
        console.log(err)
      }
}
