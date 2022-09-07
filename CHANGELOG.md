# Changelog

# 1.3.14

- 青空文庫の注記法を品詞モディファイアで捕捉できるようになりました

# 1.3.13

- 青空文庫注記法の文字下げが動作していなかった問題に対処
- 大きなディスプレイを使っているときに行番号の枠が消えてしまう問題に対処
- npmモジュールの更新
    fastest-levenshtein               ^1.0.14  →   ^1.0.16
    simple-git                        ^3.10.0  →   ^3.14.0
    @types/glob                        ^7.2.0  →    ^8.0.0
    @types/node                       ^18.0.6  →  ^18.7.15
    @types/vscode                     ^1.69.0  →   ^1.71.0
    @types/webpack-env                ^1.17.0  →   ^1.18.0
    @typescript-eslint/eslint-plugin  ^5.30.7  →   ^5.36.2
    @typescript-eslint/parser         ^5.30.7  →   ^5.36.2
    @vscode/test-web                  ^0.0.27  →   ^0.0.30
    eslint                            ^8.20.0  →   ^8.23.0
    typescript                         ^4.7.4  →    ^4.8.2
    webpack                           ^5.73.0  →   ^5.74.0

# 1.3.12

- カーソルの視認性を向上
- npmモジュールの更新
  - fastest-levenshtein               ^1.0.14  →   ^1.0.16
  - simple-git                        ^3.10.0  →   ^3.13.0
  - @types/node                       ^18.0.6  →  ^18.7.13
  - @types/vscode                     ^1.69.0  →   ^1.70.0
  - @types/webpack-env                ^1.17.0  →   ^1.18.0
  - @typescript-eslint/eslint-plugin  ^5.30.7  →   ^5.35.1
  - @typescript-eslint/parser         ^5.30.7  →   ^5.35.1
  - @vscode/test-web                  ^0.0.27  →   ^0.0.29
  - eslint                            ^8.20.0  →   ^8.22.0
  - typescript                         ^4.7.4  →    ^4.8.2
  - webpack                           ^5.73.0  →   ^5.74.0

# 1.3.11

- アニメーションスクロールの抑制  
アニメーションスクロールの呼び出しが蓄積しないように修正しました。

# 1.3.10

- アニメーションスクロールの抑制  
カーソルが2行よりも小さくしか動かないときに、スクロールアニメーションを行わないように修正しました。

# 1.3.9

- 編集距離を表示する際に出していたgit関係のアラートを抑止しました
- npmのモジュールを更新しています
  - fastest-levenshtein                ^1.0.12  →   ^1.0.14     
  - simple-git                          ^3.7.1  →   ^3.10.0     
  - ws                                  ^8.8.0  →    ^8.8.1     
  - @types/node                       ^17.0.41  →   ^18.0.6     
  - @types/sinon                      ^10.0.11  →  ^10.0.13     
  - @types/vscode                      ^1.68.0  →   ^1.69.0     
  - @typescript-eslint/eslint-plugin   ^5.27.1  →   ^5.30.7     
  - @typescript-eslint/parser          ^5.27.1  →   ^5.30.7     
  - @vscode/test-web                   ^0.0.24  →   ^0.0.27     
  - eslint                             ^8.17.0  →   ^8.20.0     
  - ts-loader                           ^9.3.0  →    ^9.3.1     
  - typescript                          ^4.7.3  →    ^4.7.4     
  - webpack-cli                         ^4.9.2  →   ^4.10.0  

# 1.3.8

- 縦書きプレビューの左右スクロールをアニメーションするように変更しました

# 1.3.7

- コメントアウトのトークンモディファイア"comment"を作成しました。
- 閉じる方の鉤括弧が他の括弧と重なっている時に、品詞ハイライトの会話が閉じなくなっている問題を修正しました。

# 1.3.6

- コメントアウトの吹き出しがずれていたのを修正しました。

# 1.3.5

- 日本語小説の文末辞「た」「る」を切り替えるコマンド「Novel:文末辞入れ替え」を実装しました。  
コマンドを実行すると、カーソルを挿入した文の文末辞を、終止形（笑う、言う、払う、見ているなど）から連体形（笑った、言った、払った、見ていたなど）に変換します。

# 1.3.4

- プレビューサーバーのURLをhostnameに変更

## 1.3.3

- 品詞ハイライトの開始・停止を実装  
品詞ハイライトをコマンドでオンオフできるようになりました

## 1.3.2

- カラーリングのデフォルトスタイルから「太字」を削除

## 1.3.1

- 青空文庫注記法の縦中横をサポート  
縦書きプレビューで、tcy［＃「tcy」は縦中横］と注記した縦中横を描くようになります

## 1.3

- 縦書きプレビューに行番号を表示  
この変更に伴い、1.2までで実装していたページ区切りの目安にしていたグラデーションを止めました。ページ区切りは別の方法で復活させます。
- プレビューサーバーのURL表示  
Visual Studio Codeの縦書きプレビューインデックスに、サーバーのアドレスとポート番号を表示するように変更しました。

## 1.2

