import * as vscode from "vscode";
import { Position, Range } from "vscode";
import { builder, IpadicFeatures, TokenizerBuilder, Tokenizer } from "kuromoji";
import { getConfig } from "./config";

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

let tokenizeFlag = false;

export const legend = (function () {
  const tokenTypesLegend = [
    "proper_noun",
    "noun",
    "keyword",
    "punctuation",
    "bracket",
    "adverb",
    "interjection",
    "adjective",
    "particle",
    "auailiary_verb",
    "verb",
    "pronoun",
    "personal_pronoun",
    "enum",
    "suffix",
    "function",
    "method",
    "decorator",
    "macro",
    "variable",
    "parameter",
    "property",
    "label",
  ];
  tokenTypesLegend.forEach((tokenType, index) =>
    tokenTypes.set(tokenType, index),
  );

  const tokenModifiersLegend = ["dialogue", "quote", "aozora", "comment"];
  tokenModifiersLegend.forEach((tokenModifier, index) =>
    tokenModifiers.set(tokenModifier, index),
  );

  return new vscode.SemanticTokensLegend(
    tokenTypesLegend,
    tokenModifiersLegend,
  );
})();

//let kuromojiDictPath = '';
let kuromojiBuilder: TokenizerBuilder<IpadicFeatures>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let tokenCaching = false;
export let kuromojiDictPath = "";

export const tokenizer = () =>
  new Promise<Tokenizer<IpadicFeatures>>((done) => {
    kuromojiBuilder.build((_err, tokenizer) => {
      done(tokenizer);
    });
  });

export function activateTokenizer(
  context: vscode.ExtensionContext,
  kuromojiPath: string,
) {
  kuromojiDictPath = kuromojiPath;
  kuromojiBuilder = builder({
    dicPath: kuromojiPath,
  });

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "novel" },
      new DocumentSemanticTokensProvider(),
      legend,
    ),
  );

  const tokenizeSetting = getConfig().semanticHighligting;
  // console.log("ハイライト！", tokenizeSetting);
  tokenizeFlag = typeof tokenizeSetting == "boolean" ? tokenizeSetting : true;
}

interface IParsedToken {
  line: number;
  startCharacter: number;
  length: number;
  tokenType: string;
  tokenModifiers: string[];
}
let chachedToken: IParsedToken[] = [];

