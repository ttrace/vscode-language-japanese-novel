import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

//fsモジュールの使い方 https://qiita.com/oblivion/items/2725a4b3ca3a99f8d1a3
export default function compileDocs(): void
{
    const   projectName             = vscode.workspace.workspaceFolders![0].name;
    const   projectPath: string     = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const   config                  = vscode.workspace.getConfiguration('Novel');
    const   separatorString         = "\n\n　　　" + config.get<string>('compile.separator', '＊') +"\n\n";
    const   draftRootPath           = draftRoot();

    console.log('ProjectName: ',projectName);

    //      publishフォルダがなければ作る
    if (!fs.existsSync( projectPath + '/publish')) {
        fs.mkdirSync(   projectPath + '/publish');
    }

    //  空のファイルをつくる
    const compiledTextFilePath = projectPath + '/publish/' + projectName + '.txt';
    try {
        fs.writeFileSync( compiledTextFilePath , '')
      } catch (err) {
        console.log('ファイル書き込み時のエラー',err)
      }

      //  テキストを書き込む
      const filelist = fileList(draftRootPath, 0).files;
      filelist.forEach((listItem: { dir: number | fs.PathLike; depthIndicator: number; }) => {
          let appendingContext= "";
          if(listItem.dir){
            appendingContext = fs.readFileSync(listItem.dir, 'utf8');
          } else if(listItem.depthIndicator){
            appendingContext = separatorString;
          }
          fs.appendFileSync( compiledTextFilePath, appendingContext);
      });
      console.log(fileList(draftRootPath, 0).files);
}

export function draftRoot(): string{
  const   projectPath: string     = vscode.workspace.workspaceFolders![0].uri.fsPath;
  let     draftRootPath : string  = projectPath;
  const projectFiles = fs.readdirSync( projectPath );
      //「原稿」あるいは「Draft」フォルダーを原稿フォルダのルートにする。
      if (projectFiles.includes('Draft') && fs.statSync(projectPath+'/Draft').isDirectory()){
        draftRootPath = draftRootPath + "/Draft";
    }else if (projectFiles.includes('原稿') && fs.statSync(projectPath+'/原稿').isDirectory()){
        draftRootPath = draftRootPath + "/原稿";
    }

  return draftRootPath;
}

//fileList()は、ファイルパスと（再帰処理用の）ディレクトリ深度を受け取って、ファイルリストの配列と総文字数を返す。
export function fileList(dirPath: string, directoryDeptsh: number) : any{
    let   characterCount    = 0;
    const filesInDraftsRoot = fs.readdirSync( dirPath , { withFileTypes: true });
    const labelOfList = path.basename(dirPath);
    const files = [];
    const maxDirectoryDepth = 6;
    for (const dirent of filesInDraftsRoot) {
        if (dirent.isDirectory() && dirent.name == "publish"){
            console.log('publish folder');
        } else if (dirent.name.match(/^\..*/)){
            console.log('invisible docs');
        }else if (dirent.isDirectory() && directoryDeptsh <= maxDirectoryDepth) {
          const fp = path.join(dirPath, dirent.name);
          const containerFiles = fileList(fp, directoryDeptsh + 1);
          files.push({
              depthIndicator:   directoryDeptsh,
              directoryName:    dirent.name,
              directoryLength:  containerFiles.length,
          });
          characterCount += containerFiles.length;
          files.push(containerFiles.files);
        } else if (dirent.isFile() && ['.txt'].includes(path.extname(dirent.name))) {
          //文字数カウントテスト
          let   readingFile = fs.readFileSync(path.join(dirPath, dirent.name), 'utf-8');
                //カウントしない文字を除外 from https://github.com/8amjp/vsce-charactercount by MIT license
                readingFile = readingFile
                    .replace(/\s/g, '')          // すべての空白文字
                    .replace(/《(.+?)》/g, '')    // ルビ範囲指定記号とその中の文字
                    .replace(/[|｜]/g, '')       // ルビ開始記号
                    .replace(/<!--(.+?)-->/, ''); // コメントアウト
          files.push({
            dir: path.join(dirPath, dirent.name),
            name: dirent.name,
            length: readingFile.length,
          });
          characterCount += readingFile.length;
        }
    }
    //ファイルリストの配列と総文字数を返す
    return {
        label: labelOfList,
        files: files.flat(),
        length: characterCount,
      };
}
