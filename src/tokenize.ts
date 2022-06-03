import * as vscode from 'vscode';
import * as kuromoji from 'kuromoji';


const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();
let tokenizeFlag = false;

export const legend = (function () {
	const tokenTypesLegend = [
		'proper_noun', 'noun', 'keyword', 'punctuation', 'bracket', 'adverb', 'interjection', 'adjective',
		'particle', 'auailiary_verb', 'verb', 'pronoun', 'personal_pronoun', 'enum', 'suffix', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'dialogue', 'quote', 'aozora'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();


//let kuromojiDictPath = '';
let kuromojiBuilder: any;
let tokenCaching = false;

export function activateTokenizer(context: vscode.ExtensionContext, kuromojiPath: string) {

	//kuromojiDictPath = kuromojiPath;
	kuromojiBuilder = kuromoji.builder({
		dicPath: kuromojiPath
	});

	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'novel' }, new DocumentSemanticTokensProvider(), legend));

	context.subscriptions.push(vscode.languages.registerDocumentRangeSemanticTokensProvider({ language: 'novel' }, new DocumentRangeSemanticTokensProvider(), legend));
	tokenizeFlag = true;
}

export function desableTokenizer(){
	tokenizeFlag = false;
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}let chachedToken: IParsedToken[] = [];

export class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {

	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		//const allTokens = this._parseText(document.getText());
		return new Promise((resolve, reject) => {
			const r: number[][] = [];
			const builder = new vscode.SemanticTokensBuilder();

			kuromojiBuilder.build(async (err: any, tokenizer: any) => {
				tokenCaching = true;
				// 辞書がなかったりするとここでエラーになります(´・ω・｀)
				if (err) {
					console.dir('Kuromoji initialize error:' + err.message);
					throw err;
				}
				//		for (let i = 0; i < lines.length; i++) {
				let i = 0;
				//const line = lines[i];

				// tokenizer.tokenize に文字列を渡すと、その文を形態素解析してくれます。
				const kuromojiToken = tokenizer.tokenize(document.getText());

				console.dir(kuromojiToken);
				let lineOffset = 0;
				let openOffset = 0;
				let closeOffset = 0;
				let j = 0;

				let isDialogue = false;
				let isQuote = false;
				let isMarkedProperNoun = false;
				let isRuby = false;
				for await (let mytoken of kuromojiToken) {
					let nextToken = [];
					mytoken = kuromojiToken[j];
					if (j <= kuromojiToken.length - 1) {
						nextToken = kuromojiToken[j + 1];
					}

					let wordLength = 0;
					wordLength = mytoken.surface_form.length;

					//改行処理
					if (mytoken.surface_form.match(/\n/)) {
						i += mytoken.surface_form.match(/\n/g).length;
						//複数の改行が重なるとKuromojiは'\n\n'のように返す。
						lineOffset = mytoken.word_position + mytoken.surface_form.length - 1;
						openOffset = 0;
						wordLength = 0;
						isRuby = false;
						isQuote = false;
						//	console.log('line-feed:' + i + ": " + lineOffset);
					} else {
						openOffset = mytoken.word_position - lineOffset - 1;
					}

					let tokenActivity = false;
					let kind = mytoken.pos;
					//console.log(mytoken.surface_form);
					if (kind == '名詞') kind = 'noun';
					if (mytoken.pos == '名詞' && mytoken.pos_detail_1 == '固有名詞') {
						kind = 'proper_noun';
						tokenActivity = true;
					}
					if (mytoken.pos == '名詞' && mytoken.pos_detail_1 == '代名詞') {
						kind = 'pronoun';
						tokenActivity = true;
					}
					if (mytoken.surface_form.match(/^(私|わたし|わたくし|我|われ|あたし|僕|ぼく|俺|おれ|貴方|あなた|あんた|お前|おまえ|君|きみ|てめえ|彼|かれ|彼女|彼女|あいつ|そいつ|こいつ|奴|やつ)$/) && mytoken.pos_detail_1 == '代名詞') {
						kind = 'personal_pronoun';
						tokenActivity = true;
					}
					if (kind == '記号') kind = 'punctuation'; tokenActivity = true;

					if (mytoken.pos_detail_1.match(/括弧./) || mytoken.surface_form.match(/(》|［＃「)/)) {
						kind = 'bracket'; tokenActivity = true;
					}

					if (kind == '動詞') kind = 'verb'; tokenActivity = true;
					if (mytoken.pos_detail_1 == '数') kind = 'enum'; tokenActivity = true;
					if (kind == 'noun' && mytoken.pos_detail_1 == '接尾') kind = 'suffix'; tokenActivity = true;

					if (kind == '助動詞') kind = 'auailiary_verb'; tokenActivity = true;
					if (kind == '助詞') {
						kind = 'particle'
						tokenActivity = true;
					}
					if (kind == '副詞') kind = 'adverb'; tokenActivity = true;
					if (kind == '感動詞') kind = 'interjection'; tokenActivity = true;
					if (kind == '形容詞') kind = 'adjective'; tokenActivity = true;

					if (kind == 'noun' && mytoken.pos_detail_1 == 'サ変接続' && nextToken.conjugated_type.match(/^サ変/)) {
						kind = 'verb';
					}

					let tokenModifireType = '';

					//会話モディファイア
					if (mytoken.surface_form == '「') {
						isDialogue = true;
					}
					if (isDialogue == true) {
						tokenModifireType = 'dialogue';
					}
					if (mytoken.surface_form == '」') isDialogue = false;

					//引用モディファイア
					if (mytoken.surface_form == '『') isQuote = true;
					if (isQuote == true) {
						tokenModifireType = 'quote';
					}
					if (mytoken.surface_form == '』') isQuote = false;

					//固有名詞モディファイア
					if (mytoken.surface_form == '〈') isMarkedProperNoun = true;
					if (isMarkedProperNoun == true) {
						kind = 'proper_noun';
					}
					if (mytoken.surface_form == '〉') isMarkedProperNoun = false;

					//ルビモディファイア
					if (mytoken.surface_form == '《') isRuby = true;
					if (isRuby == true) {
						tokenModifireType = 'aozora';
					}
					if (mytoken.surface_form == '》') {
						isRuby = false;
						kind = 'bracket';
					}

					//青空注記モディファイア
					if (mytoken.surface_form == '［' || mytoken.surface_form == '［＃「') isRuby = true;
					if (isRuby == true) {
						tokenModifireType = 'aozora';
					}
					if (mytoken.surface_form == '］') {
						isRuby = false;
						kind = 'bracket';
					}

					closeOffset = openOffset + wordLength;
					const tokenData = parseTextToken(document.getText().substring(openOffset, closeOffset));
					const tokenModifierNum = encodeTokenModifiers([tokenModifireType]);

					if (tokenActivity == true) {
						builder.push(i, openOffset, wordLength, encodeTokenType(kind), tokenModifierNum);
						//	console.log(i + ':' + j + '/' + openOffset + ':' + mytoken.surface_form);
					}
					openOffset = closeOffset;
					if (j == kuromojiToken.length - 1) {
						resolve(builder.build());
						//const builder = new vscode.SemanticTokensBuilder();
						//return builder.build();
					}
					j++;
				}
			});
		});
	}

	async provideDocumentSemanticTokensEdits(document: vscode.TextDocument, previousResultId: string, token: vscode.CancellationToken): Promise<vscode.SemanticTokens | vscode.SemanticTokensEdits> {
		//return new Promise((resolve, reject) => {
		console.log('edit');
		console.dir("previousResultId" + previousResultId);
		const resultTokensId = {
			start: 0,
			deleteCount: 1,
			data: [3]
		};
		return new vscode.SemanticTokensEdits([], '0');
		//});
	}


	private _encodeTokenType(tokenType: string): number {
		if (tokenTypes.has(tokenType)) {
			return tokenTypes.get(tokenType)!;
		} else if (tokenType === 'notInLegend') {
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
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}




	private _parseText(text: string) {
		const lineText = vscode.window.activeTextEditor?.document.lineAt(vscode.window.activeTextEditor?.selection.active.line);
		if (lineText != undefined && typeof lineText.text == "string" && typeof lineText?.lineNumber == "number" && lineTokenCaching == false) {
			console.log(lineText);
			morphemeBuilder(lineText.text);

		}

		console.log('parse_text');
		return chachedToken;
	}

	private _parseTextToken(text: string): { tokenType: string; tokenModifiers: string[]; } {
		const parts = text.split('.');
		return {
			tokenType: parts[0],
			tokenModifiers: parts.slice(1)
		};
	}
}