export class DocumentSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    // token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    //const allTokens = this._parseText(document.getText());
    return new Promise((resolve) => {
      if (tokenizeFlag === true) {
        // const r: number[][] = [];
        const builder = new vscode.SemanticTokensBuilder();
        // const startTime = performance.now();

        kuromojiBuilder.build(
          async (err: Error, tokenizer: Tokenizer<IpadicFeatures>) => {
            // 辞書がなかったりするとここでエラーになります(´・ω・｀)
            if (err) {
              console.dir("Kuromoji initialize error:" + err.message);
              throw err;
            }
            tokenCaching = true;
            //		for (let i = 0; i < lines.length; i++) {
            let i = 0;
            //const line = lines[i];

            // tokenizer.tokenize に文字列を渡すと、その文を形態素解析してくれます。
            const kuromojiToken = tokenizer.tokenize(
              document.getText().replace(/\n\x20/g, "\n→"),
            );

            // console.dir(kuromojiToken);
            let lineOffset = 0;
            let openOffset = 0;
            let closeOffset = 0;
            let j = 0;

            let isDialogue = false;
            let isQuote = false;
            let isMarkedProperNoun = false;
            let isRuby = false;
            let isComment = false;
            let indentIndex = 0;
            // let currentTokenModifire = ""; //現在（直前）のトークンモディファイア
            let debugNum = { debug: false };
            let previousToken: IpadicFeatures = {
              word_id: 0,
              word_type: "",
              word_position: 0,
              surface_form: "",
              pos: "",
              pos_detail_1: "",
              pos_detail_2: "",
              pos_detail_3: "",
              conjugated_type: "",
              conjugated_form: "",
              basic_form: "",
              reading: undefined,
              pronunciation: undefined,
            };

            // console.log(kuromojiToken);
            for await (let mytoken of kuromojiToken) {
              let nextToken: IpadicFeatures = {
                word_id: 0,
                word_type: "",
                word_position: 0,
                surface_form: "",
                pos: "",
                pos_detail_1: "",
                pos_detail_2: "",
                pos_detail_3: "",
                conjugated_type: "",
                conjugated_form: "",
                basic_form: "",
                reading: undefined,
                pronunciation: undefined,
              };
              mytoken = kuromojiToken[j];
              if (j < kuromojiToken.length - 1) {
                nextToken = kuromojiToken[j + 1];
              }

              let wordLength = 0;
              wordLength = mytoken.surface_form.length;

              //改行処理
              if (mytoken.surface_form.match(/\n/)) {
                i += mytoken.surface_form.match(/\n/g)!.length;
                //複数の改行が重なるとKuromojiは'\n\n'のように返す。
                lineOffset =
                  mytoken.word_position + mytoken.surface_form.length - 1;
                openOffset = 0;
                wordLength = 0;
                isRuby = false;
                isQuote = false;
                isComment = false;
                if (nextToken.surface_form == "→") {
                  //lineOffset++;
                }
                //	console.log('line-feed:' + i + ": " + lineOffset);
              } else {
                openOffset = mytoken.word_position - lineOffset - 1;
              }

              let tokenActivity = false;
              let kind = mytoken.pos;
              //console.log(mytoken.surface_form);
              if (kind == "名詞") kind = "noun";
              if (mytoken.pos == "名詞" && mytoken.pos_detail_1 == "固有名詞") {
                kind = "proper_noun";
                tokenActivity = true;
              }
              if (mytoken.pos == "名詞" && mytoken.pos_detail_1 == "代名詞") {
                kind = "pronoun";
                tokenActivity = true;
              }
              if (
                mytoken.surface_form.match(
                  /^(私|わたし|わたくし|我|われ|あたし|僕|ぼく|俺|おれ|貴方|あなた|あんた|お前|おまえ|君|きみ|てめえ|彼|かれ|彼女|彼女|あいつ|そいつ|こいつ|奴|やつ)$/,
                ) &&
                mytoken.pos_detail_1 == "代名詞"
              ) {
                kind = "personal_pronoun";
                tokenActivity = true;
              }
              if (kind == "記号") kind = "punctuation";
              tokenActivity = true;

              if (
                mytoken.pos_detail_1.match(/括弧./) ||
                mytoken.surface_form.match(/(》|［＃「)/)
              ) {
                kind = "bracket";
                tokenActivity = true;
              }

              if (kind == "動詞") kind = "verb";
              tokenActivity = true;
              if (mytoken.pos_detail_1 == "数") kind = "enum";
              tokenActivity = true;
              if (kind == "noun" && mytoken.pos_detail_1 == "接尾")
                kind = "suffix";
              tokenActivity = true;

              if (kind == "助動詞") kind = "auailiary_verb";
              tokenActivity = true;
              if (kind == "助詞") {
                kind = "particle";
                tokenActivity = true;
              }
              if (kind == "副詞") kind = "adverb";
              tokenActivity = true;
              if (kind == "感動詞") kind = "interjection";
              tokenActivity = true;
              if (kind == "形容詞") kind = "adjective";
              tokenActivity = true;

              if (
                kind == "noun" &&
                mytoken.pos_detail_1 == "サ変接続" &&
                nextToken.word_id != 0
              ) {
                kind = nextToken.conjugated_type.match(/^サ変/)
                  ? "verb"
                  : "noun";
              }

              let tokenModifireType = "";

              //会話モディファイア
              if (mytoken.surface_form == "「") {
                isDialogue = true;
              }
              if (isDialogue == true) {
                tokenModifireType = "dialogue";
              }
              if (
                mytoken.surface_form == "」" ||
                mytoken.surface_form.match(/」$/)
              ) {
                if (!isRuby) {
                  isDialogue = false;
                }
                kind = "bracket";
              }

              //引用モディファイア
              if (mytoken.surface_form == "『") isQuote = true;
              if (isQuote == true) {
                tokenModifireType = "quote";
              }
              if (mytoken.surface_form == "』") isQuote = false;

              //固有名詞モディファイア
              if (mytoken.surface_form == "〈") isMarkedProperNoun = true;
              if (isMarkedProperNoun == true) {
                kind = "proper_noun";
              }
              if (mytoken.surface_form == "〉") isMarkedProperNoun = false;

              //ルビモディファイア
              if (mytoken.surface_form === "《") {
                kind = "bracket";
                //  debugNum = {debug:true};
                // console.log("debug",previousToken, mytoken);
                if (openOffset === 0 || previousToken.surface_form === "。") {
                  isDialogue = true;
                  tokenModifireType = "dialogue";
                } else {
                  isRuby = true;
                  tokenModifireType = "aozora";
                }
              } //else {
              debugNum = { debug: false };
              // }

              if (isRuby == true) {
                tokenModifireType = "aozora";
              }
              if (mytoken.surface_form === "》") {
                kind = "bracket";
                if (isRuby) {
                  isRuby = false;
                } else if (isDialogue) {
                  isDialogue = false;
                }
              }

              //青空注記モディファイア
              if (
                (mytoken.surface_form == "［" &&
                  nextToken.surface_form.match(/^＃/)) ||
                mytoken.surface_form.match(/^［＃/)
              )
                isRuby = true;
              if (isRuby == true) {
                tokenModifireType = "aozora";
              }
              if (mytoken.surface_form == "］") {
                isRuby = false;
                kind = "bracket";
              }

              //コメントアウト
              if (mytoken.surface_form === "<!--") {
                isComment = true;
                kind = "bracket";
              }
              if (isComment === true) {
                tokenModifireType = "comment";
              }
              if (mytoken.surface_form === "-->") {
                isComment = false;
                kind = "bracket";
              }

              closeOffset = openOffset + wordLength;
              previousToken = mytoken;
              // const tokenData = parseTextToken(
              //   document.getText().substring(openOffset, closeOffset)
              // );
              const tokenModifierNum = encodeTokenModifiers([
                tokenModifireType,
              ]);

              if (tokenActivity == true) {
                // currentTokenModifire = tokenModifireType;
                builder.push(
                  i,
                  openOffset,
                  wordLength,
                  encodeTokenType(kind),
                  tokenModifierNum,
                );
                // if(debugNum.debug){
                //   console.log(
                //     "debug",
                //     previousToken
                //   );
                // }
                //	console.log(i + ':' + j + '/' + openOffset + ':' + mytoken.surface_form);
              }
              openOffset = closeOffset;
              if (j == kuromojiToken.length - 1) {
                //const endTime = performance.now();

                resolve(builder.build());
                //const builder = new vscode.SemanticTokensBuilder();
                //return builder.build();
              }
              j++;
            }
          },
        );
      } else {
        const builder = new vscode.SemanticTokensBuilder();
        builder.push(0, 0, 0, 0, 0);
        resolve(builder.build());
      }
    });
  }

  async provideDocumentSemanticTokensEdits(
    document: vscode.TextDocument,
    previousResultId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken,
  ): Promise<vscode.SemanticTokens | vscode.SemanticTokensEdits> {
    //return new Promise((resolve, reject) => {
    // console.log("edit");
    console.dir("previousResultId" + previousResultId);
    // const resultTokensId = {
    //   start: 0,
    //   deleteCount: 1,
    //   data: [3],
    // };
    return new vscode.SemanticTokensEdits([], "0");
    //});
  }

  private _encodeTokenType(tokenType: string): number {
    if (tokenTypes.has(tokenType)) {
      return tokenTypes.get(tokenType)!;
    } else if (tokenType === "notInLegend") {
      return tokenTypes.size + 2;
    }
    return 0;
  }

  private _encodeTokenModifiers(strTokenModifiers: string[]): number {
    let result = 0;
    for (let i = 0; i < strTokenModifiers.length; i++) {
      const tokenModifier = strTokenModifiers[i];
      if (tokenModifiers.has(tokenModifier)) {
        result = result | (1 << tokenModifiers.get(tokenModifier)!);
      } else if (tokenModifier === "notInLegend") {
        result = result | (1 << (tokenModifiers.size + 2));
      }
    }
    return result;
  }

  private _parseText() {
    const lineText = vscode.window.activeTextEditor?.document.lineAt(
      vscode.window.activeTextEditor?.selection.active.line,
    );
    if (
      lineText != undefined &&
      typeof lineText.text == "string" &&
      typeof lineText?.lineNumber == "number" &&
      lineTokenCaching == false
    ) {
      // console.log(lineText);
      morphemeBuilder(lineText.text);
    }

    // console.log("parse_text");
    return chachedToken;
  }

  private _parseTextToken(text: string): {
    tokenType: string;
    tokenModifiers: string[];
  } {
    const parts = text.split(".");
    return {
      tokenType: parts[0],
      tokenModifiers: parts.slice(1),
    };
  }
}