- kuromoji.jsを用いた形態素解析を導入。品詞ハイライトを実現しました。
- 縦書きプレビューでタップした行をエディターで表示できるようになりました。
- 縦書きプレビューのポート番号を、VS Codeのプレビューに表示します。


## 1.0.9

- 縦書きプレビューを複数のワークスペースで同時に実行できるようになりました。
    - 縦書きプレビューを実行したワークスペースは、8080から偶数番号ずつ増えるポート番号で縦書きサーバーを起動します。  
    外部のWebブラウザーや、モバイル端末から縦書きを表示するときは、8080、8082、8084と増えていく番号のいずれかを指定してください。


## 1.0.8

- 縦書きプレビューする言語を novel, plaintext, markdown の三種類に限定しました。

## 1.0.7

- [Issue ユーザー定義検索置換後に2桁の数字が含まれていると意図しない置換が発生する \#30](https://github.com/ttrace/vscode-language-japanese-novel/issues/30) by [nakaba-yono](https://github.com/nakaba-yono)に対処しました。

## 1.0.6

- アイコンをつけました。

## 1.0.5

- novel、markdown、plaintext以外の書類やウインドウを開いているときに文字数カウントを表示しないように修正しました。

## 1.0.4 debug release

- パッケージングのミスを修正しました。

## 1.0.3

- 1.0.0でマージした[Masayoshi Takahashi](https://github.com/takahashim)さんのPRを再度マージして、[Use fastest-levenshtein instead of (a copy of) levenshtein-edit-distance \#26](https://github.com/ttrace/vscode-language-japanese-novel/pull/26)をマージして、編集距離を用いるnpmモジュールを、[fastest-levenshtein](https://github.com/ka-weihe/fastest-levenshtein)に変更しました。
- 縦書きプレビューに自動縦中横機能をつけました。二桁の半角数字を縦中横でプレビューします。


## 1.0.2

- [Takahashi Masayoshi](https://github.com/takahashim)さんのPR、[Unify all settings of this extension with NovelSettings](https://github.com/ttrace/vscode-language-japanese-novel/pull/27)をマージしました
- 1.0.1 で書いた編集距離に関するワーニングを整理しました。

## 1.0.1

昨日以前のコミットがないときに編集距離が機能しない問題を解消しました。  
v1.0.1以降は、前日までのコミットが見つからない場合（作業当日の）最も古いコミットからの編集距離を表示します。

ステータスバーのアイコンを変更しました。

ファイルを開いたときに編集距離が更新されないバグを修正しました。

## 1.0.0

[Masayoshi Takahashi](https://github.com/takahashim)さんのPR、[Use fastest-levenshtein instead of (a copy of) levenshtein-edit-distance \#26](https://github.com/ttrace/vscode-language-japanese-novel/pull/26)をマージして、編集距離を用いるnpmモジュールを、[fastest-levenshtein](https://github.com/ka-weihe/fastest-levenshtein)に変更しました。

## 0.9.9

編集距離を算出する基準ファイルの更新日を、24時間前から、当日の0時に変更しました。
## 0.9.8

デバッグリリースです。  
catch-then構文を入れ変えました。大きなファイルを開いている時にレスポンスが悪くなっていた症状が軽減されます。


## 0.9.7

文字数表示欄に、前日からの編集距離を表示を搭載しました。  
前日の状態はGitのコミットを参照しているので、Gitで履歴管理されていないファイルの編集距離は表示できません。またファイル名をGit mvを用いずに変更した場合にも、編集距離の表示はできません。

編集距離には、最大0.5秒の遅延評価を行います。

編集距離は、MITライセンスで公開してくださっている[Titus Wormer](https://wooorm.com)さんの[levenshtein-edit-distance](https://www.npmjs.com/package/levenshtein-edit-distance)のソースコードを用いています。  
本来ならEMSモジュールをインポートして利用すべきところですが、Visual Studio Codeのエクステンションに組み込で利用する際の規則を私が理解していないため、ソースを直接埋め込んで利用させていただいています。

## 0.9.5

文字数のカウントに失敗するケースに対処しました。  
根本的な対策ではないので、近いうちに再実装しなおします。

## 0.9.3

全ドキュメントと締め切りフォルダーの文字数が、リアルタイム表示できるようになりました。  
標準ではないキーバインドを使っている場合には数字が反映されない場合があります。

## 0.9.2

Windowsでサーバーが404になるバグに対処しました。  
報告してくださった[Orito Itsuki](https://github.com/MatchaChoco010)さん、教えてくださった[開途](https://twitter.com/Kaito_YST)さん、ありがとうございます！
resolving a bug > [:bug: fix windows server path issue](https://github.com/ttrace/vscode-language-japanese-novel/pull/24) by [Orito Itsuki](https://github.com/MatchaChoco010)

## 0.9.1

文字数カウントのメニューを「締め切りフォルダー」に変更しました。  
また、締め切りフォルダーの設定時に目標の文字数を設定できるようになりました。

## 0.9.0

HTML形式のコメントアウトにもカラーリングを行うことにしました。

内部的な変更ですが、縦書きのプレビューだけを送信するhttpサーバーから、一般的なhttpサーバーに拡張しました。  
JavascriptやCSSを読み込むことができますので、今後の変更が楽になるかと思います。

HTMLにリセットCSSを導入しました。
(modern-css-reset)[https://github.com/andy-piccalilli/modern-css-reset]

## 0.8.4

フォルダーではなくテキストファイルを単独で開いたときに、機能拡張が動作しなくなってしまう問題を修正しました。
relolving: [textファイルを単独で開いたときにcommand not foundが出る](https://github.com/ttrace/vscode-language-japanese-novel/issues/22)

なお、テキストファイルを単独で開いた場合、原稿のコンパイルなどのコマンドは実行できません。

## 0.8.3

特定フォルダーの文字数をカウントできるようになりました。  
画面左のエクスプローラーでフォルダーを選択して［文字数カウント開始］を実行してください。  
長い小説の一部分や連載の文字数を計算する時に便利に使えるようになったと思います（必須でした！）

## 0.8.2

少数のフォントサイズが正しく設定できなかったバグを修正しています。  
おすすめの設定は、フォントサイズ2.5vhで40文字ですよ。

縦書きプレビューの更新時間を1.5秒よりも遅くならないように修正しました。  
長いテキストの場合にはもたつくかもしれませんが、後のバージョンでなんとかします。

## 0.8.1

ステータスバーでアクティブなドキュメントの文字数、プロジェクト全体の文字数を表示できるようになりました。  
プロジェクト全体の文字数は、ファイルを保存したタイミングで更新します。

なお、MITライセンスで公開されている8amjp/vsce-charactercountの成果を使わせていただいています。
[8amjp/vsce-charactercount](https://github.com/8amjp/vsce-charactercount)

## 0.8.0

テキストファイルの結合が可能になりました。
VS Codeで開いているフォルダー直下のテキストファイルを結合し、publishフォルダーの中に、フォルダー名のファイルを作ります。

VS Codeで開いているフォルダーの中に「原稿」あるいは「Draft」フォルダーがある場合には、そのフォルダーの中のテキストのみ結合します。

テキストを含むフォルダーが結合される時に、区切り文字を挿入できます。現在のバージョンは3文字落とした「＊」を挿入します。

## 0.7.6

[Masayoshi Takahashi](https://github.com/takahashim)さんの貢献によって、eslintを導入し、スクリプトの型安全性を見直しています。また、[Masayoshi Takahashi]さんには、 MITライセンスの記載方法も修正していただきました。

- [Define FontSize type as Template Literal Types](https://github.com/ttrace/vscode-language-japanese-novel/pull/4)
- [add eslint](https://github.com/ttrace/vscode-language-japanese-novel/pull/6)

プレビューのレスポンスを若干早めています。

## 0.7.5

0.7.4 で動作しなくなっていた縦書きのプレビューのバグを修正しました。

## 0.7.2

単独で開いたファイルも縦書きできるようになりました。

## 0.7.1

パッケージ依存の修正。utf-8-validateを入れ忘れていました。

## 0.7.0

このバージョンから、プレビューにnode httpサーバーを使い、テキストをwebsocketsで書き出すことにしました。  
今まではVisual Studio CodeのWebViewに直接HTMLを書き出していましたが、サーバーにしてプロセスを切り離すことで、以下のメリットが得られます。  

- テキストエディタのレスポンスを低下させずに、長いテキストをプレビューできる
- 他のコンピューターや、モバイルデバイスのブラウザーからプレビューを参照することができる
- 締め切りタイマーや進捗グラフなど、今後予定している機能追加が楽になる（jqueryを使い始めました）

また、サーバーだけ起動する\[Novel:プレビューサーバー起動\]メニューも追加しました。実行すると、縦書き表示に使っているlocalhost:8080で縦書きのプレビューサーバーが起動します。LANの他のコンピューターからも参照できますので、スマートフォンやタブレットなどをビュワーとしてお使いください。

また、このバージョンからエクステンションのスクリプトをjavascriptからtypescriptに変更しています。

## 0.6.9

プレビューのスクロール位置が追従しないバグの修正。

## 0.6.8

出力するPDFも、画面プレビュー時の行あたり字数を用いるように変更しました。

bug-fix:
ユーザー設定の正規表現検索置換の初期設定を修正。

## 0.6.4

青空文庫の字下げ注記に、簡易に対応しました。以下のように書くと縦書きのプレビューとPDF出力で3文字まで字下げすることが可能です。

```
［＃ここから３文字下げ］
字下げしたい段落。
［＃ここで字下げ終わり］
```

## 0.6.3

正規表現の検索置換ができなくなっていたのを修正。設定画面の例も修正。

## 0.6.1

会話の中に、サポートする括弧で囲まれた文があったとき、ハイライトするように修正。

HTML形式のコメントを、言語"novel"の blockcomment として定義した。コメントは、縦書きのプレビュー時に吹き出しで表示し、PDFを書き出す時には無視される。
