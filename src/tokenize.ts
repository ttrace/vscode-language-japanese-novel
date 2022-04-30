import * as vscode from 'vscode';
import * as kuromoji from 'kuromoji';
import { text } from 'stream/consumers';
import { resolve } from 'path';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

export const legend = (function () {
	const tokenTypesLegend = [
		'proper_noun', 'noun', 'keyword', 'punctuation', 'adverb', 'interjection', 'adjective',
		'particle', 'auailiary_verb', 'verb', 'pronoun', 'enum', 'typeParameter', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
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

				//console.dir(kuromojiToken);
				let lineOffset = 0;
				let openOffset = 0;
				let closeOffset = 0;
				let j = 0;
				for await (let mytoken of kuromojiToken) {

					mytoken = kuromojiToken[j];
					if (mytoken.surface_form == '\n') {
						i++;
						lineOffset = mytoken.word_position;
						console.log('line-feed:' + i);
					}
					openOffset = mytoken.word_position - lineOffset - 1;

					let wordLength = 0;
					wordLength = mytoken.surface_form.length;
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
					if (kind == '記号') kind = 'punctuation';
					if (kind == '動詞') kind = 'verb';
					if (kind == '助動詞') kind = 'auailiary_verb';
					if (kind == '助詞') {
						kind = 'particle'
						tokenActivity = true;
					}
					if (kind == '副詞') kind = 'adverb';
					if (kind == '感動詞') kind = 'interjection';
					if (kind == '形容詞') kind = 'adjective';

					closeOffset = openOffset + wordLength;
					const tokenData = parseTextToken(document.getText().substring(openOffset, closeOffset));
					const tokenModifierNum = encodeTokenModifiers(tokenData.tokenModifiers);

					if (tokenActivity == true) {
						builder.push(i, openOffset, wordLength, encodeTokenType(kind), tokenModifierNum);
						console.log(i + ':' + j + '/' + openOffset + ':' + mytoken.surface_form);
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


	morphemeBuilderAll(text: string) {
		const r: IParsedToken[] = [];
		//const lines = text?.split(/\r\n|\r|\n/);
		const builder = new vscode.SemanticTokensBuilder();
		kuromojiBuilder.build((err: any, tokenizer: any) => {
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
			const kuromojiToken = tokenizer.tokenize(text);

			//console.dir(kuromojiToken);
			let lineOffset = 0;
			let openOffset = 0;
			let closeOffset = 0;

			for (let j = 0; j < kuromojiToken.length; j++) {

				const mytoken = kuromojiToken[j];
				if (mytoken.surface_form == '\n') {
					i++;
					lineOffset = mytoken.word_position;
					console.log('line-feed:' + i);
				}
				openOffset = mytoken.word_position - lineOffset - 1;

				const wordLength = mytoken.surface_form.length;
				let tokenActivity = false;
				let kind = mytoken.pos;

				if (kind == '名詞') kind = 'noun';
				if (mytoken.pos == '名詞' && mytoken.pos_detail_1 == '固有名詞') {
					kind = 'proper_noun';
					tokenActivity = true;
				}
				if (mytoken.pos == '名詞' && mytoken.pos_detail_1 == '代名詞') {
					kind = 'pronoun';
					tokenActivity = true;
				}
				if (kind == '記号') kind = 'punctuation';
				if (kind == '動詞') kind = 'verb';
				if (kind == '助動詞') kind = 'auailiary_verb';
				if (kind == '助詞') {
					kind = 'particle'
					tokenActivity = true;
				}
				if (kind == '副詞') kind = 'adverb';
				if (kind == '感動詞') kind = 'interjection';
				if (kind == '形容詞') kind = 'adjective';

				closeOffset = openOffset + wordLength;
				const tokenData = this._parseTextToken(text.substring(openOffset, closeOffset));
				const tokenModifierNum = encodeTokenModifiers(tokenData.tokenModifiers);

				if (tokenActivity == true) {
					r.push({
						line: i,
						startCharacter: openOffset,
						length: wordLength,
						tokenType: kind,
						tokenModifiers: tokenData.tokenModifiers
					});

					//console.log(i + ':' + j + '/' + openOffset + ':' + mytoken.surface_form);
				}
				openOffset = closeOffset;

				if (j >= kuromojiToken.length - 1) {
					chachedToken = [];
					r.forEach((token) => {
						chachedToken.push(token);
						const tokenModifierNum = encodeTokenModifiers(tokenData.tokenModifiers);
						builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), tokenModifierNum);
						tokenCaching = false;
					});
				}

			}
			builder.build();
			console.log('builder making');

		});
		console.log('cache changed!');
	}

	morphemeBuilder(text: string, lineNumber: number) {
		const r: IParsedToken[] = [];
		kuromojiBuilder.build((err: any, tokenizer: any) => {
			lineTokenCaching = true;
			if (err) {
				console.dir('Kuromoji initialize error:' + err.message);
				throw err;
			}
			const kuromojiToken = tokenizer.tokenize(text);

			let openOffset = 0;
			let closeOffset = 0;

			for (let j = 0; j < kuromojiToken.length; j++) {

				const mytoken = kuromojiToken[j];
				openOffset = mytoken.word_position - 1;

				const wordLength = mytoken.surface_form.length;
				let tokenActivity = false;
				let kind = mytoken.pos;
				if (kind == '名詞') kind = 'noun';
				if (mytoken.pos == '名詞' && mytoken.pos_detail_1 == '固有名詞') {
					kind = 'proper_noun';
					tokenActivity = true;
				}
				if (mytoken.pos == '名詞' && mytoken.pos_detail_1 == '代名詞') {
					kind = 'pronoun';
					tokenActivity = true;
				}
				if (kind == '記号') kind = 'punctuation';
				if (kind == '動詞') kind = 'verb';
				if (kind == '助動詞') kind = 'auailiary_verb';
				if (kind == '助詞') {
					kind = 'particle'
					tokenActivity = true;
				}
				if (kind == '副詞') kind = 'adverb';
				if (kind == '感動詞') kind = 'interjection';
				if (kind == '形容詞') kind = 'adjective';

				closeOffset = openOffset + wordLength;
				const tokenData = parseTextToken(text.substring(openOffset, closeOffset));
				const tokenModifierNum = encodeTokenModifiers(tokenData.tokenModifiers);


				//console.log('pushing toke to Builder' + j + '/' + kuromojiToken.length);

				if (tokenActivity == true) {
					r.push({
						line: lineNumber,
						startCharacter: openOffset,
						length: wordLength,
						tokenType: kind,
						tokenModifiers: tokenData.tokenModifiers
					});
				}
				//console.log(lineNumber + '/' + text.length + ':' + j + '/' + j);
				if (j == kuromojiToken.length - 1) {

					chachedToken = chachedToken.filter((lineNum) => {
						return (lineNum.line != lineNumber);
					})
					r.forEach((token) => {
						chachedToken.push(token);
					});

					console.log('cache changed!');
					lineTokenCaching = false;

					//const builder = new vscode.SemanticTokensBuilder();

					//builder.build();

				}
				openOffset = closeOffset;
			}
		});

	}

	private _parseText(text: string) {

		const lineText = vscode.window.activeTextEditor?.document.lineAt(vscode.window.activeTextEditor?.selection.active.line);
		if (lineText != undefined && typeof lineText.text == "string" && typeof lineText?.lineNumber == "number" && lineTokenCaching == false) {
			console.log(lineText);
			this.morphemeBuilder(lineText.text, lineText.lineNumber);

		}

		if (tokenCaching == false) {
			this.morphemeBuilderAll(text);
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