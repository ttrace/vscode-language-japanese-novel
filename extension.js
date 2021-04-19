const vscode = require('vscode');

function verticalpreview(){
    vscode.window.showInformationMessage('Hello, world!');
}

function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('Novel.vertical-preview', verticalpreview));
}

function deactivate() {
    return undefined;
}

module.exports = { activate, deactivate };