export class DocumentRangeSemanticTokensProvider implements vscode.DocumentRangeSemanticTokensProvider {
	provideDocumentRangeSemanticTokens(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SemanticTokens> {
		throw new Error('Method not implemented.');
	}
	
}

function parseTextToken(text: string): { tokenType: string; tokenModifiers: string[]; } {
	const parts = text.split('.');
	return {
		tokenType: parts[0],
		tokenModifiers: parts.slice(1)
	};
}

function encodeTokenModifiers(strTokenModifiers: string[]): number {
	let result = 0;
	for (let i = 0; i < strTokenModifiers.length; i++) {
		const tokenModifier = strTokenModifiers[i];
		if (tokenModifiers.has(tokenModifier)) {
			result = result | (1 << tokenModifiers.get(tokenModifier)!);
		} else if (tokenModifier === 'notInLegend') {
			result = result | (1 << tokenModifiers.size + 2);
		}
	}
	return result;
}

function encodeTokenType(tokenType: string): number {
	if (tokenTypes.has(tokenType)) {
		return tokenTypes.get(tokenType)!;
	} else if (tokenType === 'notInLegend') {
		return tokenTypes.size + 2;
	}
	return 0;
}


let lineTokenCaching = false;


export function clearChachedToken() {
	chachedToken = [];

}

export function morphemeBuilder(text: string) {
	//return new Promise((resolve, reject) => {
	kuromojiBuilder.build(async (err: any, tokenizer: any) => {
		lineTokenCaching = true;
		if (err) {
			console.dir('Kuromoji initialize error:' + err.message);
			throw err;
		}
		const kuromojiToken = tokenizer.tokenize(text);
		let regexString = '';
		let i = 0;
		for await (let mytoken of kuromojiToken) {
			mytoken = kuromojiToken[i];
			regexString += '(' + mytoken.surface_form + ')|';
			i++
		}
		const wordPatternRegex = new RegExp(regexString);
		console.log('Regex' + wordPatternRegex);
		return regexString;
	});
	//});
}