function encodeTokenModifiers(strTokenModifiers: string[]): number {
  let result = 0;
  for (let i = 0; i < strTokenModifiers.length; i++) {
    const tokenModifier = strTokenModifiers[i];
    if (tokenModifiers.has(tokenModifier)) {
      result = result | (1 << tokenModifiers.get(tokenModifier)!);
    } else if (tokenModifier === "notInLegend") {
      result = result | (1 << (tokenModifiers.size + 2));
    }
  }
  return result;
}

function encodeTokenType(tokenType: string): number {
  if (tokenTypes.has(tokenType)) {
    return tokenTypes.get(tokenType)!;
  } else if (tokenType === "notInLegend") {
    return tokenTypes.size + 2;
  }
  return 0;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let lineTokenCaching = false;

export function clearChachedToken() {
  chachedToken = [];
}

export function morphemeBuilder(text: string) {
  //return new Promise((resolve, reject) => {
  kuromojiBuilder.build(
    async (err: Error, tokenizer: Tokenizer<IpadicFeatures>) => {
      lineTokenCaching = true;
      if (err) {
        console.dir("Kuromoji initialize error:" + err.message);
        throw err;
      }
      const kuromojiToken = tokenizer.tokenize(text);
      let regexString = "";
      let i = 0;
      for await (let mytoken of kuromojiToken) {
        mytoken = kuromojiToken[i];
        regexString += "(" + mytoken.surface_form + ")|";
        i++;
      }
      // const wordPatternRegex = new RegExp(regexString);
      // console.log("Regex" + wordPatternRegex);
      return regexString;
    },
  );
}

// 以下、たる変換
export async function changeTenseAspect() {
  const editor = vscode.window.activeTextEditor;
  const document = vscode.window.activeTextEditor?.document;
  const lineString = document?.lineAt(editor!.selection.active.line).text;
  //空行の時は動作しない
  if (lineString == "" || lineString == "　" || lineString == undefined) return;
  const cursorPosition = editor!.selection.start;

  // const startTime = performance.now();

  //Kuromoji開始
  const kuromoji = await tokenizer();

  const kuromojiToken = kuromoji.tokenize(lineString);

  //console.log(lineString, cursorPosition, kuromojiToken);
  const punctuationList = kuromojiToken.filter(
    (t: { surface_form: string }) => t.surface_form === "。",
  );
  let targetSentence = 0;
  let processingSentence = 0;
  for (
    let sentenceIndex = 0;
    sentenceIndex < punctuationList.length;
    sentenceIndex++
  ) {
    const punctuation = punctuationList[sentenceIndex];
    if (cursorPosition.character < punctuation.word_position) {
      targetSentence = sentenceIndex;
      break;
    }
  }

  for (let i = 0; i < kuromojiToken.length; i++) {
    const token = kuromojiToken[i];
    const nextToken = kuromojiToken[i + 1];
    const secondNextToken = kuromojiToken[i + 2];
    if (token.surface_form === "。") {
      processingSentence++;
      if (processingSentence > punctuationList.length - 1)
        processingSentence = punctuationList.length - 1;
    }

    // 対象の文だけ処理する
    if (processingSentence === targetSentence) {
      // 自立「〜る」の変換
      if (
        token.conjugated_form === "基本形" &&
        token.conjugated_type.match(/.+ガ行$/) &&
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)[ぐ]/,
          "$1いだ",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.conjugated_form === "基本形" &&
        token.conjugated_type.match(/.+サ行$/) &&
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)[す]/,
          "$1した",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.conjugated_form === "基本形" &&
        token.conjugated_type.match(/.+[タラ]行$/) &&
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)[くる]/,
          "$1った",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.conjugated_form === "基本形" &&
        token.conjugated_type.match(/.+[ナマバ]行$/) &&
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)[ぬむぶ]/,
          "$1んだ",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.conjugated_form === "基本形" &&
        token.basic_form.match(/笑う|厭う|請う/) && //ワ行の例外
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)う/,
          "$1うた",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.conjugated_form === "基本形" &&
        token.conjugated_type === "カ変・クル" && //例外：来る, くる
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        let attributedVerbeForm = "";
        if (token.surface_form === "くる") {
          attributedVerbeForm = "きた";
        } else {
          attributedVerbeForm = token.surface_form.replace(/(.+)る/, "$1た");
        }
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.conjugated_form === "基本形" &&
        token.conjugated_type.match(/.+促音便$/) &&
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)[くつう]/,
          "$1った",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.conjugated_form === "基本形" &&
        token.conjugated_type.match(/.+イ音便$/) &&
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)[く]/,
          "$1いた",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.pos === "動詞" &&
        token.surface_form.match(/.+る$/) &&
        nextToken.pos_detail_1 === "句点" &&
        nextToken.surface_form === "。"
      ) {
        const attributedVerbeForm = token.surface_form.replace(
          /(.+)る/g,
          "$1た",
        );
        // range作成。元のトークンを置き換える場合
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          token.word_position + token.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        changeText(verbRange, attributedVerbeForm);
      } else if (
        token.pos === "動詞" &&
        nextToken.conjugated_type === "特殊・タ" &&
        secondNextToken.pos_detail_1 === "句点"
      ) {
        const attributedVerbeForm = token.basic_form;
        const verbPositionStart = new Position(
          cursorPosition.line,
          token.word_position - 1,
        );
        const verbPositionEnd = new Position(
          cursorPosition.line,
          nextToken.word_position + nextToken.surface_form.length - 1,
        );
        const verbRange = new Range(verbPositionStart, verbPositionEnd);
        // const endTime = performance.now();
        //        console.log("処理時間！", endTime - startTime);

        //console.log(cursorPosition.character, processingSentence, attributedVerbeForm);
        changeText(verbRange, attributedVerbeForm);
      }
    }
  }
}

