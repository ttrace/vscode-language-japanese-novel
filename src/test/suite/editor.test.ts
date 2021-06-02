import * as assert from 'assert';
import * as vscode from 'vscode';
import { editorText, markUpHtml } from '../../editor'

suite('Editor Test Suite', () => {
    suite('editorText', () => {
        let textDoc: vscode.TextDocument;
        let textEditor: vscode.TextEditor;
        setup(async () =>  {
            textDoc = await vscode.workspace.openTextDocument(
                {language: 'text', content: "こんにちは"}
            );
            textEditor = await vscode.window.showTextDocument(textDoc);
        });
        test('HTMLタグがつけられたテキストを返す', () => {
            assert.strictEqual<string>(editorText(textEditor), '<p><span id="cursor">こ</span>んにちは</p>');
        });
    });
    suite('markUpHtml', () => {
        test('普通の文字列はそのまま通る', () => {
            assert.strictEqual<string>(markUpHtml("こんにちは。"), "こんにちは。");
        });
        test('"｜"を使うルビ記法が正しく変換される', () => {
            assert.strictEqual<string>(markUpHtml("｜今日《きょう》はいい｜天気《てんき》ですね。"),
                "<ruby>今日<rt>きょう</rt></ruby>はいい<ruby>天気<rt>てんき</rt></ruby>ですね。");
        });
        test('"｜"を使わないルビ記法が正しく変換される', () => {
            assert.strictEqual<string>(markUpHtml("今日《きょう》はいい天気《てんき》ですね。"),
                "<ruby>今日<rt>きょう</rt></ruby>はいい<ruby>天気<rt>てんき</rt></ruby>ですね。");
        });
        test('傍点記法が正しく変換される', () => {
            assert.strictEqual<string>(markUpHtml("今日はいい天気［＃「いい天気」に傍点］ですね。"),
                '今日は<em class="side-dot">いい天気</em>ですね。');
        });
    });
});
