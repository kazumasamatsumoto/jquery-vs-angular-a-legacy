import { AfterViewInit, Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CMS_TEXT, PRODUCTS_A, PRODUCTS_B } from '../data/products';

/**
 * パターン A「無理やり」版。現場でよく見る書き方をそのまま再現している。
 *
 * - jQuery とプラグインは angular.json の scripts で全ページに読み込む
 * - `declare const $` で型チェックを黙らせ、ngAfterViewInit でプラグインを初期化する
 * - 後始末(ngOnDestroy)は書かない
 * - タブのリンクは JSP のときと同じ `#tab-desc`
 *
 * 起きること(README の表を参照)
 * - サーバー(SSR)には $ が無いので、このページを直接開くと描画に失敗する
 * - 「商品を入れ替える」を押しても、カルーセルは古い商品のまま(owl が要素を自分の箱に移したため)
 * - ほかのページへ移って戻るたびに、window のハンドラと body 直下の部品が増える
 * - `<base href="/">` のせいで、jQuery UI のタブが「別ページのタブ」と判定し、トップページを Ajax で読み込む
 * - CMS の文言に混ざった HTML が datepicker で実行される(CVE-2021-41183)
 */
declare const $: any;

@Component({
  selector: 'app-legacy-naive',
  templateUrl: './legacy-page.html',
  styleUrl: './legacy-page.scss',
})
export class LegacyNaivePage implements AfterViewInit {
  readonly title = 'パターン A: 無理やり組み込んだ版';
  readonly lead = 'jQuery プラグインを ngAfterViewInit でそのまま呼び出し、後始末をしない書き方です。';

  readonly products = signal(PRODUCTS_A);
  readonly setLabel = signal('A(カメラ用品)');
  readonly cartCount = signal(0);

  @ViewChild('carousel') carousel!: ElementRef<HTMLElement>;
  @ViewChild('zoom') zoom!: ElementRef<HTMLElement>;
  @ViewChild('tabs') tabs!: ElementRef<HTMLElement>;
  @ViewChild('date') date!: ElementRef<HTMLInputElement>;

  /** JSP のときと同じ書き方。 */
  tabHref(id: string): string {
    return `#${id}`;
  }

  ngAfterViewInit(): void {
    // サーバーではここで ReferenceError: $ is not defined になる
    $(this.carousel.nativeElement).owlCarousel({ items: 4 });
    $('a.gallery').colorbox({ rel: 'gallery', photo: true, maxWidth: '90%', maxHeight: '90%' });
    $(this.zoom.nativeElement).zoom({ url: this.products()[0].image });
    $(this.tabs.nativeElement).tabs();
    $(this.date.nativeElement).datepicker({ showButtonPanel: true, closeText: CMS_TEXT.datepickerClose });
  }

  swap(): void {
    const toB = this.products() === PRODUCTS_A;
    this.products.set(toB ? PRODUCTS_B : PRODUCTS_A);
    this.setLabel.set(toB ? 'B(音響用品)' : 'A(カメラ用品)');
  }

  addToCart(): void {
    $.blockUI({ message: '<p>処理中…</p>' });
    setTimeout(() => {
      $.unblockUI();
      this.cartCount.update((n) => n + 1);
    }, 2000);
  }
}