export async function addRuby() {
  const editor = vscode.window.activeTextEditor;
  if (editor == null) return; // エディターがない時は動作しない
  const document = vscode.window.activeTextEditor?.document;
  const lineString = document?.lineAt(editor.selection.active.line).text;
  const selection = editor.selection;

  //空行の時は動作しない
  if (lineString == "" || lineString == "　" || lineString == undefined) return;
  //複数行の時は動作しない
  if (!selection.isSingleLine) return;

  //選択範囲がある場合
  if (!selection.isEmpty) {
    // console.log("ルビ選択範囲あり", editor.document.getText(selection));
    const baseString = editor.document.getText(selection);
    const ruby = await vscode.window.showInputBox({
      title: "ルビの入力",
      prompt: "ルビを入力してください",
      placeHolder: baseString,
    });
    if (ruby == "") return;
    if (ruby == undefined) return;
    const replaceRange = new Range(selection.start, selection.end);
    const rubyString = baseString.match(/^([一-鿏々-〇]+?)$/)
      ? `${baseString}《${ruby}》`
      : `｜${baseString}《${ruby}》`;
    changeText(replaceRange, rubyString);

    return;
  }

  //Kuromoji開始
  const kuromoji = await tokenizer();

  const kuromojiToken = kuromoji.tokenize(lineString);
  const frontWordsList = kuromojiToken.filter(
    (token: IpadicFeatures) =>
      selection.start.character <=
      token.word_position - 1 + token.basic_form.length,
  );
  // console.log("ルビ位置", selection.start.character);
  // console.log("カーソル前方の単語", frontWordsList);

  const targetWord = frontWordsList[0];
  const baseString = targetWord.basic_form;
  // カタカナをひらがなに
  const placeHolderRuby = targetWord.reading
    ? targetWord.reading.replace(/[ァ-ン]/g, function (s: string) {
        return String.fromCharCode(s.charCodeAt(0) - 0x60);
      })
    : "";
  // console.log("ターゲット", frontWordsList, targetWord, placeHolderRuby);
  const ruby = await vscode.window.showInputBox({
    title: "ルビの入力",
    prompt: "ルビを入力してください",
    placeHolder: placeHolderRuby,
    value: placeHolderRuby,
  });
  if (ruby == undefined) return;
  const replaceStart = new Position(
    selection.start.line,
    targetWord.word_position - 1,
  );
  const replaceEnd = new Position(
    selection.start.line,
    targetWord.word_position - 1 + targetWord.basic_form.length,
  );
  const replaceRange = new Range(replaceStart, replaceEnd);

  const rubyString = baseString.match(/^([一-鿏々-〇]+?)$/)
    ? `${baseString}《${ruby}》`
    : `｜${baseString}《${ruby}》`;
  changeText(replaceRange, rubyString);

  return;
}

