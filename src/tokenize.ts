import * as vscode from 'vscode';
import * as kuromoji from 'kuromoji';
import path = require('path');

let builder: any;

export function kuromojiBuilder(context: vscode.ExtensionContext) {
	builder = kuromoji.builder({
		dicPath: path.join(context.extensionPath, 'node_modules', 'kuromoji', 'dict')
	});	
}

