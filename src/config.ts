import * as vscode from "vscode";

export type NovelSettings = {
  lineHeightRate: number;
  fontFamily: string;
  fontSize: number;
  lineLength: number;
  linesPerPage: number;
  lineHeight: number;
  userRegex: Array<[string, string]>;
  separator: string;
};

export function getConfig(): NovelSettings {
  const config = vscode.workspace.getConfiguration("Novel");

  const lineHeightRate = 1.75;
  const fontFamily = config.get<string>("preview.fontFamily", "serif");
  const lineLength = config.get<number>("preview.lineLength", 40);
  const fontSize = 1 / lineLength; // フォントサイズは行長分の１
  const linesPerPage = config.get<number>("preview.linesPerPage", 10);
  const lineHeight = fontSize * lineHeightRate;
  const userRegex = config.get<Array<[string, string]>>(
    "preview.userRegex",
    []
  );
  const separator = config.get<string>("compile.separator", "＊");
  const vscodeTheme = vscode.window.activeColorTheme;

  const novelSettings = {
    lineHeightRate,
    fontFamily,
    fontSize,
    lineLength,
    linesPerPage,
    lineHeight,
    userRegex,
    separator,
    vscodeTheme,
  };
  return novelSettings;
}
