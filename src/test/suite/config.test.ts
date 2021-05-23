import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as sinon from 'sinon';

import { getConfig, FontSize, UnitOfFontSize } from '../../config';

suite('Config Test Suite', () => {
    let sandbox: sinon.SinonSandbox;

    vscode.window.showInformationMessage('Start config tests.');

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('When novel configuration is empty', () => {
        setup(() => {
            function fakeGetFunc(_key: string, defaultVal: string | number) {
                return defaultVal;
            }

            const configMock = {get: fakeGetFunc} as vscode.WorkspaceConfiguration;

            sandbox.stub(vscode.workspace, 'getConfiguration').returns(configMock);
        });

        test('lineHeightRate should be 1.75', () => {
            assert.strictEqual<number>(getConfig().lineHeightRate, 1.75);
        });

        test('fontFamily should be serif', () => {
            assert.strictEqual<string>(getConfig().fontFamily, 'serif');
        });

        test('fontSize should be 14pt', () => {
            assert.strictEqual<FontSize>(getConfig().fontSize, '14pt');
        });

        test('numFontSize should be 14', () => {
            assert.strictEqual<number>(getConfig().numFontSize, 14);
        });

        test('unitOfFontSize should be pt', () => {
            assert.strictEqual<UnitOfFontSize>(getConfig().unitOfFontSize, 'pt');
        });
    });

    suite('When novel configuration has some values', () => {
        setup(() => {
            function fakeGetFunc(key: string, defaultVal: string | number) {
                switch (key) {
                case 'preview.font-family':
                    return 'Helvetica';
                case 'preview.fontsize':
                    return '48px';
                default:
                    return defaultVal;
                }
            }

            const configMock = {get: fakeGetFunc} as vscode.WorkspaceConfiguration;

            sandbox.stub(vscode.workspace, 'getConfiguration').returns(configMock);
        });

        test('lineHeightRate should be 1.75', () => {
            assert.strictEqual<number>(getConfig().lineHeightRate, 1.75);
        });

        test('fontFamily should be Helvetica', () => {
            assert.strictEqual<string>(getConfig().fontFamily, 'Helvetica');
        });

        test('fontSize should be 48px', () => {
            assert.strictEqual<FontSize>(getConfig().fontSize, '48px');
        });

        test('numFontSize should be 48', () => {
            assert.strictEqual<number>(getConfig().numFontSize, 48);
        });

        test('unitOfFontSize should be px', () => {
            assert.strictEqual<UnitOfFontSize>(getConfig().unitOfFontSize, 'px');
        });
    });
});
