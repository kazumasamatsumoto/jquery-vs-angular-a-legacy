# パターン A: jQuery プラグインを Angular に組み込む(比較ラボ)

SAP Commerce の Accelerator(JSP のストアフロント)で使われてきた jQuery プラグインを、同じ版のまま Angular 21 の SSR アプリに組み込むと何が起きるかを、**同じ操作をして数字で確かめる**ためのアプリです。

Composable Storefront(Spartacus)へ移行するとき、今の jQuery プラグインの扱い方は 2 つ考えられます。

- **パターン A(このリポジトリ)**: 今のライブラリを残し、Angular の中でも使う
- **パターン B**: Angular 用に選び直す(標準部品への置き換えを含む) → [jquery-vs-angular-b-recommended](https://github.com/kazumasamatsumoto/jquery-vs-angular-b-recommended)

このリポジトリには、パターン A の書き方を 2 つ入れています。

| ページ | 書き方 | ファイル |
|---|---|---|
| `/legacy-naive` | **無理やり**。`ngAfterViewInit` で `$(...)` を呼ぶだけ。後始末なし。タブのリンクは JSP と同じ `#tab-desc` | `src/app/pages/legacy-naive.ts` |
| `/legacy-wrapped` | **条件どおりに包む**。ブラウザでだけ初期化し、Angular の外で動かし、画面を離れるときに破棄し、データが変わるときは付け直す | `src/app/pages/legacy-wrapped.ts` |

比べる機能は 6 つで、パターン B と同じです: カルーセル(owl.carousel 1.3.3)、ポップアップ(jquery.colorbox 1.5.14)、画像の拡大(jquery.zoom 1.7.13)、タブ(jQuery UI 1.12.1 tabs)、処理中の画面ロック(jquery.blockUI 2.66)、日付の入力(jQuery UI 1.12.1 datepicker)。jQuery は 3.5.1 です。

## 動かし方

前提: Node.js 22 以上。比較スクリプトを使うときは Google Chrome(手元の Chrome を使い、ブラウザを別にダウンロードしません)。

```bash
git clone https://github.com/kazumasamatsumoto/jquery-vs-angular-a-legacy.git
cd jquery-vs-angular-a-legacy
npm install
npm run build
npm run serve:ssr      # http://localhost:4000 (PORT で変更可)
```

画面の右下の**診断パネル**に、window のリスナー数、アプリの外に残ったプラグインの部品、変更検知の回数、XSS が動いたか、が 1 秒ごとに出ます。

### パターン B と並べて比べる

2 つのリポジトリを**同じフォルダに並べて**クローンし、両方をビルドしてから `npm run compare` を実行します。

```bash
git clone https://github.com/kazumasamatsumoto/jquery-vs-angular-a-legacy.git
git clone https://github.com/kazumasamatsumoto/jquery-vs-angular-b-recommended.git
(cd jquery-vs-angular-b-recommended && npm install && npm run build)
cd jquery-vs-angular-a-legacy && npm install && npm run build
npm run compare        # results/RESULTS.md と results/*.png ができる
```

B を別の場所に置いたときは `B_DIR=/path/to/jquery-vs-angular-b-recommended npm run compare`。B が見つからなければ、A の 2 版だけを比べます。

## 結果(2026-11-20、macOS の headless Chrome で 1 回測定)

全体は [results/RESULTS.md](results/RESULTS.md)、画像は `results/*.png` にあります。

| 観点 | A: 無理やり | A: 包む | B: 選び直す |
|---|---|---|---|
| 直接開いたときのサーバー(SSR) | 200 を返すが、**開くたびにサーバーのログに `ReferenceError: $ is not defined`** | エラーなし | エラーなし |
| JS が動く前(SSR の HTML と CSS だけ)に見える商品 | 0 / 6 | 0 / 6 | 6 / 6 |
| 画面のずれ CLS(0.1 以下が目安) | 0.149 | 0.149 | 0.017 |
| 「商品を入れ替える」 | **カルーセルが古い商品のまま**。Angular が `NotFoundError: insertBefore` で止まる | 正しく変わる | 正しく変わる |
| タブ | 開いた瞬間に**このページ全体を Ajax で読み込み、タブの中に入れ子で表示**。jQuery と全プラグインも読み直す | 正しく動く | 正しく動く |
| CMS の文言に混ぜた HTML(XSS) | **動いた** | **動いた** | 動かない |
| 何もしないときの変更検知 / 秒 | 6.0 | 1.0 | 1.0 |
| トップと 5 往復したあとの、アプリの外に残った部品 | 2 → 13(1 往復ごとに +2) | 1(増えない) | 0(増えない) |
| トップと 5 往復したあとの DOM の要素数 | 88 → 226(1 往復ごとに +23) | 88(増えない) | 68(増えない) |
| 開いたときに読み込んだ JS(展開後) | 1,100 KB | 708 KB | 320 KB |

### なぜそうなるか

- **SSR のエラー**: サーバーには `window` も jQuery も無いので、`ngAfterViewInit` の `$` で止まります。Angular 標準の SSR は、描画中にエラーがあっても崩れた HTML を 200 で返します。SAP の Composable Storefront の文書もこの挙動を説明し、2211.29 以降に作ったアプリでは SSR のエラー処理が既定で有効で、エラーをサーバーに伝えて 500 などの適切なステータスを返す、としています(Composable Storefront Development Guide の「Server-Side Rendering Error Handling」)。**本物の Composable Storefront なら、「無理やり」版は 500 エラーのページになる**と考えられます。このラボは素の Angular なので 200 のままです。
- **JS が動く前に商品が見えない、画面がずれる**: owl.carousel の CSS は、初期化が終わるまでカルーセルを `display: none` にします。SSR で HTML を作っても、JS が動くまで商品が出ず、出た瞬間に下の部品が押し下げられます。包んでも直りません。
- **入れ替えで古い商品が残る**: owl は、Angular が作った商品の要素を自分の枠(`.owl-wrapper`)に移します。Angular は「元の場所」を前提に新しい要素を差し込もうとして失敗します。包んだ版は、入れ替えの前に owl を外して要素を元に戻し、描き直した後に付け直しているので動きます(その分のコードが要ります)。
- **タブにページが入れ子になる**: Angular のアプリには `<base href="/">` があります。jQuery UI のタブは、リンク(`#tab-desc`)を絶対 URL にして今の URL と比べ、違えば「別ページのタブ」として Ajax で読み込みます。読み込んだ HTML の中の `<script>` も jQuery が実行するので、jQuery と全プラグインがもう一度読み込まれ、`window.jQuery` が新しいものに置き換わります。往復のたびに部品と要素が増えるのは主にこのためです。包んだ版は、リンクに今のパスを付けて回避しています。
- **XSS**: jQuery UI 1.12.1 の datepicker は `closeText` を HTML として埋め込みます(CVE-2021-41183)。包んでもライブラリの不具合は直りません。Angular の `{{ }}` は文字として出すので、パターン B では動きません。このラボの再現は、目印の属性を付けるだけの無害なものです。
- **変更検知**: 「無理やり」版は、プラグインのタイマーやイベントが Angular の中で動くので、何もしなくても変更検知が走り続けます。包んだ版は `runOutsideAngular` で外に出しています。
- **JS の大きさ**: パターン A は、jQuery と全プラグインを `angular.json` の `scripts` で**全ページ**に読み込みます(403 KB)。ビルドの Initial total はパターン A が 752 KB、パターン B が 314 KB です。

### 読み方

- 「包む」版はほとんどの症状を避けられますが、**画面のずれ、XSS、JS の大きさは残ります**。そのうえ、避けるための後始末のコードを部品ごとに書いて保守し続けることになります(`legacy-wrapped.ts` を見てください)。
- 結論は「**パターン B が基本。パターン A は標準に代わりが無い部品に限り、条件どおりに包む**」です。

## メリットとデメリット(2026-11-20 に手元で動かして確かめたもの)

ページのコード量: A 無理やり 66 行 / A 包む 139 行 / B 108 行 + 部品 225 行。

### パターン A: 今のライブラリを残して Angular で使う

**メリット**

- 見た目と動きが今の画面と同じになる。owl や colorbox の設定値、CSS、画像をそのまま持ってこられる
- 最初に書く量が少ない。「無理やり」版は 66 行で 6 つの機能が全部動く
- 画面ごとに今と同じ動きかを比べる確認が楽になる
- 「包む」書き方を守れば、入れ替え・入れ子・残る部品・変更検知の問題は避けられる

**デメリット**

- **包んでも直らないものが 3 つ残る**
  - 画面のずれ(CLS 0.149): owl の CSS が、準備ができるまでカルーセルを隠すため
  - XSS: jQuery UI 1.12.1 の不具合(CVE-2021-41183)
  - JS の重さ: jQuery と全プラグインを全ページで読み込む(開いたときに 708 KB、B は 320 KB)
- 無理やり組み込むと、目に見えて壊れる: 入れ替えで止まる、タブにページが入れ子になる、往復するたびに部品が増える(2 → 13)。サーバーのエラーは、本物の Composable Storefront なら 500 エラーの画面になる見込み
- 包む場合は、後始末のコードを部品ごとに書き続けることになる(139 行の半分以上が後始末)。ここまで書くと、コード量は B とあまり変わらない
- 古いライブラリを持ち続けることになる。直す人がいないので、脆弱性が見つかっても自分たちで対処するしかない

### パターン B: Angular 用に選び直す

**メリット**

- 測ったすべての観点で問題が無い: JS が動く前から商品が見える(6 / 6)、画面のずれ 0.017、XSS が動かない、残る部品 0
- 開いたときに読む JS が約 3 分の 1(320 KB)
- Composable Storefront の標準部品(`cx-carousel` など)と同じ作りなので、標準の版上げにそのまま付いていける
- 後始末を Angular が自動でやってくれるので、書き忘れの事故が起きにくい

**デメリット**

- 作り直しの手間がかかる(部品だけで 225 行。標準部品を使う場合でも、スタイルを合わせる作業が要る)
- 見た目と動きが今とまったく同じにはならない。たとえば日付の入力はブラウザ標準の部品になり、カレンダーの見た目がブラウザによって変わる。業務側と画面の確認が要る
- 標準に代わりが無い部品は、自分たちで作るか、別のライブラリを探して選ぶことになる

### どう選ぶか

基本は B。A を使うのは、標準に代わりが無く、作り直すのが重い部品に限る。その場合も「無理やり」ではなく、必ず「包む」書き方にする。それでも画面のずれ、XSS、JS の重さは残るので、そのことを承知したうえで決める。

## このラボの限界

- **本物の Composable Storefront(Spartacus)ではありません**。2211 系のライブラリは SAP の非公開レジストリにあるため入れていません。パターン B の部品は、標準部品の作りを真似た小さな版です。
- jQuery プラグインは、同じ名前・同じ版の公開ファイルです(出所は [vendor/legacy/README.md](vendor/legacy/README.md))。実際のプロジェクトでファイルに手が入っていれば、挙動は変わり得ます。
- データは固定の JSON(`src/app/data/products.ts`)で、バックエンド(OCC)は呼びません。
- 数字は 1 回測ったものです。CLS や変更検知の回数は、環境によって多少振れます。

## ファイルの地図

```text
src/app/pages/legacy-page.html       2 版が共有するテンプレート(JSP の画面の代わり)
src/app/pages/legacy-naive.ts        無理やり
src/app/pages/legacy-wrapped.ts      条件どおりに包む
src/app/shared/instrument.ts         診断の計測(リスナー、タイマー、残った部品、変更検知)
src/app/shared/diagnostics-panel.ts  右下の診断パネル
src/app/app.routes.server.ts         全ページをリクエストのたびにサーバーで描く設定
scripts/compare.mjs                  比較スクリプト(Playwright で手元の Chrome を操作)
vendor/legacy/                       持ち込んだ jQuery プラグイン(出所の台帳つき)
results/                             比較の結果と画像
```

## ライセンス

`vendor/legacy/` のファイルは、それぞれの作者のライセンス(MIT など。各ファイルの先頭のコメントを参照)に従います。
