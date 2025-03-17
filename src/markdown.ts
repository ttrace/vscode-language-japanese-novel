import * as vscode from "vscode";
//import { getConfig } from "./config";

export class MarkdownFoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    
    const foldingRanges: vscode.FoldingRange[] = [];
    const regex = /^(#+)\s/; // 見出しを示す正規表現
    let startIndices: number[] = []; // 各レベルの見出しの開始インデックス
    let startLevels: number[] = []; // 各レベルの見出しレベル

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const match = line.text.match(regex);

      if (match) {
        const currentLevel = match[1].length; // 現在の見出しのレベル (# の数)

        // より高いレベルの見出しで折りたたみ範囲を閉じる
        while (startLevels.length && currentLevel <= startLevels[startLevels.length - 1]) {
          const startIdx = startIndices.pop();
          const level = startLevels.pop();
          if (startIdx !== undefined && level !== undefined) {
            foldingRanges.push(new vscode.FoldingRange(startIdx, i - 1));
          }
        }

        // 現在の見出しの開始位置を記録
        startIndices.push(i);
        startLevels.push(currentLevel);
      }
    }

    // ファイル終端まで開いた見出し範囲を閉じる
    while (startLevels.length) {
      const startIdx = startIndices.pop();
      const level = startLevels.pop();
      if (startIdx !== undefined && level !== undefined) {
        foldingRanges.push(new vscode.FoldingRange(startIdx, document.lineCount - 1));
      }
    }

    return foldingRanges;
  }
}

export class MarkdownSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    const symbols: vscode.DocumentSymbol[] = [];
    const regex = /^(#+)\s+(.*)/; // 正規表現で見出しとタイトルをキャプチャ

    let currentLevelSymbols: vscode.DocumentSymbol[] = []; // 階層ごとのシンボルを管理

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const match = line.text.match(regex);

      if (match) {
        const level = match[1].length; // "#"の数でレベルを決定
        const title = match[2].trim(); // 見出しタイトル
        const range = new vscode.Range(i, 0, i, line.text.length);

        const symbol = new vscode.DocumentSymbol(
          title,
          '',
          vscode.SymbolKind.String, // 見出しとしてのシンボル
          range,
          range
        );

        if (currentLevelSymbols.length === 0 || level === 1) {
          // ルートシンボルとして追加
          symbols.push(symbol);
          currentLevelSymbols = [symbol];
        } else {
          // 階層を辿って適切な親を見つける
          let parentSymbol = currentLevelSymbols[currentLevelSymbols.length - 1];
          while (parentSymbol && parentSymbol !== symbols[0] && level <= this.getSymbolLevel(parentSymbol)) {
            currentLevelSymbols.pop();
            parentSymbol = currentLevelSymbols[currentLevelSymbols.length - 1];
          }
          // 親シンボルに子を追加
          parentSymbol.children.push(symbol);
          currentLevelSymbols.push(symbol);
        }
      }
    }

    return symbols;
  }

  private getSymbolLevel(symbol: vscode.DocumentSymbol): number {
    return symbol.range.start.line;
  }
}

