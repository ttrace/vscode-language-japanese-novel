import * as vscode from "vscode";

export type NovelSettings = {
  draftFileType: string;
  writingDirection: string;
  lineHeightRate: number;
  fontFamily: string;
  fontSize: number;
  lineLength: number;
  linesPerPage: number;
  lineHeight: number;
  pageStarting: string;
  originPageNumber: number;
  numberFormatR: string;
  numberFormatL: string;
  userRegex: Array<[string, string]>;
  separator: string;
  vscodeTheme: vscode.ColorTheme;
  sceneNav: boolean;
  previewAnimate: boolean;
  semanticHighligting: boolean;
  displayProgress: boolean;
  displayEditDistance: boolean;
  displayCountOfNumber: boolean;
  displayCountOfSheet: boolean;
};

export function getConfig(): NovelSettings {
  const config = vscode.workspace.getConfiguration("Novel");

  const draftFileType = config.get<string>("general.filetype", ".txt");
  const lineHeightRate = 1.75;
  const fontFamily = config.get<string>("preview.fontFamily", "serif");
  const writingDirection =
    config.get<string>("preview.writingDirection", "縦") == "縦"
      ? "vertical-rl"
      : "horizontal-tb";
  const lineLength = config.get<number>("preview.lineLength", 40);
  const fontSize = 1 / lineLength; // フォントサイズは行長分の１
  const linesPerPage = config.get<number>("preview.linesPerPage", 10);
  const lineHeight = fontSize * lineHeightRate;
  const pageStarting = config.get<string>("pdf.pageStarting", "左");
  const originPageNumber = config.get<number>("pdf.originPageNumber", 1);
  const numberFormatR = config.get<string>(
    "preview.numberFormatR",
    "${projectTitle} ${typesettingInformation} ${pageNumber}"
  );
  const numberFormatL = config.get<string>(
    "preview.numberFormatL",
    "${pageNumber} ${projectTitle} ${typesettingInformation}"
  );
  const userRegex = config.get<Array<[string, string]>>(
    "preview.userRegex",
    []
  );
  const separator = config.get<string>("compile.separator", "＊");
  const vscodeTheme = vscode.window.activeColorTheme;
  const sceneNav = config.get<boolean>("editor.sceneNavigator", true);
  const previewAnimate = config.get<boolean>("preview.animate", true);
  const semanticHighligting = config.get<boolean>(
    "editor.semanticHighligting",
    true
  );
  const displayProgress = config.get<boolean>("counter.displayProgress", true);
  const displayEditDistance = config.get<boolean>(
    "counter.displayEditDistance",
    true
  );
  const displayCountOfNumber = config.get<boolean>(
    "counter.displayCountOfNumber",
    true
  );
  const displayCountOfSheet = config.get<boolean>(
    "counter.displayCountOfSheet",
    true
  );

  const novelSettings: NovelSettings = {
    draftFileType,
    writingDirection,
    lineHeightRate,
    fontFamily,
    fontSize,
    lineLength,
    linesPerPage,
    lineHeight,
    pageStarting,
    originPageNumber,
    numberFormatR,
    numberFormatL,
    userRegex,
    separator,
    vscodeTheme,
    sceneNav,
    previewAnimate,
    semanticHighligting,
    displayProgress,
    displayEditDistance,
    displayCountOfNumber,
    displayCountOfSheet,
  };
  return novelSettings;
}