// 圏点挿入
export async function addSesami() {
  console.log("圏点！");
  const editor = vscode.window.activeTextEditor;
  if (editor == null) return; // エディターがない時は動作しない
  const document = vscode.window.activeTextEditor?.document;
  const lineString = document?.lineAt(editor.selection.active.line).text;
  const selection = editor.selection;

  //空行の時は動作しない
  if (lineString == "" || lineString == "　" || lineString == undefined) return;
  //複数行の時は動作しない
  if (!selection.isSingleLine) return;

  if (!selection.isEmpty) {
    // console.log("ルビ選択範囲あり", editor.document.getText(selection));
    const baseString = editor.document.getText(selection);
    const replaceRange = new Range(selection.start, selection.end);
    const sesamiString = `${baseString}［＃「${baseString}」に傍点］`;
    changeText(replaceRange, sesamiString);
    return;
  }
}

//文字の挿入
function changeText(range: vscode.Range, text: string) {
  const editor = vscode.window.activeTextEditor;
  editor?.edit((TextEditorEdit: vscode.TextEditorEdit) => {
    TextEditorEdit.replace(range, text);
  });
}

// 文節のグループ化処理
function chunkBunsetsu(
  tokens: IpadicFeatures[],
): { bunsetsu: IpadicFeatures[]; length: number }[] {
  const bunsetsuList: { bunsetsu: IpadicFeatures[]; length: number }[] = [];
  let currentBunsetsu: IpadicFeatures[] = [];
  let currentLength = 0;

  tokens.forEach((token) => {
    // 名詞、動詞、形容詞、副詞で新しい文節を始める判断をする
    if (currentBunsetsu.length === 0 || isNewBunsetsuStart(token)) {
      if (currentBunsetsu.length > 0) {
        bunsetsuList.push({ bunsetsu: currentBunsetsu, length: currentLength });
      }
      currentBunsetsu = [token];
      currentLength = token.surface_form.length;
    } else {
      currentBunsetsu.push(token);
      currentLength += token.surface_form.length;
    }
  });

  if (currentBunsetsu.length > 0) {
    bunsetsuList.push({ bunsetsu: currentBunsetsu, length: currentLength });
  }

  return bunsetsuList;
}

