import fs = require("fs");
import * as vscode from 'vscode';
import * as kuromoji from 'kuromoji';
import path = require('path');
import { TextDecoder, TextEncoder } from "util";

let builder: any;


const log = fs.openSync("/Users/taiyofujii/Desktop/log.txt", "w"); // ファイル名は適宜変えてください

export function kuromojiBuilder(context: vscode.ExtensionContext) {
  builder = kuromoji.builder({
    dicPath: path.join(context.extensionPath, 'node_modules', 'kuromoji', 'dict')
  });
}


if (process.argv.length !== 3) {
  console.log(`usage: ${process.argv[1]} [--language-server|FILE]`);
} else if (process.argv[2] == "--language-server") {
  languageServer();
} else {
  // TODO: interpret(process.argv[2]);
}

function sendMessage(msg: unknown) {
  const s = new TextEncoder().encode(JSON.stringify(msg));
  process.stdout.write(`Content-Length: ${s.length}\r\n\r\n`);
  process.stdout.write(s);
}

function logMessage(message: unknown) {
  sendMessage({ jsonrpc: "2.0", method: "window/logMessage", params: { type: 3, message } });
}

function sendErrorResponse(id: any, code: any, message: any) {
  sendMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function languageServer() {
  let buffer = Buffer.from(new Uint8Array(0));
  process.stdin.on("readable", () => {
    let chunk;
    // eslint-disable-next-line no-cond-assign
    while (chunk = process.stdin.read()) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    const bufferString = buffer.toString();
    if (!bufferString.includes("\r\n\r\n")) return;

    const headerString = bufferString.split("\r\n\r\n", 1)[0];

    let contentLength = -1;
    const headerLength = headerString.length + 4;
    for (const line of headerString.split("\r\n")) {
      const [key, value] = line.split(": ");
      if (key === "Content-Length") {
        contentLength = parseInt(value, 10);
      }
    }

    if (contentLength === -1) return;
    if (buffer.length < headerLength + contentLength) return;

    try {
      const msg = JSON.parse(bufferString.slice(headerLength, headerLength + contentLength));
      dispatch(msg); // 後述
    } catch (e) {
      if (e instanceof SyntaxError) {
        sendParseErrorResponse();
        return;
      } else {
        throw e;
      }
    } finally {
      buffer = buffer.slice(headerLength + contentLength);
    }
  });
}

function sendInvalidRequestResponse() {
  sendErrorResponse(null, -32600, "received an invalid request");
}

function sendMethodNotFoundResponse(id: any, method: any) {
  sendErrorResponse(id, -32601, method + " is not supported");
}

const requestTable: { [key: string]: any } = {};
const notificationTable: { [key: string]: any } = {};

requestTable["initialize"] = (msg: any) => {
  logMessage("initialize");
  const capabilities = {
    textDocumentSync: 1, // 1 は「毎回ファイルの中身を全部送る」の意。差分だけを送るモードもある。
  };
  sendMessage({ jsonrpc: "2.0", id: msg.id, result: { capabilities } });
}

notificationTable["initialized"] = (msg: any) => {
  logMessage("initialized!");
}

function dispatch(msg: any) {
  if ("id" in msg && "method" in msg) { // request
    if (msg.method in requestTable) {
      requestTable[msg.method](msg);
    } else {
      sendMethodNotFoundResponse(msg.id, msg.method)
    }
  } else if ("id" in msg) { // response
    // Ignore.
    // This language server doesn't send any request.
    // If this language server receives a response, that is invalid.
  } else if ("method" in msg) { // notification
    if (msg.method in notificationTable) {
      notificationTable[msg.method](msg);
    }
  } else { // error
    sendInvalidRequestResponse();
  }
}

if (process.argv.length !== 3) {
  console.log(`usage: ${process.argv[1]} [--language-server|FILE]`);
} else if (process.argv[2] == "--language-server") {
  languageServer();
} else {
  // TODO: interpret(process.argv[2]);
}

function sendParseErrorResponse() {
  throw new Error("Function not implemented.");
}

function compile(uri: vscode.Uri, src: string) {
  logMessage(uri + ":" + src);
  // TODO: implement
}

notificationTable["textDocument/didOpen"] = (msg:any) => {
  const uri = msg.params.textDocument.uri;
  const text = msg.params.textDocument.text;
  compile(uri, text);
}

notificationTable["textDocument/didChange"] = (msg:any) => {
  if (msg.params.contentChanges.length !== 0) {
      const uri = msg.params.textDocument.uri;
      const text = msg.params.contentChanges[msg.params.contentChanges.length - 1].text;
      compile(uri, text);
  }
}

/* 
const buffers = {};
const diagnostics = [];

  //字句解析
  //https://zenn.dev/takl/books/0fe11c6e177223/viewer/a505c9

const requestTable = {};
const notificationTable = {};
let publishDiagnosticsCapable = false;

const buffers = {};
const diagnostics = [];


function compile(uri: string | number, src: any) {
  diagnostics.length = 0;
  const tokens = tokenize(uri, src);
  buffers[uri] = { tokens };
}

notificationTable["textDocument/didOpen"] = (msg) => {
  const uri = msg.params.textDocument.uri;
  const text = msg.params.textDocument.text;
  compile(uri, text);
  sendPublishDiagnostics(uri, diagnostics);
}

notificationTable["textDocument/didChange"] = (msg) => {
  if (msg.params.contentChanges.length !== 0) {
      const uri = msg.params.textDocument.uri;
      const text = msg.params.contentChanges[msg.params.contentChanges.length - 1].text;
      compile(uri, text);
      sendPublishDiagnostics(uri, diagnostics);
  }
}

function tokenize(uri, src){
  let tokens = [];
  const lines = src.split(/\r\n|\r|\n/);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    let kuromojiToken: string | any[] = [];

    builder.build((err, tokenizer) => {
      // 辞書がなかったりするとここでエラーになります(´・ω・｀)
      if(err) { 
        console.dir('KUROMOJI ERR'+err.message);
        throw err; }
      // tokenizer.tokenize に文字列を渡すと、その文を形態素解析してくれます。

      kuromojiToken = tokenizer.tokenize(line);
      let character = 0;
      for ( let j = 0; j < kuromojiToken.length; j++){
        const mytoken = kuromojiToken[j];
        character = mytoken.word_position - 1;
        const characterLength = mytoken.surface_form.length;
        const start = { line, character };
        const kind = mytoken.pos;
        const text = mytoken.surface_form;
        //if (token.pos == '名詞') legend = '5'; 
      	
        character = character + characterLength;
        const end = { line, character };
        const location = { uri, range: { start, end } };
        tokens.push({ kind, text, location});
      	
      }
    });
  }
}

*/