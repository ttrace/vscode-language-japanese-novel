import * as vscode from 'vscode';

export type UnitOfFontSize = 'pt' | 'mm' | 'em' | 'rem' | 'px' | 'vh' | 'vw' | 'q';
export type FontSize = `${number}${UnitOfFontSize}`;

export type PreviewSettings = {
    lineHeightRate: number,
    fontFamily: string,
    fontSize: FontSize,
    numFontSize: number,
    unitOfFontSize: UnitOfFontSize,
    lineLength: number,
    linesPerPage: number,
    pageWidth: string,
    pageHeight: string,
    lineHeight: string,
};

function parseFontSizeNum(fontSize: FontSize, defaultValue: number) : number {
    const result = /([\d.]+)(\D+)/.exec(fontSize);
    if (result && result[1]) {
        return parseFloat(result[1]);
    } else {
        return defaultValue;
    }
}

function parseUnitOfFontSize(fontSize: FontSize, defaultValue: UnitOfFontSize) : UnitOfFontSize {
    const result = /(\d+)(pt|mm|em|rem|px|vh|vw|q)/.exec(fontSize);
    if (result && result[2]) {
        return result[2] as UnitOfFontSize;
    } else {
        return defaultValue;
    }
}

export function getConfig() : PreviewSettings {
    const config = vscode.workspace.getConfiguration('Novel');

    const lineHeightRate    = 1.75;
    const fontFamily        = config.get<string>('preview.font-family', 'serif');
    const fontSize          = config.get<FontSize>('preview.fontsize', '14pt' as FontSize);
    const numFontSize       = parseFontSizeNum(fontSize, 14);
    const unitOfFontSize    = parseUnitOfFontSize(fontSize, 'pt');
    const lineLength        = config.get<number>('preview.linelength', 40);
    const linesPerPage      = config.get<number>('preview.linesperpage', 10);
    const pageWidth         = `${linesPerPage * numFontSize * lineHeightRate * 1.003}${unitOfFontSize}`;
    const pageHeight        = `${lineLength * numFontSize}${unitOfFontSize}`;
    const lineHeight        = `${numFontSize * lineHeightRate}${unitOfFontSize}`;

    const previewSettings = {
        lineHeightRate,
        fontFamily    ,
        fontSize      ,
        numFontSize   ,
        unitOfFontSize,
        lineLength    ,
        linesPerPage  ,
        pageWidth     ,
        pageHeight    ,
        lineHeight    ,
    }
    return previewSettings;
}