function isNewBunsetsuStart(token: IpadicFeatures): boolean {
  const startPos = ["名詞", "動詞", "形容詞", "副詞"];
  return startPos.includes(token.pos);
}

// カレント文節を前に移動する関数
export async function moveWordBackward() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const lineString = document.lineAt(editor.selection.active.line).text;
  const selection = editor.selection;

  if (!selection.isSingleLine || !lineString) return;

  const kuromoji = await tokenizer();
  const tokens = kuromoji.tokenize(lineString);
  const bunsetsus = chunkBunsetsu(tokens);

  const result = getSelectedBunsetsuRange(bunsetsus, selection);
  if (!result) return;

  const { selectedBunsetsus, startIndex } = result;

  if (startIndex > 0) {
    const previousChunk = bunsetsus[startIndex - 1];
    const cursorOffset =
      selection.start.character -
      (selectedBunsetsus[0].bunsetsu[0].word_position - 1);

    swapChunks(
      editor,
      selection.start.line,
      previousChunk,
      { 
        bunsetsu: selectedBunsetsus.flatMap(b => b.bunsetsu), 
        length: selectedBunsetsus.reduce((sum, b) => sum + b.length, 0) 
      },
      cursorOffset,
      false,
    );
  }
}

// カレント文節を後ろに移動する関数
export async function moveWordForward() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const lineString = document.lineAt(editor.selection.active.line).text;
  const selection = editor.selection;

  if (!selection.isSingleLine || !lineString) return;

  const kuromoji = await tokenizer();
  const tokens = kuromoji.tokenize(lineString);
  const bunsetsus = chunkBunsetsu(tokens);

  const result = getSelectedBunsetsuRange(bunsetsus, selection);
  if (!result) return;

  const { selectedBunsetsus, endIndex } = result;

  if (endIndex < bunsetsus.length - 1) {
    const nextChunk = bunsetsus[endIndex + 1];
    const cursorOffset =
      selection.start.character -
      (selectedBunsetsus[0].bunsetsu[0].word_position - 1);

    swapChunks(
      editor,
      selection.start.line,
      {
        bunsetsu: selectedBunsetsus.flatMap(b => b.bunsetsu),
        length: selectedBunsetsus.reduce((sum, b) => sum + b.length, 0)
      },
      nextChunk,
      cursorOffset,
      true,
    );
  }
}

