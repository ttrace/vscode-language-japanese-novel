# Visual Studio小説モード

Visual Studio Codeで小説を執筆するための機能拡張です。

- [novel-writer公式サイト](https://taiyolab.com/ja/novel-writer/)
- [エディター機能拡張](#editor)
- [サイドパネル・ステータスバー機能拡張](#side-panel)
    - [原稿ツリー編集](#原稿ツリー編集)
    - [文字数カウント](#文字数カウント)
- [原稿用紙プレビュー](#preview)
- [PDF出力](#pdf-features)
- [FAQ](#faq)
- [References](#references)
- [Sponsors](#sponsors)
- [付録](#appendix)

![カラーリング](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/highlight-and-vertical.png)

GitHubスポンサー
novel-writerの開発は[こちらの方々](#sponsors)に応援いただいています。


## Editor

### 段落ハイライト

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

品詞ハイライトは、設定でオフにできます。ワークスペースごとに設定することも可能です。

![設定](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/setting-highlight.png "Settings > Editor > Semantic Highlighting")

![品詞ハイライト](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/semantic-highlight.png "品詞ハイライト")

![標準ハイライト](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/standard-highlight.png "標準ハイライト")

品詞ハイライトにはJavaScriptの形態素解析ライブラリ [Kuromoji.js](https://www.npmjs.com/package/kuromoji) を利用しています。素晴らしいライブラリです。この場を借りてお礼申し上げます。

### Markdown見出しの折りたたみ

![折りたたみ](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/folding-heading.png)

行頭の # を使うMakdownの見出しを折りたたむことができます。
.txtでも有効です。

なお、Markdownの見出しは原稿用紙プレビューやPDFで見出しとして描かれます。

### 次のシーン、前のシーンへ移動

novel形式の書類を開いているときには、前のシーンにあたるファイルや、直後のシーンを開くナビゲーターが表示されます。
ナビゲーターは設定で表示しないように設定できます。

![前のシーンを開く](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/prev-scene.png)

![次のシーンを開く](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/next-scene.png)

### ルビの挿入

novel-writerは青空文庫スタイルのルビを挿入できます。
Novel:ルビの追加（または<kbd>Ctrl</kbd>+<kbd>R</kbd>/<kbd>Command</kbd>+R）を実行するときに選択範囲があれば、選択範囲にルビを振ります。選択範囲がない場合には、カーソル前方の単語、またはカーソルが入っている単語にルビを挿入します。

### 圏点の挿入

novel-writerは青空文庫注記法の圏点（傍点・ゴマ）を挿入できます。
テキストを選択してNovel:圏点の挿入を実行すると、選択範囲を⚪︎⚪︎［＃「⚪︎⚪︎」に傍点］に変換します。この注記は原稿用紙プレビューやPDFで圏点として描かれます。

### 文末辞の切り替え

novel-writerは、日本語の小説で使われる連体形文末辞（〜していた。〜と言った。〜を持った。）と終止形文末辞（〜している。〜と言う。〜を持つ。）を切り替えることができます。  
「Novel:文末辞入れ替え」コマンドにキーボードショートカットを登録してお使いください。文章のリズムを整える作業が軽減できることでしょう。

![文末辞の切り替え](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/tense-aspect-change.gif)

### テキスト結合

ワークスペース中のテキストファイルを結合し、publishフォルダーの中にプロジェクトのフォルダー名のファイルを作ります。

ワークスペースに「原稿」あるいは「Draft」という名称のフォルダーがある場合には、そのフォルダーの中のテキストのみ結合します。もしも締め切りフォルダーが指定されていれば、締め切りフォルダー内のテキストファイルを結合します。

novel-writerは階層化されたフォルダーの中のテキストも結合することができます。  

資料などをワークスペースに保存している場合には、テキストファイルを「原稿（あるいはDraft」フォルダーに入れておいてください。

## Side-panel

### 原稿ツリー編集

![サイドパネルの原稿ツリー](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/drafttree-3.png)

サイドパネルには原稿を一覧できる原稿ツリーがあります。それぞれの原稿には文字数が表示され、クリックするとエディターで開くことができます。
原稿フォルダーはテキストファイルそれぞれの文字数、フォルダー内のテキストファイルを合算表示しています。

![リネームとファイル・フォルダーの挿入](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/drafttree-rename-and-insert.png)
原稿ツリーのテキストファイルがハイライトしているときにEnterキーを押すと、テキストファイルやフォルダーの名前を変更できます。
ハイライトしたファイルの直後に、テキストやフォルダーを追加することも可能です。

#### ドラッグ&ドロップ編集

![原稿ツリー編集](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/drafttree-drag-and-drop-tree.png)
原稿ツリーのタイトル右にあるドラッグ&ドロップを有効化ボタンをクリックすると、原稿ツリーのファイルやフォルダーの順番を入れ替えて、ファイルに連番を付与することができるようになります。

![ドラッグ&ドロップ](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/drafttree-drag-and-drop-button.png)
ドラッグ&ドロップが有効になると、ファイルの連番と拡張子は表示されなくなります。

**注意！**
ドラッグ&ドロップ機能は、ファイルの名前を書き換えます。万全を期してはいますが、バックアップを取るようにしてください。

Gitを利用しているときにファイルの連番を変更すると、たくさんのファイルが削除・追加された状態になりますが、```% git add .```を行うと、同じ内容のファイルをgitが検索して、履歴を継続してくれます（VS Codeでは「ステージに追加」を行ってください）。

### 締め切りフォルダーの設定

バインダーで任意のフォルダーを［締切フォルダー］に指定すると、そのフォルダーに含まれる文字数だけを表示することができます。  
連載原稿の文字数を数えることも可能です。目標の文字数も設定できるようになりました。

目標の文字数を原稿用紙の枚数で指定することも可能です。

![特定フォルダーの文字数カウント](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/counting-custom-folder.png)

原稿のコンパイルを実行すると、締め切りフォルダー内のテキストファイルを結合します。

### 文字数カウント

現在編集中のファイルの文字数と、ワークスペースにあるテキストファイル全てを合算した文字数をステータスバーに表示することができます。ワークスペースに「原稿」あるいは「Draft」という名称のフォルダーがある場合には、そのフォルダーの中だけを計算します。

原稿の文字数は、400文字詰原稿用紙換算でも表示できます。

![文字数カウントの表示](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/display-count-of-draft.png)
![原稿ツリーでのカウント表示](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/display-count-on-tree.png)

#### 進捗・編集距離表示

執筆時点の、前日に対する総文字数の進捗を表示できます。

また、Gitでファイルの履歴を管理している場合には、前日から現在までの編集距離をリアルタイムに表示します。  
改稿した分量を把握するのにお使いください。

![編集距離](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/edit-distance.png)

## Preview

### 原稿用紙プレビュー

コマンドパレットの\[Novel:縦書きプレビュー\]で、現在使っているエディタのテキストを、原稿用紙プレビューすることができます。原稿の表示方法は、縦書きと横書き、一行あたりの文字数を指定することができます。
プレビュー画面はlocalhost:8080に出力していますので、ブラウザーや同じLANの他コンピュターから閲覧することもできます。  
小さな画面で書く場合、またはVS Codeのウインドウを無駄に使いたくない場合には、\[Novel:プレビューサーバーを起動\]を実行して、別画面のブラウザーやブラウザーや他のコンピューター、スマートフォン、タブレットのブラウザーから縦書きプレビューを閲覧することもできます。

縦書きプレビューでは、二桁のASCII数字を縦中横に組んで表示します。

#### プレビュー画面との画面連動

縦書きプレビューでクリック（あるいはタップ）すると、エディタがスクロールしてタップした行を選択します。長いテキストを推敲するときにご利用ください。

#### プレビュー設定

Extension Settings で、文字サイズと一行あたりの文字数、ページあたりの行数を設定してお使いください。
正規表現による検索置換をカスタマイズすることで、オリジナルのタグを挿入することも可能です。

![プレビュー画像](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/preview-settings.png)
![プレビュー画像](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/preview-settings.png)

##### 組み方向の変更

設定でプレビューの縦組と横組を選択できます。

![組み方向の指定](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/writingdirection.png)

![縦組み](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/vertical.png)
![横組み](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/horizontal.png)


###### プレビューフォントの設定
プレビューフォントの設定が可能です。

Contributed by [yasudaz](https://github.com/yasudaz)](https://github.com/yasudaz)

##### 版面指定

1行あたりの文字数、1ページあたりの行数を指定できます。

##### 正規表現検索置換

出力するHTMLを検索置換することができます。オリジナルのタグを挿入する場合などにご利用ください。  

## PDF Features

novel-writerは[Vivliostyle/CLI](https://vivliostyle.org/ja/)を用いて、選択しているテキストファイルのA5変型版（130mm×190mm）の縦書きPDFを出力します。

1行が短く、ページあたりの行数が長い場合には段組で印刷します。

![PDF出力](https://github.com/ttrace/vscode-language-japanese-novel/raw/main/resource/pdf-typesettings.png)

PDFを保存するときは、コマンドパレットから「Novel:PDF出力」を実行してください。

* PDF出力にはワークスペースが必要です。フォルダを開いて利用してください。


### PDF用のカスタムCSS

レイアウトを固定して、異なる版面や上下・ノド・小口の空き、新たなスタイルシートを導入いただけます。印刷物を作成する場合にご利用ください。またカスタムCSSでは、いくつかのnovel-writer変数を利用できます。

- ${writingDirection}: 縦書き、横書きの組み方向をnovel-writerの設定で指定できます
- ${fontSizeWithUnit}: 文字サイズをnovel-writerの設定で指定できます
- ${originPageNumber}: ノンブルの開始ページをnovel-writerの設定で指定できます
- ${pageNumberFormatR}: ページの柱をnovel-writerの設定で指定できます
- ${pageStartingCss}: PDFが右ページ開始か、左ページ開始かをnovel-writerの設定で指定できます
- ${columnCSS}: 段数をnovel-writerの自動計算で指定できます
- ${columnHeitghtRate}: 一段の高さをnovel-writerの自動計算で指定できます

novel-writerの標準的なprint.cssは、以下で閲覧できます
    - [GitHub ttrace/vscode-language-japanese-novel/blob/main/htdocs/css/print.css](https://github.com/ttrace/vscode-language-japanese-novel/blob/main/htdocs/css/print.css)

### PDF出力機能拡張の設定項目
novel-writerのPDF出力は原稿のために開発していますが、簡単な冊子の本文作成にも利用できます。

#### PDFページ番号フォーマット
ページ下部のページ番号のフォーマットを指定できます。  
初期値の```${projectTitle} ${typesettingInformation} ${pageNumber}```を用いると、

作品名 22文字 x 13行 12

とフッターに挿入されます。以下に例を示します。
```
page ${pageNumber}　→ page 12  
- ${pageNumber}-　→ -12-
${projectTitle} p${pageNumber}　→ 作品名 p12
```

#### PDF開始ページ番号
PDFのページ番号の開始ページを指定できます。

#### PDF開始ページの左右設定
PDFの第一ページを左右どちらにするか設定できます。
冊子の場合は「左」に、原稿提出の時は「右」にしておくといいでしょう。

## FAQ

### vscode-textlintとの併用
novel-writerはnovelというファイル形式を用いますので、VS CodeのsettingsでのTextlint: Languagesにnovelを追加してください。

### novel-writerの機能を無効にしたい場合

VS Codeは標準的なテキストファイルで小説を書くための機能拡張ですので、小説ではないプロジェクトを開いたときにも動作してしまいます。novel-writerの機能を停止したい場合には、VS Codeのプロファイルを用いてnovel-writerが動作しないプロファイル（あるいはnovel-writerが有効なプロファイル）を作成してご利用ください。

novel形式ための特別な拡張子を追加する要望があることは承知していますが、OSの標準的な機能を利用できない拡張子をメンテナンスすることは困難ですので、VS Code本体で言語と拡張子に関する機能拡張が行われるまでは対応できません。

## References

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

## Sponsors
[GitHub Sponsors](https://github.com/sponsors/ttrace)でご支援いただいている方々です

[![haoblackj](https://github.com/haoblackj.png?size=24)](https://github.com/haoblackj)
[![suzukin](https://github.com/suzukin.png?size=24)](https://github.com/suzukin)
[![kento-oka](https://github.com/kento-oka.png?size=24)](https://github.com/kento-oka)
[![umiumaya](https://github.com/umiumaya.png?size=24)](https://github.com/umiumaya)
[![fuji-nakahara](https://github.com/fuji-nakahara.png?size=24)](https://github.com/fuji-nakahara)
[![ryoutakano](https://github.com/ryoutakano.png?size=24)](https://github.com/ryoutakano)
[![bills-appworks](https://github.com/bills-appworks.png?size=24)](https://github.com/bills-appworks)

## Appendix

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
