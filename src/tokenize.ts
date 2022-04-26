import * as vscode from 'vscode';
import * as kuromoji from 'kuromoji';
import { text } from 'stream/consumers';
import { resolve } from 'path';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

export const legend = (function () {
	const tokenTypesLegend = [
		'proper_noun', 'noun', 'keyword', 'punctuation', 'adverb', 'interjection', 'adjective',
		'particle', 'auailiary_verb', 'verb', 'interface', 'enum', 'typeParameter', 'function',
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


let kuromojiDictPath = '';
let kuromojiBuilder: any;

export function activateTokenizer(context: vscode.ExtensionContext, kuromojiPath: string) {

	kuromojiDictPath = kuromojiPath;
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
		const allTokens = this._parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			//console.log("Token:" + allTokens);
			builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		});
		return builder.build();
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

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);

		//const kuromojiTaskList: any = [];
		kuromojiBuilder.build(async (err: any, tokenizer: any) => {
		// 辞書がなかったりするとここでエラーになります(´・ω・｀)
		if (err) {
			console.dir('Kuromoji initialize error:' + err.message);
			throw err;
		}
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				// tokenizer.tokenize に文字列を渡すと、その文を形態素解析してくれます。
				const kuromojiToken = tokenizer.tokenize(line);
				console.dir(kuromojiToken);

				let openOffset = 0;
				let closeOffset = 0;

				for (let j = 0; j < kuromojiToken.length; j++) {

					const mytoken = kuromojiToken[j];
					openOffset = mytoken.word_position - 1;

					const wordLength = mytoken.surface_form.length;
					let kind = mytoken.pos;
					if (kind == '名詞') kind = 'noun';
					if (mytoken.pos == '名詞' && mytoken.pos_detail_1 == '固有名詞') {
						kind = 'proper_noun';
					}
					if (kind == '記号') kind = 'punctuation';
					if (kind == '動詞') kind = 'verb';
					if (kind == '助動詞') kind = 'auailiary_verb';
					if (kind == '助詞') kind = 'particle';
					if (kind == '副詞') kind = 'adverb';
					if (kind == '感動詞') kind = 'interjection';
					if (kind == '形容詞') kind = 'adjective';

					const text = mytoken.surface_form;

					closeOffset = openOffset + wordLength;
					const tokenData = this._parseTextToken(line.substring(openOffset, closeOffset));

					r.push({
						line: i,
						startCharacter: openOffset,
						length: wordLength,
						tokenType: kind,
						tokenModifiers: tokenData.tokenModifiers
					});
					console.log(i + '/' + lines.length + ':' + j + '/' + j);
					if (j == kuromojiToken.length - 1) {

						chachedToken = chachedToken.filter((lineNum) => {
							return (lineNum.line != i);
						})
						r.forEach((token) => {
							chachedToken.push(token);
						});
						console.log('cache cleared!');
					}
					openOffset = closeOffset;
				}
			}
			//console.dir(r);
		});
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