function getSelectedBunsetsuRange(
  bunsetsus: { bunsetsu: IpadicFeatures[]; length: number }[],
  selection: vscode.Selection,
): {
  selectedBunsetsus: { bunsetsu: IpadicFeatures[]; length: number }[];
  startIndex: number;
  endIndex: number;
} | null {
  let startIndex = -1;
  let endIndex = -1;
  const selectedBunsetsus: { bunsetsu: IpadicFeatures[]; length: number }[] = [];

  for (let i = 0; i < bunsetsus.length; i++) {
    const bunsetsuStart = bunsetsus[i].bunsetsu[0].word_position - 1;
    const bunsetsuEnd = bunsetsuStart + bunsetsus[i].length;

    if (
      selection.start.character < bunsetsuEnd &&
      selection.end.character > bunsetsuStart
    ) {
      // 境界が一致する場合を除外
      if (!(selection.start.character === bunsetsuEnd || selection.end.character === bunsetsuStart)) {
        if (startIndex === -1) {
          startIndex = i;
        }
        endIndex = i;
        selectedBunsetsus.push(bunsetsus[i]);
      }
    }
  }

  if (selectedBunsetsus.length > 0 && startIndex !== -1 && endIndex !== -1) {
    return {
      selectedBunsetsus,
      startIndex,
      endIndex,
    };
  }

  return null;
}

