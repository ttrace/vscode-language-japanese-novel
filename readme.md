# Visual Studio小説モード

<!-- @import "[TOC]" {cmd="toc" depthFrom=2 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [ハイライト](#ハイライト)
  - [品詞ハイライト](#品詞ハイライト)
- [文字数のカウント](#文字数のカウント)
  - [締め切りフォルダーの設定](#締め切りフォルダーの設定)
  - [編集距離の表示](#編集距離の表示)
- [次のシーン、前のシーンへ移動](#次のシーン-前のシーンへ移動)
- [文末辞の切り替え](#文末辞の切り替え)
- [縦書きプレビュー](#縦書きプレビュー)
  - [プレビュー画面との画面連動](#プレビュー画面との画面連動)
  - [プレビュー設定](#プレビュー設定)
    - [プレビューフォントの設定](#プレビューフォントの設定)
    - [版面指定](#版面指定)
    - [正規表現検索置換](#正規表現検索置換)
- [PDF出力](#pdf出力)
- [テキスト結合](#テキスト結合)
- [参考にした文献](#参考にした文献)
- [Copyright](#copyright)
- [付録](#付録)
  - [ハイライト設定](#ハイライト設定)

<!-- /code_chunk_output -->

Visual Studio Codeで小説を執筆するための機能拡張です。

リアルタイム更新の縦書きプレビューで印刷時の組版に近い読み方を確かめつつ、会話と地の文、名詞や動詞、助詞などの品詞ハイライトを備えたエディターで執筆を行うことが可能です。句読点をぶら下げる縦書きプレビューでは1行当たりの文字数を指定できますので、13文字や15文字といった新聞のような短い段組の文字送りを確かめながら執筆できます。

CSS組版システムVivliostyleを用いることで、縦書きプレビューの字数行数を用いるのPDFも出力できます。

novel-writerは長編小説（ノベル）の執筆支援を行います。  
単一のテキストファイルではなく、章や部を想定し、入れ子になったフォルダーに保存する複数のテキストファイルの文字数を表示したり、複数のテキストファイルを単一のファイルに結合したりする機能を備えています。  
また、特定のフォルダーを「締め切りフォルダー」に指定することで、そのフォルダーが含む複数のテキストファイルの文字数を表示することも可能です。

![カラーリング](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/highlight-and-vertical.png)

##　ハイライト

novel-writerは小説で用いる会話文や青空文庫注記法などをハイライトします。

- 鉤括弧（「」）で挟まれた会話
- 青空文庫の注記
    - ルビ
    - ［＃「」に傍点］
    - そのほか、［＃……］で記される記法
- 数字と単位
- 品詞  
名詞、固有名詞、代名詞、助詞、形容詞、形容動詞、動詞、接尾語、数詞をハイライトします。詳しくは直下の[品詞ハイライト](#品詞ハイライト)を参照してください。

### 品詞ハイライト
novel-writerは形態素解析を用いて分割した品詞をハイライトすることができます。テキストの可読性が向上することを期待して実装した機能です。

品詞はVisual Studio CodeのSemantic Highlighting（文脈依存ハイライト）で行っています。色を変更したい方はReadmeの末尾にある[付録](#付録)を参照し、お好みのカラーにカスタマイズしてお使いください。  
初期設定では、名詞が青系統、動詞、形容詞がマゼンタ系統、副詞をオレンジ色、会話を緑系統にまとめています。

品詞ハイライトは、コマンドパレットの「Novel:品詞ハイライト開始」「Novel:品詞ハイライト停止」でオンオフできます。

![設定](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/setting-highlight.png "Settings > Editor > Semantic Highlighting")

![品詞ハイライト](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/semantic-highlight.png "品詞ハイライト")

![標準ハイライト](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/standard-highlight.png "標準ハイライト")

品詞ハイライトにはJavaScriptの形態素解析ライブラリ [Kuromoji.js](https://www.npmjs.com/package/kuromoji) を利用しています。素晴らしいライブラリです。この場を借りてお礼申し上げます。


## 文字数のカウント

現在編集中のファイルの文字数と、ワークスペースにあるテキストファイル全てを合算した文字数をステータスバーに表示することができます。ワークスペースに「原稿」あるいは「Draft」という名称のフォルダーがある場合には、そのフォルダーの中だけを計算します。

### 締め切りフォルダーの設定

バインダーで任意のフォルダーを［締切フォルダー］に指定すると、そのフォルダーに含まれる文字数だけを表示することができます。  
連載原稿の文字数を数えることも可能です。目標の文字数も設定できるようになりました。

![特定フォルダーの文字数カウント](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/counting-custom-folder.png)

原稿のコンパイルを実行すると、締め切りフォルダー内のテキストファイルを結合します。

### 編集距離の表示

Gitでファイルの履歴を管理している場合には、前日から現在までの編集距離をリアルタイムに表示します。  
改稿した分量を把握するのにお使いください。

![編集距離](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/edit-distance.png)

## 次のシーン、前のシーンへ移動

novel形式の書類を開いているときには、前のシーンにあたるファイルや、直後のシーンを開くナビゲーターが表示されます。
ナビゲーターは設定で表示しないように設定できます。

![前のシーンを開く](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/prev-scnene.png)

![次のシーンを開く](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/next-scnene.png)


## 文末辞の切り替え

novel-writerは、日本語の小説で使われる連体形文末辞（〜していた。〜と言った。〜を持った。）と終止形文末辞（〜している。〜と言う。〜を持つ。）を切り替えることができます。  
「Novel:文末辞入れ替え」コマンドにキーボードショートカットを登録してお使いください。文章のリズムを整える作業が軽減できることでしょう。

![文末辞の切り替え](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/tense-aspect-change.gif)

## 縦書きプレビュー

コマンドパレットの\[Novel:縦書きプレビュー\]で、現在使っているエディタのテキストを縦書きプレビューすることができます。  
プレビューはlocalhost:8080に出力していますので、ブラウザーや同じLANの他コンピュターから閲覧することもできます。  
小さな画面で書く場合、またはVS Codeのウインドウを無駄に使いたくない場合には、\[Novel:プレビューサーバーを起動\]を実行して、別画面のブラウザーやブラウザーや他のコンピューター、スマートフォン、タブレットのブラウザーから縦書きプレビューを閲覧することもできます。

縦書きプレビューでは、二桁のASCII数字を縦中横に組んで表示します。

### プレビュー画面との画面連動

縦書きプレビューでクリック（あるいはタップ）すると、エディタがスクロールしてタップした行を選択します。長いテキストを推敲するときにご利用ください。

### プレビュー設定

Extension Settings で、文字サイズと一行あたりの文字数、ページあたりの行数を設定してお使いください。
正規表現による検索置換をカスタマイズすることで、オリジナルのタグを挿入することも可能です。

![プレビュー画像](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/preview-settings.png)

#### プレビューフォントの設定
プレビューフォントの設定が可能です。

contributed by [yasudaz](https://github.com/yasudaz)

#### 版面指定

1行の字数、1ページあたりの行数を指定できます。

#### 正規表現検索置換

出力するHTMLを検索置換することができます。オリジナルのタグを挿入する場合などにご利用ください。  

## PDF出力

novel-writerは[Vivliostyle/CLI](https://vivliostyle.org/ja/)を用いて、選択しているテキストファイルのA5変型版（130mm×190mm）の縦書きPDFを出力します。以下のコマンドをでVivlioStyleをインストールしてからPDF出力を実行してください。

```
npm install @vivliostyle/cli -g
```

1行が短く、ページあたりの行数が長い場合には段組で印刷します。

![PDF出力](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/pdf-typesettings.png)

PDFを保存するときは、Vivliostyleの印刷ダイアログでプリンターを「PDFに保存」に設定してください。

![PDFを保存](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/print-dialogue.png)

* PDF出力にはワークスペースが必要です。フォルダを開いて利用してください。

## テキスト結合

ワークスペース中のテキストファイルを結合し、publishフォルダーの中にプロジェクトのフォルダー名のファイルを作ります。

ワークスペースに「原稿」あるいは「Draft」という名称のフォルダーがある場合には、そのフォルダーの中のテキストのみ結合します。もしも締め切りフォルダーが指定されていれば、締め切りフォルダー内のテキストファイルを結合します。

novel-writerは階層化されたフォルダーの中のテキストも結合することができます。  

資料などをワークスペースに保存している場合には、テキストファイルを「原稿（あるいはDraft」フォルダーに入れておいてください。

## 参考にした文献

novel-writerはさまざまなWeb文書を参考にさせていただきました。特に参考になったのは以下の二つのウェブサイトです。

VSCodeで俺々言語モードを作る
https://qiita.com/takl/items/ba2f63db515f66585d1f

Language Grammars
https://macromates.com/manual/en/language_grammars

## Copyright
MIT

縦書き表示を行う方法については、MITライセンスで公開されているn-fukiju/縦書きプレビューのコードを大いに参考にさせていただきました。
幾らかはそのまま利用させていただいています。
[n-fukuju/vertical-writing-vsce](https://github.com/n-fukuju/vertical-writing-vsce)

文字数を計算する部分、ステータスバーでの文字数表記は、MITライセンスで公開されている8amjp/vsce-charactercountの成果を使わせていただいています。
[8amjp/vsce-charactercount](https://github.com/8amjp/vsce-charactercount)

## 付録

### ハイライト設定
機能拡張に内蔵しているデフォルトのハイライト設定です。  
色を変更したい場合にはこの設定を編集して、SettingsのEditor > Semantic Token Color Customizationsを書き換えてください。

```json
"editor.semanticTokenColorCustomizations": {
"[Default Light+]": {
    "enabled": true,
    "rules": {
    "noun": {
        "foreground": "#4e549a"
    },
    "noun.dialogue": {
        "foreground": "#20a23a"
    },
    "proper_noun": {
        "foreground": "#0041cc"
    },
    "proper_noun.dialogue": {
        "foreground": "#004b70",
        "fontStyle": "bold"
    },
    "enum": {
        "foreground": "#001c78"
    },
    "enum.dialogue": {
        "foreground": "#00b4a8"
    },
    "suffix": {
        "foreground": "#676767"
    },
    "suffix.dialogue": {
        "foreground": "#58adc0"
    },
    "personal_pronoun": {
        "foreground": "#580000"
    },
    "personal_pronoun.dialogue": {
        "foreground": "#005772"
    },
    "pronoun": {
        "foreground": "#34009b",
        "fontStyle": "bold"
    },
    "pronoun.dialogue": {
        "foreground": "#0068f0",
        "fontStyle": "bold"
    },
    "punctuation": {
        "foreground": "#000000"
    },
    "punctuation.dialogue": {
        "foreground": "#284080",
        "fontStyle": "bold"
    },
    "bracket": {
        "foreground": "#d43c00d3"
    },
    "bracket.dialogue": {
        "foreground": "#9a0b0bd3",
        "bold": true
    },
    "bracket.quote": {
        "foreground": "#0b1e9ad3"
    },
    "adverb": {
        "foreground": "#b04d02"
    },
    "adverb.dialogue": {
        "foreground": "#30be91"
    },
    "auailiary_verb": {
        "foreground": "#da05ff"
    },
    "auailiary_verb.dialogue": {
        "foreground": "#567387"
    },
    "verb": {
        "foreground": "#8800ff"
    },
    "verb.dialogue": {
        "foreground": "#7fad00"
    },
    "particle": {
        "foreground": "#0000ff"
    },
    "particle.dialogue": {
        "foreground": "#059f2e"
    },
    "adjective": {
        "foreground": "#0771a7"
    },
    "interjection": {
        "foreground": "#ac6404",
        "fontStyle": "bold"
    },
    "interjection.dialogue": {
        "foreground": "#20b336",
        "fontStyle": "bold"
    },
    "*.quote": {
        "italic": true,
        "bold": true
    },
    "*.aozora": {
        "foreground": "#9d9d9d",
        "italic": true
    },
    "bracket.aozora": {
        "foreground": "#c28458"
    }
    }
},
"[Default Dark+]": {
    "enabled": true,
    "rules": {
    "noun": {
        "foreground": "#77c4fc"
    },
    "noun.dialogue": {
        "foreground": "#1dfcbd"
    },
    "proper_noun": {
        "foreground": "#5d8ffb"
    },
    "proper_noun.dialogue": {
        "foreground": "#0efd52",
        "fontStyle": "standard"
    },
    "enum": {
        "foreground": "#8fa4e9"
    },
    "enum.dialogue": {
        "foreground": "#02d4c6"
    },
    "suffix": {
        "foreground": "#9489db"
    },
    "suffix.dialogue": {
        "foreground": "#4efab0"
    },
    "personal_pronoun": {
        "foreground": "#83c1ff"
    },
    "personal_pronoun.dialogue": {
        "foreground": "#00aade"
    },
    "pronoun": {
        "foreground": "#6767ff",
        "fontStyle": "bold"
    },
    "pronoun.dialogue": {
        "foreground": "#00c0f0",
        "fontStyle": "bold"
    },
    "punctuation": {
        "foreground": "#ffffff"
    },
    "punctuation.dialogue": {
        "foreground": "#c7ffca",
        "fontStyle": "bold"
    },
    "bracket": {
        "foreground": "#d43c00d3"
    },
    "bracket.dialogue": {
        "foreground": "#ff9900d3",
        "bold": true
    },
    "bracket.quote": {
        "foreground": "#5469f1d3"
    },
    "adverb": {
        "foreground": "#ff882d"
    },
    "adverb.dialogue": {
        "foreground": "#30be80"
    },
    "auailiary_verb": {
        "foreground": "#fdb5ff"
    },
    "auailiary_verb.dialogue": {
        "foreground": "#22ca73"
    },
    "verb": {
        "foreground": "#fc50ff"
    },
    "verb.dialogue": {
        "foreground": "#29ff9b"
    },
    "particle": {
        "foreground": "#03cccf"
    },
    "particle.dialogue": {
        "foreground": "#b7f0bc"
    },
    "adjective": {
        "foreground": "#0771a7"
    },
    "adjective.dialogue": {
        "foreground": "#07a74c"
    },
    "interjection": {
        "foreground": "#ac6404",
        "fontStyle": "bold"
    },
    "interjection.dialogue": {
        "foreground": "#22c54b",
        "fontStyle": "bold"
    },
    "*.quote": {
        "italic": true,
        "bold": true
    },
    "*.aozora": {
        "foreground": "#807e7e",
        "italic": true
    },
    "bracket.aozora": {
        "foreground": "#c28458"
    }
    }
}
}
  ```