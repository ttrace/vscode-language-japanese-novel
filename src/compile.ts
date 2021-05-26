import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const projectName = vscode.workspace.workspaceFolders![0].name;

export default function compileDocs(): void
{
    console.log(projectName);
}
