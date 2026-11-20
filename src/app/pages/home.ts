import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1>パターン A: jQuery プラグインを Angular に組み込む</h1>
    <p class="lead">
      SAP Commerce の Accelerator で使われてきた jQuery プラグイン(同じ版)を、Angular 21 の SSR アプリに組み込んだ 2 つの版です。
      jQuery を使わずに同じ機能を作った版(パターン B)は、別のリポジトリ <code>jquery-vs-angular-b-recommended</code> にあります。
    </p>

    <table>
      <thead><tr><th>版</th><th>書き方</th></tr></thead>
      <tbody>
        <tr><td><a routerLink="/legacy-naive" data-testid="nav-naive">A: 無理やり</a></td><td>ngAfterViewInit で $(...) を呼ぶだけ。後始末なし</td></tr>
        <tr><td><a routerLink="/legacy-wrapped" data-testid="nav-wrapped">A: 条件どおりに包む</a></td><td>ブラウザでだけ初期化、Angular の外で実行、離れるときに破棄</td></tr>
      </tbody>
    </table>

    <h2>試すこと</h2>
    <ol>
      <li>各ページを<strong>アドレス欄から直接開く</strong>(サーバーで描く SSR が通るか。サーバーのログも見る)。</li>
      <li>このページから<strong>リンクで</strong>各ページへ移る(ブラウザの中での画面遷移)。</li>
      <li>「商品を入れ替える」を押し、カルーセルの中身がデータどおりに変わるか見る。</li>
      <li>タブの「仕様」を押す。</li>
      <li>日付の入力欄を押してカレンダーを開き、右下の診断パネルの「XSS」を見る。</li>
      <li>このページと各ページを何度か行き来し、診断パネルの数字が増え続けるか見る。</li>
    </ol>
    <p>同じ操作を自動で行い、パターン B とあわせて表にするには <code>npm run compare</code> を実行します(README 参照)。</p>
  `,
  styleUrl: './page.scss',
})
export class HomePage {}
