# 持ち込んだ jQuery プラグインの台帳

Accelerator の `_ui-src/responsive/lib/common` と同じく、npm からではなくファイルを直接置いています。
Accelerator のプロジェクトで使われてきた版と同じものを、cdnjs(と colorbox の画像・CSS は作者の GitHub)から 2026-11-20 に取得しました。
特定のプロジェクトのファイルではなく、同じ名前・同じ版の公開ファイルです。

| ファイル | 版 | 取得元 | SHA-256 |
|---|---|---|---|
| jquery.js | 3.5.1 | cdnjs `jquery/3.5.1/jquery.js` | 416a3b2c3bf16d64f6b5b6d0f7b079df2267614dd6847fc2f3271b4409233c37 |
| jquery-ui/jquery-ui.js | 1.12.1 | cdnjs `jqueryui/1.12.1/jquery-ui.js`(CSS と画像は `themes/base`) | 4f455eb2ddf2094ee969f470f6bfac7adb4c057e8990a374e9da819e943c777d |
| owl/owl.carousel.js | 1.3.3 | cdnjs `owl-carousel/1.3.3/`(CSS・画像も同じ場所) | 9221608a4df26c3a67d553a85ea42269235ca69d2ff47419148853830d5cea2d |
| colorbox/jquery.colorbox.js | 1.5.14 | cdnjs `jquery.colorbox/1.5.14/`(CSS と画像は github.com/jackmoore/colorbox の 1.5.14 タグ `example1`) | 6977bc04a945a29b3e5b49c659a11aa8b912a21186b99eb095aee1fa3bebe326 |
| jquery.zoom.js | 1.7.13 | cdnjs `jquery-zoom/1.7.13/` | 227d7d2e55b9e7b968cbe2632c659fac48aa3d2b02af6895744b3785d42cf6dc |
| jquery.blockUI.js | 2.66.0-2013.10.09 | cdnjs `jquery.blockUI/2.66.0-2013.10.09/` | ab866744f40607d863d7abd43c5986c0ea7825b5ba599e95b5d02556b6a68b63 |

`jquery.tabs`(npm に名前が無く、どのプラグインか特定できない)は、jQuery UI 1.12.1 の tabs で代用しています。

既知の脆弱性: jQuery UI 1.12.1 に XSS が 4 件(CVE-2021-41182 / 41183 / 41184、CVE-2022-31160)。このラボの「日付の入力」は CVE-2021-41183(datepicker の `*Text` オプション)を、目印の属性を付けるだけの無害な形で再現しています。
