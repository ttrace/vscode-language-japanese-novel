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
    let     draftRootPath : string  = projectPath;

    console.log('ProjectName: ',projectName);
    //ファイル一覧取得
    const projectFiles = fs.readdirSync( projectPath );

    //もしも「原稿」あるいは「Draft」フォルダーがあったらその下だけ。なければ最上位パスから再帰処理をする。
    if (projectFiles.includes('Draft') && fs.statSync(projectPath+'/Draft').isDirectory()){
        draftRootPath = draftRootPath + "/Draft";
    }else if (projectFiles.includes('原稿') && fs.statSync(projectPath+'/原稿').isDirectory()){
        draftRootPath = draftRootPath + "/原稿";
    }

//    const textFiles         = filesInDraftsRoot.filter(file => file.match(/.+.txt$/));

//      publishフォルダがなければ作る
    if (!fs.existsSync( projectPath + '/publish')) {
        fs.mkdirSync(   projectPath + '/publish');
    }

    console.log(fileList(draftRootPath));
//  空のファイルをつくる
    const compiledTextFilePath = projectPath + '/publish/' + projectName + '.txt';
    try {
        fs.writeFileSync( compiledTextFilePath , '')
      } catch (err) {
        console.log('ファイル書き込み時のエラー',err)
      }

//      テキストを書き込む
      const filelist = fileList(draftRootPath);
      filelist.forEach((listItem: { dir: number | fs.PathLike; separator: string; }) => {
          let appendingContext= "";
          if(listItem.dir){
            appendingContext = fs.readFileSync(listItem.dir, 'utf8');
          } else if(listItem.separator){
            appendingContext = separatorString;
          }
          fs.appendFileSync( compiledTextFilePath, appendingContext);
      });
}

function fileList(dirPath: string) : any{
    const filesInDraftsRoot = fs.readdirSync( dirPath , { withFileTypes: true });
    const files = [];
    for (const dirent of filesInDraftsRoot) {
        if (dirent.isDirectory() && dirent.name == "publish"){
            ;
        } else if (dirent.name.match(/^\..*/)){
            ;
        }else if (dirent.isDirectory()) {
          const fp = path.join(dirPath, dirent.name);
          files.push({
              separator: '>',
          }
          );
          files.push(fileList(fp));
        } else if (dirent.isFile() && ['.txt'].includes(path.extname(dirent.name))) {
          files.push({
            dir: path.join(dirPath, dirent.name),
            name: dirent.name,
          });
        }
    }
    return files.flat();
}
