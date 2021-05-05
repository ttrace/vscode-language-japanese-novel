# Visual Studio小説モード

<!-- @import "[TOC]" {cmd="toc" depthFrom=2 depthTo=6 orderedList=false} -->

小説を書く際に用いる言語モードです。会話や青空文庫の注記法で記されたルビなどをカラーリングします。

![カラーリング](https://github.com/ttrace/vscode-language-japanese-novel/raw/master/resource/highlight-and-vertical.png)

## 実装しているハイライト
- 鉤括弧（「」）で挟まれた会話
- 青空文庫の注記
    - ルビ
    - ［＃「」に傍点］
    - そのほか、［＃……］で記される記法
- 数字と単位

## 縦書きプレビュー

メニューの\[Novel:縦書きプレビュー\]で、現在使っているエディタのテキストを、HTMLの縦書きでプレビューすることができます。

Extension Settings で、文字サイズと一行あたりの文字数、ページあたりの行数を設定してお使いください。正規表現による検索置換も実装しましたので、オリジナルのタグを挿入することも可能です。

![プレビュー画像](https://github.com/ttrace/vscode-language-japanese-novel/raw/master/resource/preview-settings.png)

### プレビューフォントの設定
プレビューフォントの設定が可能です。

contributed by [yasudaz](https://github.com/yasudaz)

### 版面指定

文字サイズ、文字数、1ページあたりの行数を指定できます。

## PDF出力

この小説言語モードは、実験的に[Vivliostyle/CLI](https://vivliostyle.org/ja/)を用いて、縦書きのPDFを出力します。
ワークスペースが必要になるので、フォルダを開いて利用してください。

## 参考にした文献
VSCodeで俺々言語モードを作る
https://qiita.com/takl/items/ba2f63db515f66585d1f

Language Grammars
https://macromates.com/manual/en/language_grammars

## copyright
MIT

なお縦書き表示を行う方法については、MITライセンスで公開されているn-fukiju/縦書きプレビューのコードを大いに参考にさせていただきました。
幾らかはそのまま利用させていただいています。
[n-fukuju/vertical-writing-vsce](https://github.com/n-fukuju/vertical-writing-vsce)
