import * as vscode from 'vscode';
import { Position, Range } from 'vscode';
import * as kuromoji from 'kuromoji';
import { prependListener } from 'process';

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
		'dialogue', 'quote', 'aozora','comment'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();


//let kuromojiDictPath = '';
let kuromojiBuilder: any;
let tokenCaching = false;
export let kuromojiDictPath = '';

export function activateTokenizer(context: vscode.ExtensionContext, kuromojiPath: string) {

	kuromojiDictPath = kuromojiPath;
	kuromojiBuilder = kuromoji.builder({
		dicPath: kuromojiPath
	});

	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'novel' }, new DocumentSemanticTokensProvider(), legend));

	context.subscriptions.push(vscode.languages.registerDocumentRangeSemanticTokensProvider({ language: 'novel' }, new DocumentRangeSemanticTokensProvider(), legend));
	tokenizeFlag = true;
}

export function desableTokenizer() {
	tokenizeFlag = false;
	vscode.languages.registerDocumentSemanticTokensProvider({ language: 'novel' }, new DocumentSemanticTokensProvider(), legend);
}

export function enableTokenizer() {
	tokenizeFlag = true;
	vscode.languages.registerDocumentSemanticTokensProvider({ language: 'novel' }, new DocumentSemanticTokensProvider(), legend);
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
			if (tokenizeFlag === true) {
				const r: number[][] = [];
				const builder = new vscode.SemanticTokensBuilder();

				kuromojiBuilder.build(async (err: any, tokenizer: any) => {
					tokenCaching = true;
					// ??????????????????????????????????????????????????????????????????(?????????????)
					if (err) {
						console.dir('Kuromoji initialize error:' + err.message);
						throw err;
					}
					//		for (let i = 0; i < lines.length; i++) {
					let i = 0;
					//const line = lines[i];

					// tokenizer.tokenize ???????????????????????????????????????????????????????????????????????????
					const kuromojiToken = tokenizer.tokenize(document.getText());

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
					for await (let mytoken of kuromojiToken) {
						let nextToken = [];
						mytoken = kuromojiToken[j];
						if (j <= kuromojiToken.length - 1) {
							nextToken = kuromojiToken[j + 1];
						}

						let wordLength = 0;
						wordLength = mytoken.surface_form.length;

						//????????????
						if (mytoken.surface_form.match(/\n/)) {
							i += mytoken.surface_form.match(/\n/g).length;
							//??????????????????????????????Kuromoji???'\n\n'?????????????????????
							lineOffset = mytoken.word_position + mytoken.surface_form.length - 1;
							openOffset = 0;
							wordLength = 0;
							isRuby = false;
							isQuote = false;
							isComment = false;
							//	console.log('line-feed:' + i + ": " + lineOffset);
						} else {
							openOffset = mytoken.word_position - lineOffset - 1;
						}

						let tokenActivity = false;
						let kind = mytoken.pos;
						//console.log(mytoken.surface_form);
						if (kind == '??????') kind = 'noun';
						if (mytoken.pos == '??????' && mytoken.pos_detail_1 == '????????????') {
							kind = 'proper_noun';
							tokenActivity = true;
						}
						if (mytoken.pos == '??????' && mytoken.pos_detail_1 == '?????????') {
							kind = 'pronoun';
							tokenActivity = true;
						}
						if (mytoken.surface_form.match(/^(???|?????????|????????????|???|??????|?????????|???|??????|???|??????|??????|?????????|?????????|??????|?????????|???|??????|?????????|???|??????|??????|??????|?????????|?????????|?????????|???|??????)$/) && mytoken.pos_detail_1 == '?????????') {
							kind = 'personal_pronoun';
							tokenActivity = true;
						}
						if (kind == '??????') kind = 'punctuation'; tokenActivity = true;

						if (mytoken.pos_detail_1.match(/??????./) || mytoken.surface_form.match(/(???|?????????)/)) {
							kind = 'bracket'; tokenActivity = true;
						}

						if (kind == '??????') kind = 'verb'; tokenActivity = true;
						if (mytoken.pos_detail_1 == '???') kind = 'enum'; tokenActivity = true;
						if (kind == 'noun' && mytoken.pos_detail_1 == '??????') kind = 'suffix'; tokenActivity = true;

						if (kind == '?????????') kind = 'auailiary_verb'; tokenActivity = true;
						if (kind == '??????') {
							kind = 'particle'
							tokenActivity = true;
						}
						if (kind == '??????') kind = 'adverb'; tokenActivity = true;
						if (kind == '?????????') kind = 'interjection'; tokenActivity = true;
						if (kind == '?????????') kind = 'adjective'; tokenActivity = true;

						if (kind == 'noun' && mytoken.pos_detail_1 == '????????????' && nextToken.conjugated_type.match(/^??????/)) {
							kind = 'verb';
						}

						let tokenModifireType = '';

						//???????????????????????????
						if (mytoken.surface_form == '???') {
							isDialogue = true;
						}
						if (isDialogue == true) {
							tokenModifireType = 'dialogue';
						}
						if (mytoken.surface_form == '???' || mytoken.surface_form.match(/???$/)) {
							isDialogue = false;
							kind = 'bracket';
						}

						//???????????????????????????
						if (mytoken.surface_form == '???') isQuote = true;
						if (isQuote == true) {
							tokenModifireType = 'quote';
						}
						if (mytoken.surface_form == '???') isQuote = false;

						//?????????????????????????????????
						if (mytoken.surface_form == '???') isMarkedProperNoun = true;
						if (isMarkedProperNoun == true) {
							kind = 'proper_noun';
						}
						if (mytoken.surface_form == '???') isMarkedProperNoun = false;

						//???????????????????????????
						if (mytoken.surface_form == '???') isRuby = true;
						if (isRuby == true) {
							tokenModifireType = 'aozora';
						}
						if (mytoken.surface_form == '???') {
							isRuby = false;
							kind = 'bracket';
						}

						//?????????????????????????????????
						if (mytoken.surface_form == '???' || mytoken.surface_form == '?????????') isRuby = true;
						if (isRuby == true) {
							tokenModifireType = 'aozora';
						}
						if (mytoken.surface_form == '???') {
							isRuby = false;
							kind = 'bracket';
						}

						//?????????????????????
						if (mytoken.surface_form === '<!--') {
							isComment = true;
							kind = 'bracket';
						}
						if (isComment === true) {
							tokenModifireType = 'comment';
						}
						if (mytoken.surface_form === '-->') {
							isComment = false;
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
			} else {
				const builder = new vscode.SemanticTokensBuilder();
				builder.push(0, 0, 0, 0, 0);
				resolve(builder.build());
			}
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
}

// ?????????????????????
export function changeTenseAspect() {
	const editor = vscode.window.activeTextEditor;
	const document = vscode.window.activeTextEditor?.document;
	const lineString = document?.lineAt(editor!.selection.active.line).text;
	const cursorPosition = editor!.selection.start;

	kuromojiBuilder.build(async (err: any, tokenizer: any) => {
		// ??????????????????????????????????????????????????????????????????(?????????????)
		if (err) {
			console.dir('Kuromoji initialize error:' + err.message);
			throw err;
		}
		const kuromojiToken = tokenizer.tokenize(lineString);
		console.log(lineString, cursorPosition, kuromojiToken);
		const punctuationList = kuromojiToken.filter((t: { surface_form: string; }) => t.surface_form === '???');
		let targetSentence = 0;
		let processingSentence = 0;
		for (let sentenceIndex = 0; sentenceIndex < punctuationList.length; sentenceIndex++) {
			const punctuation = punctuationList[sentenceIndex];
			if (cursorPosition.character < punctuation.word_position) {
				targetSentence = sentenceIndex;
				break;
			}
		}
		console.log('????????????:', targetSentence);

		for (let i = 0; i < kuromojiToken.length; i++) {
			const token = kuromojiToken[i];
			const nextToken = kuromojiToken[i + 1];
			const secondNextToken = kuromojiToken[i + 2];
			if (token.surface_form === '???') {
				processingSentence++;
				if (processingSentence > punctuationList.length - 1) processingSentence = punctuationList.length - 1;
			}

			// ??????????????????????????????
			if (processingSentence === targetSentence) {
				// ???????????????????????????
				if (token.conjugated_form === '?????????'
					&& token.conjugated_type.match(/.+??????$/)
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)[???]/, '$1??????');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.conjugated_form === '?????????'
					&& token.conjugated_type.match(/.+??????$/)
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)[???]/, '$1??????');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.conjugated_form === '?????????'
					&& token.conjugated_type.match(/.+[??????]???$/)
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)[??????]/, '$1??????');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.conjugated_form === '?????????'
					&& token.conjugated_type.match(/.+[?????????]???$/)
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)[?????????]/, '$1??????');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.conjugated_form === '?????????'
					&& token.basic_form.match(/??????|??????|??????/) //???????????????
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)???/, '$1??????');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.conjugated_form === '?????????'
					&& token.conjugated_type === '???????????????' //???????????????, ??????
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					let attributedVerbeForm = '';
					if (token.surface_form === '??????') {
						attributedVerbeForm = '??????';
					} else {
						attributedVerbeForm = token.surface_form.replace(/(.+)???/, '$1???')
					}
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.conjugated_form === '?????????'
					&& token.conjugated_type.match(/.+?????????$/)
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)[?????????]/, '$1??????');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.conjugated_form === '?????????'
					&& token.conjugated_type.match(/.+?????????$/)
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)[???]/, '$1??????');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.pos === '??????'
					&& token.surface_form.match(/.+???$/)
					&& nextToken.pos_detail_1 === '??????'
					&& nextToken.surface_form === '???') {
					const attributedVerbeForm = token.surface_form.replace(/(.+)???/g, '$1???');
					// range???????????????????????????????????????????????????
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, token.word_position + token.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					changeText(verbRange, attributedVerbeForm);
				} else if (token.pos === '??????'
					&& nextToken.conjugated_type === '????????????'
					&& secondNextToken.pos_detail_1 === '??????') {
					const attributedVerbeForm = token.basic_form;
					const verbPositionStart = new Position(cursorPosition.line, token.word_position - 1);
					const verbPositionEnd = new Position(cursorPosition.line, nextToken.word_position + nextToken.surface_form.length - 1);
					const verbRange = new Range(verbPositionStart, verbPositionEnd);
					//console.log(cursorPosition.character, processingSentence, attributedVerbeForm);
					changeText(verbRange, attributedVerbeForm);
				}
			}
		}
	});
}

//???????????????
function changeText(range: vscode.Range, text: string) {
	const editor = vscode.window.activeTextEditor;
	editor?.edit(TextEditorEdit => {
		TextEditorEdit.replace(range, text);
	});
}