// 文節入れ替え
// swapChunks 関数
async function swapChunks(
  editor: vscode.TextEditor,
  line: number,
  firstChunk: { bunsetsu: IpadicFeatures[]; length: number },
  secondChunk: { bunsetsu: IpadicFeatures[]; length: number },
  cursorOffset: number,
  isForward: boolean,
) {
  const replaceRange = new vscode.Range(
    new vscode.Position(line, firstChunk.bunsetsu[0].word_position - 1),
    new vscode.Position(
      line,
      secondChunk.bunsetsu[0].word_position - 1 + secondChunk.length,
    ),
  );

  // トークンを入れ替えた後の新しい行のテキスト
  const firstSurface = firstChunk.bunsetsu
    .map((token) => token.surface_form)
    .join("");
  const secondSurface = secondChunk.bunsetsu
    .map((token) => token.surface_form)
    .join("");
  const newLineText = `${secondSurface}${firstSurface}`;

  await editor.edit((editBuilder) => {
    editBuilder.replace(replaceRange, newLineText);
  });

  // 選択範囲の有無をチェックして適切にカーソルを設定
  const hasSelection = !editor.selection.isEmpty;
  let newSelection: vscode.Selection;

  if (hasSelection) {
    const startOffset = isForward
    ? (secondChunk.bunsetsu[0].word_position - 1) - firstChunk.length + secondChunk.length
    : (firstChunk.bunsetsu[0].word_position - 1);
    const endOffset = isForward
    ? startOffset + firstChunk.length
    : startOffset + secondChunk.length;
    
    newSelection = new vscode.Selection(
      new vscode.Position(line, startOffset),
      new vscode.Position(line, endOffset)
    );
  } else {
    // トークン入れ替え後のカーソル位置を計算
    let newCursorPosition;
    if (isForward) {
      newCursorPosition = new vscode.Position(
        line,
        firstChunk.bunsetsu[0].word_position - 1 + secondChunk.length + cursorOffset,
      );
    } else {
      newCursorPosition = new vscode.Position(
        line,
        firstChunk.bunsetsu[0].word_position - 1 + cursorOffset,
      );
    }

    newSelection = new vscode.Selection(newCursorPosition, newCursorPosition);
  }

  editor.selection = newSelection;

  // デコレーション用のハイライトを更新
  const highlightRange = isForward
    ? new vscode.Range(
        new vscode.Position(line, firstChunk.bunsetsu[0].word_position - 1 + secondChunk.length),
        new vscode.Position(line, firstChunk.bunsetsu[0].word_position - 1 + secondChunk.length + firstChunk.length),
      )
    : new vscode.Range(
        new vscode.Position(line, firstChunk.bunsetsu[0].word_position - 1),
        new vscode.Position(line, firstChunk.bunsetsu[0].word_position - 1 + secondChunk.length),
      );

  highlightSwap(editor, highlightRange);
}

function highlightSwap(editor: vscode.TextEditor, range: vscode.Range) {
  const highlightDuration = 350; // ハイライト時間 (ミリ秒)
  const decorationType = vscode.window.createTextEditorDecorationType({
    // backgroundColor: "rgba(255, 223, 186, 0.2)", // ハイライト色 (半透明)
    borderColor: "rgba(68, 130, 140, 0.5)", // ハイライト色 (半透明)
    borderWidth: "1px", // ハイライトの境界線
    borderStyle: "solid", // ハイライトの境界線のスタイル
  });

  // 選択されたテキストにデコレーションを適用
  editor.setDecorations(decorationType, [range]);

  // タイマーをセットしてデコレーションを削除
  setTimeout(() => {
    decorationType.dispose();
  }, highlightDuration);
}
