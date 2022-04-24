import fs = require("fs");
import * as vscode from 'vscode';
import * as kuromoji from 'kuromoji';
import path = require('path');
import { TextDecoder, TextEncoder } from "util";
import { TextDocumentRegistrationOptions } from "vscode-languageclient";

const buffers: { [key: string]: any } = {};
const diagnostics: any = [];


let dictionaryPath = path.dirname(process.argv[1]);
dictionaryPath = path.resolve(dictionaryPath, '..', '..', 'node_modules', 'kuromoji', 'dict')

const builder = kuromoji.builder({
  dicPath: dictionaryPath
});


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
      const msg = JSON.parse(buffer.toString().slice(headerLength, headerLength + contentLength));
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

function sendPublishDiagnostics(uri: vscode.Uri, diagnostics: { range: { start: { line: number; character: number; }; end: { line: number; character: number; }; }; message: string; }[]) {
  if (publishDiagnosticsCapable) {
    sendMessage({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics } });
  }
}


const requestTable: { [key: string]: any } = {};
const notificationTable: { [key: string]: any } = {};
const tokenTypeToIndex: { [key: string]: any } = {};

let publishDiagnosticsCapable = false;

requestTable["initialize"] = (msg: any) => {
  logMessage("initialize");
  const capabilities = {
    textDocumentSync: 1,
    semanticTokensProvider: {}
  };

  if (msg.params && msg.params.capabilities) {
    if (msg.params.capabilities.textDocument && msg.params.capabilities.textDocument.publishDiagnostics) {
      publishDiagnosticsCapable = true;
    }
    if (msg.params.capabilities.textDocument && msg.params.capabilities.textDocument.semanticTokens && msg.params.capabilities.textDocument.semanticTokens.tokenTypes) {
      const tokenTypes = msg.params.capabilities.textDocument.semanticTokens.tokenTypes;
      for (const i in tokenTypes) {
        tokenTypeToIndex[tokenTypes[i]] = i;
        //logMessage(tokenTypes[i]); // クライアントのサポートしているトークン（単語種別）の種類
      }
      capabilities.semanticTokensProvider = {
        legend: {
          tokenTypes,
          tokenModifiers: [] // 今回は省略
        },
        range: false, // textDocument/semanticTokens/range を無効にする
        full: false    // textDocument/semanticTokens/full を有効にする
      }
    }

    sendMessage({ jsonrpc: "2.0", id: msg.id, result: { capabilities } });
  }
}


requestTable["textDocument/semanticTokens/full"] = (msg: any) => {
  const uri = msg.params.textDocument.uri;

  const data = [];
  let line = 0;
  let character = 0;
  for (const token of buffers[uri].tokens) {

      if (token.kind in tokenTypeToIndex) {
          let d_line;
          let d_char;
          if (token.location.range.start.line === line) {
              d_line = 0;
              d_char = token.location.range.start.character - character;
          } else {
              d_line = token.location.range.start.line - line;
              d_char = token.location.range.start.character;
          }
          line = token.location.range.start.line;
          character = token.location.range.start.character;

          data.push(d_line, d_char, token.text.length, tokenTypeToIndex[token.kind], 0);
          logMessage("TOKEN" + tokenTypeToIndex[token.kind]);
      }
  }

  sendMessage({ jsonrpc: "2.0", id: msg.id, result: { data } })
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

function sendParseErrorResponse() {
  // If there was an error in detecting the id in the Request object (e.g. Parse error/Invalid Request), it MUST be Null.
  // https://www.jsonrpc.org/specification#response_object
  sendErrorResponse(null, -32700, "received an invalid JSON");
}

notificationTable["textDocument/didOpen"] = (msg: any) => {
  const uri = msg.params.textDocument.uri;
  const text = msg.params.textDocument.text;
  compile(uri, text);
  sendPublishDiagnostics(uri, diagnostics);
}

notificationTable["textDocument/didChange"] = (msg: any) => {
  if (msg.params.contentChanges.length !== 0) {
    const uri = msg.params.textDocument.uri;
    const text = msg.params.contentChanges[msg.params.contentChanges.length - 1].text;
    compile(uri, text);
    sendPublishDiagnostics(uri, diagnostics);
  }
}

notificationTable["textDocument/didClose"] = (msg: any) => {
  const uri = msg.params.textDocument.uri;
  sendPublishDiagnostics(uri, []);
}

function compile(uri: string, src: string) {
  diagnostics.length = 0;
  const tokens = tokenize(uri, src);
  logMessage(tokens);
  buffers[uri] = { tokens };
}


//字句解析
//https://zenn.dev/takl/books/0fe11c6e177223/viewer/a505c9


function tokenize(uri: any, src: string) {
  const tokens = [];
  const lines = src.split(/\r\n|\r|\n/);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];

    let kuromojiToken: string | any[] = [];

    builder.build((err: any, tokenizer: any) => {
      // 辞書がなかったりするとここでエラーになります(´・ω・｀)
      if (err) {
        console.dir('KUROMOJI ERR' + err.message);
        throw err;
      }
      // tokenizer.tokenize に文字列を渡すと、その文を形態素解析してくれます。

      kuromojiToken = tokenizer.tokenize(line);
      let character = 0;
      for (let j = 0; j < kuromojiToken.length; j++) {
        const mytoken = kuromojiToken[j];
        character = mytoken.word_position - 1;
        const characterLength = mytoken.surface_form.length;
        const start = { lineNumber, character };
        let kind = mytoken.pos;

        if (kind === '名詞') kind = 'namespace';
        if (kind === '動詞') kind = 'function';
        if (kind === '副詞') kind = 'property';
        if (kind === '助詞') kind = 'modifire';
        if (kind === '記号') kind = 'operator';

        const text = mytoken.surface_form;
        //if (token.pos == '名詞') legend = '5'; 

        character = character + characterLength;
        const end = { lineNumber, character };
        const location = { uri, range: { start, end } };
        //logMessage("TOKEN: uri:" + location.uri + "?=line:" + lineNumber + "start:" + location.range.start.character + ",end:" + location.range.end.character);
        tokens.push({ kind, text, location });
        
      }
    });

  }
}

