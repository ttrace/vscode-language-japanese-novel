import * as vscode from "vscode";
import * as path from "path";
import simpleGit, { SimpleGit } from "simple-git";
// import { CharacterCounter, CharacterCounterController } from "./charactorcount";

//instruction: from https://github.com/steveukx/git-js#readme

export class NovelGit {
  private projectPath: string =
    vscode.workspace.workspaceFolders![0].uri.fsPath;

  public async _isGitRepo(): Promise<boolean> {
    const git: SimpleGit = simpleGit(this.projectPath);
    if (await git.checkIsRepo()) {
      return true;
    } else {
      return false;
    }
  }
  
    // コンストラクタ等その他の実装は省略
  
    public async _getDayBackString(filePath: string): Promise<string> {
      const relatevePath = path.relative(this.projectPath, filePath);
      const git: SimpleGit = simpleGit(this.projectPath);
  
      const logOption = { file: relatevePath, "--before": "yesterday", n: 1 };
  
      return new Promise((resolve, reject) => {
        let showString = "";
        git.log(logOption)
          .then((logs) => {
            if (logs.total === 0) {
              resolve(""); // コミットがない場合は空文字列を返します
            } else {
              const latestHash = logs.latest?.hash;
              showString = `${latestHash}:${relatevePath}`;
              return git.show(showString);
            }
          })
          .then((showLog) => {
            if (typeof showLog === "string") {
              // 文字列を処理し、必要な結果を取得した後、それを解決します。
              resolve(showLog);
            }
          })
          .catch((err) => {
            console.error("failed:", err);
            reject(err);
          });
      });
    }
  
  
}
