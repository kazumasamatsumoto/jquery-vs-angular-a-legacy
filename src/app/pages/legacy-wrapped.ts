import {
  Component,
  ElementRef,
  Injector,
  NgZone,
  OnDestroy,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CMS_TEXT, PRODUCTS_A, PRODUCTS_B } from '../data/products';

/**
 * パターン A「条件どおりに包んだ」版。README の「条件どおりに包む」の条件を守っている。
 *
 * 1. 初期化はブラウザでだけ(afterNextRender はサーバーでは呼ばれない)
 * 2. jQuery が触る要素は、このページの中の要素だけ
 * 3. ngOnDestroy でプラグインを全部破棄する(body 直下に足された部品も消す)
 * 4. プラグインのタイマーやイベントで変更検知が走らないよう、Angular の外(runOutsideAngular)で動かす
 * 5. データが変わるときは、Angular が描き直す前に owl を外し、描き直した後に付け直す
 * 6. タブのリンクは今のパスを付けて書く(`<base href>` 対策)
 *
 * それでも残ること
 * - owl の CSS は初期化まで .owl-carousel を display:none にするので、SSR の HTML では商品が見えず、JS が動いた瞬間に画面がずれる
 * - jQuery と全プラグインは angular.json の scripts で全ページに読み込まれる(推奨版のページでも)
 * - datepicker の XSS(CVE-2021-41183)は、包んでも直らない。ライブラリ自体の不具合だから
 * - 包むためのコード(このファイル)を、部品が増えるたびに書いて保守する
 */
@Component({
  selector: 'app-legacy-wrapped',
  templateUrl: './legacy-page.html',
  styleUrl: './legacy-page.scss',
})
export class LegacyWrappedPage implements OnDestroy {
  readonly title = 'パターン A: 条件どおりに包んだ版';
  readonly lead = 'ブラウザでだけ初期化し、Angular の外で動かし、画面を離れるときに全部破棄する書き方です。';

  readonly products = signal(PRODUCTS_A);
  readonly setLabel = signal('A(カメラ用品)');
  readonly cartCount = signal(0);

  @ViewChild('carousel') carousel!: ElementRef<HTMLElement>;
  @ViewChild('zoom') zoom!: ElementRef<HTMLElement>;
  @ViewChild('tabs') tabs!: ElementRef<HTMLElement>;
  @ViewChild('date') date!: ElementRef<HTMLInputElement>;
  @ViewChild('buyBox') buyBox!: ElementRef<HTMLElement>;

  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly path = '/' + inject(ActivatedRoute).snapshot.url.map((s) => s.path).join('/');
  private initialized = false;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => this.outside(() => this.initAll()));
  }

  /** `<base href="/">` があっても jQuery UI が「同じページのタブ」と判定できるよう、今のパスを付ける。 */
  tabHref(id: string): string {
    return `${this.path}#${id}`;
  }

  private get $(): any {
    return window.jQuery;
  }

  private outside(fn: () => void): void {
    this.zone.runOutsideAngular(fn);
  }

  private initAll(): void {
    const $ = this.$;
    this.initOwl();
    $(this.gallerySelector()).colorbox({ rel: 'gallery', photo: true, maxWidth: '90%', maxHeight: '90%' });
    $(this.zoom.nativeElement).zoom({ url: this.products()[0].image });
    $(this.tabs.nativeElement).tabs();
    $(this.date.nativeElement).datepicker({ showButtonPanel: true, closeText: CMS_TEXT.datepickerClose });
    this.initialized = true;
  }

  /** このページの中のリンクだけを対象にする(ほかの部品の a.gallery を巻き込まない)。 */
  private gallerySelector(): any {
    return this.$(this.carousel.nativeElement).closest('app-legacy-wrapped').find('a.gallery');
  }

  private initOwl(): void {
    this.$(this.carousel.nativeElement).owlCarousel({ items: 4 });
  }

  private destroyOwl(): void {
    const owl = this.$(this.carousel.nativeElement).data('owlCarousel');
    owl?.destroy();
  }

  swap(): void {
    const toB = this.products() === PRODUCTS_A;
    // 1) Angular が描き直す前に、owl が移した要素を元の位置に戻す
    this.outside(() => this.destroyOwl());
    this.products.set(toB ? PRODUCTS_B : PRODUCTS_A);
    this.setLabel.set(toB ? 'B(音響用品)' : 'A(カメラ用品)');
    // 2) 描き直しが終わってから付け直す。リンクと拡大画像も新しい商品に合わせる
    afterNextRender(
      () =>
        this.outside(() => {
          const $ = this.$;
          this.initOwl();
          $.colorbox.remove();
          $(this.gallerySelector()).colorbox({ rel: 'gallery', photo: true, maxWidth: '90%', maxHeight: '90%' });
          $(this.zoom.nativeElement).trigger('zoom.destroy').zoom({ url: this.products()[0].image });
        }),
      { injector: this.injector },
    );
  }

  addToCart(): void {
    // 画面全体ではなく、このページの中の要素だけをロックする(画面を離れたら一緒に消える)
    this.outside(() => this.$(this.buyBox.nativeElement).block({ message: '処理中…' }));
    this.timeoutId = setTimeout(() => {
      this.outside(() => this.$(this.buyBox.nativeElement).unblock());
      this.cartCount.update((n) => n + 1);
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (!this.initialized) return;
    this.outside(() => {
      const $ = this.$;
      this.destroyOwl();
      $.colorbox.remove();
      $(this.zoom.nativeElement).trigger('zoom.destroy');
      $(this.tabs.nativeElement).tabs('destroy');
      $(this.date.nativeElement).datepicker('destroy');
      $(this.buyBox.nativeElement).unblock();
    });
  }
}
