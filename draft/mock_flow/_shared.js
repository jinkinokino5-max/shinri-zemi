/* ══════════════════════════════════════════════════════════════════
   トップページ「流れる」案 02/03/05/08  共通スクリプト

   役割は3つだけ。
     ① 21件の活動データを持つ（本番の lib/content.ts に相当）
     ② 題字SVGの定義を1回だけ差し込む
     ③ 4案を行き来する案内バーを差し込む（⚠ モック閲覧用。本番には入らない）

   ⚠ 本番（Next.js）にこのファイルは移植しない。
     データは content/*.md、題字は components/Logomark.tsx、
     ナビは components/SiteNav.tsx がそれぞれ担う。
   ══════════════════════════════════════════════════════════════════ */

/* ── ① 活動データ ────────────────────────────────────────
   出所：output/website/content/{clubs,projects,events}/*.md（2026-08-11 時点）
   ⚠ 名前・状態は実ファイルの写し。ここで creating／改変しない。
   ⚠ photo は「写真が実在するか」ではなく、モック上で写真枠を出すかの指定。
     現在 public/photos/ は0枚なので、実際にはすべて false が正しい。
     ただし全部 false にすると「写真が入った後」が判断できないため、
     一部を true にして両方の見え方が同時に分かるようにしてある。
     ⚠ true の枠に出ているのは CSS で描いた仮の絵であり、実写ではない。
   ────────────────────────────────────────────────── */
const ACTIVITIES = [
  // slug,               名前,               種別,     状態,   写真枠, 仮絵の色
  ['tofu-game',        '豆腐ゲームPJ',       'PJ',    'active', true,  ''],
  ['kotobamoteaso',    '言葉もてあそ部',     'CLUB',  'active', false, ''],
  ['rakugaki-bon',     '落書き本PJ',         'PJ',    'active', true,  'ph--b'],
  ['suisan',           '水産学ゼミ',         'CLUB',  'active', false, ''],
  ['tetsugaku-cafe',   '哲学カフェPJ',       'PJ',    'active', true,  'ph--c'],
  ['nonal',            'ノンアルカクテル部', 'CLUB',  'active', false, ''],
  ['shi-typing',       '詩タイピングPJ',     'PJ',    'active', true,  'ph--d'],
  ['kenkyushitsu',     '研究室訪問部',       'CLUB',  'active', false, ''],
  ['card-game',        'カードゲームPJ',     'PJ',    'active', true,  'ph--e'],
  ['ryori',            '料理部',             'CLUB',  'active', true,  'ph--f'],
  ['sukoyaka',         'すこやか部',         'CLUB',  'active', false, ''],
  ['flat',             'ふらっと部',         'CLUB',  'active', false, ''],
  ['dokusho',          '読書部',             'CLUB',  'active', true,  'ph--b'],
  ['radio',            'ラジオ部',           'CLUB',  'done',   false, ''],
  ['shinri-share',     '心理シェア部',       'CLUB',  'done',   false, ''],
  ['jikken-saigen',    '実験再現PJ',         'PJ',    'done',   true,  'ph--c'],
  ['kaimin',           '快眠お届けPJ',       'PJ',    'done',   false, ''],
  ['meiso',            '瞑想習慣化PJ',       'PJ',    'done',   false, ''],
  ['talk-ryoku',       'トーク力向上PJ',     'PJ',    'done',   false, ''],
  ['undo',             '運動PJ',             'PJ',    'done',   false, ''],
  ['doto',             '道東合宿',           'EVENT', 'active', false, ''],
].map(([slug, name, kind, status, photo, tone]) => ({ slug, name, kind, status, photo, tone }));

/** 種別と状態を文字で示す。⚠ 状態を色だけで伝えない。 */
function metaOf(a) {
  if (a.kind === 'EVENT') return 'EVENT / 2026.09.04';
  const ja = a.kind === 'CLUB'
    ? (a.status === 'done' ? '終了' : '活動中')
    : (a.status === 'done' ? '終了' : '進行中');
  return `${a.kind === 'CLUB' ? 'CLUB' : 'PROJECT'} / ${ja}`;
}

/** 写真枠（実写が無いものは「写真なし」の枠に落ちる） */
function photoOf(a) {
  return a.photo
    ? `<div class="ph ${a.tone}"><span class="ph__cap">仮</span></div>`
    : `<div class="ph ph--none"><span class="ph__cap">写真なし</span></div>`;
}

/**
 * 帯の中身を「本体＋複製」の2組で返す。
 * ⚠ 複製は継ぎ目を消すためだけの実装。必ず aria-hidden を付ける。
 *   付け忘れると読み上げが同じ内容を2周する。
 */
function twoSets(html) {
  return `<div class="flow__set">${html}</div>` +
         `<div class="flow__set" aria-hidden="true">${html.replace(/href="[^"]*"/g, 'tabindex="-1"')}</div>`;
}

/* ── ② 題字「北大心理ゼミ」──────────────────────────────
   書体：キルゴU（KanaNA）／作者：残雪・GN's Side
        (C)2014-2015 Getsuren/Nagoriyuki ／ http://getsuren.com/

   ⚠ フォントファイルは同梱も配信もしない。同梱 readme.txt が
     「フォントファイル自体の無許可の再配布・改変」を禁じる一方、
     「アウトラインデータ化してからなどの改変は自由」と明示している。
     よって6字をアウトライン化したSVGパスとして持つ。
   ⚠ 公開時、作者へ一報を入れること（gn@getsuren.com ／ X: @snowy_tgn）。
   ⚠ 表示高さは 32px 相当以上を確保する（24px未満で「理」が潰れる）。
   ────────────────────────────────────────────────── */
const LOGOMARK_PATH =
  'M780 -82 789 -328 1019 -307 991 135 505 127V-876H760L757 -688L973 -753L1023 -477L755 -428V-84ZM225 -876H482L483 134H224L228 -18L72 41L6 -219L228 -298V-444L13 -440V-695L228 -691Z M1027 -462V-718L1392 -714L1388 -878H1664L1660 -714L2025 -718V-462L1714 -466L2038 -24L1817 150L1526 -284L1235 150L1014 -24L1338 -466Z M2279 -654 2325 -876 2830 -796 2777 -549ZM2033 -11 2088 -507 2271 -494V-593L2517 -585V-93H2660L2669 -257L2799 -241L2784 -492L3004 -512L3047 -11L2875 16L2856 128H2268L2269 -203L2246 45Z M3583 -642H3602V-662H3584ZM3365 -582H3330V-515L3365 -516ZM3603 -482V-503H3583L3584 -482ZM3802 -482H3821V-503H3802ZM3406 -86V-67L3581 -66V-89ZM3092 -191V-284L3049 -281V-519L3093 -516V-583H3045V-818H3366V-861H4045V-298H3826V-275L4047 -279V-85L3826 -89V-66H4061V131L3316 130L3315 18L3055 67L3041 -186ZM3330 -214 3365 -218V-280L3581 -276V-299H3365V-280L3330 -284ZM3803 -641H3822V-661H3803Z M4222 72 4208 -391 4100 -386 4079 -658 4187 -660 4177 -808 4486 -801 4481 -681 4680 -685Q4683 -636 4723 -608Q4755 -586 4807 -588Q4855 -595 4883 -632Q4918 -612 4947 -620L4885 -248L4591 -319L4613 -420L4492 -416L4506 -198L4793 -213L4906 28ZM4773 -618Q4745 -625 4724 -650Q4703 -682 4711 -726Q4718 -753 4745 -772Q4778 -794 4824 -777Q4797 -708 4860 -652Q4819 -605 4773 -618ZM4848 -731Q4843 -765 4864 -793Q4884 -821 4918 -827Q4953 -832 4981 -812Q5009 -791 5014 -757Q5020 -722 5000 -694Q4979 -666 4944 -661Q4910 -655 4882 -676Q4854 -696 4848 -731Z M5059 12 5055 -240 5659 -208 5643 44ZM5531 -271 5167 -283 5161 -492 5531 -483ZM5083 -564 5075 -788 5607 -756 5595 -529Z';

/* ── 共通の下半分 ────────────────────────────────────────
   告知帯 → Vision → 数字 → Value → フッター。
   4案で完全に同一なので、ここに1つだけ置く。
   ⚠ 各HTMLに残すのは「案ごとに違う部分（ナビとヒーロー）」だけ。
     そうしないと4案を並べたとき、どこが違うのか分からなくなる。

   ⚠ 数字はすべて実データ。
     部活 活動中8／終了2、PJ 進行中5／終了5（content/*.md の実数）
     設立 2022.04、メンバー 56名（reference/学生団体基本情報.txt ／ 2026-08-10 時点）
     年間の企画数は増え続けるため確定不能 → 「––」のまま。推測で埋めない。
   ────────────────────────────────────────────────── */
function commonBelow() {
  return `
  <!-- ══ 告知帯：サイト上で唯一「期限のある情報」══
       ⚠ 朱の面には必ず墨の文字（4.78 AA）。白は 4.04 で不足する。
       ⚠ 朱を使う場所は1画面に1箇所まで。増やすと効果が半減する。 -->
  <section class="section" style="padding-block:var(--sp-12)">
    <div class="wrap">
      <a class="notice" href="#">
        <span class="notice__label">Next event</span>
        <span class="notice__name">道東合宿</span>
        <span class="notice__date">2026.09.04 – 09.06</span>
      </a>
    </div>
  </section>

  <!-- ══ Vision ══ ⚠ 原文どおり。句読点の追加・語尾の変更・要約はしない。 -->
  <section class="section" style="padding-block:var(--sp-8)">
    <div class="wrap">
      <p class="label">Vision</p>
      <h2 class="mvv mvv--md" style="margin-top:var(--sp-2)">北大で最も大量におもろいことが生まれる場所になる</h2>
    </div>
  </section>

  <!-- ══ 数字 ══ ⚠ 未確定は「––」のまま。推測で埋めない（CLAUDE.md 3-4）。 -->
  <section style="padding-block:var(--sp-8)">
    <div class="wrap">
      <dl class="figures">
        <div class="fig"><dt>Established</dt><dd class="num">2022.04</dd></div>
        <div class="fig"><dt>Members</dt><dd class="num">56<small>名</small></dd></div>
        <div class="fig"><dt>Club / Active</dt><dd class="num">8<small>（終了 2）</small></dd></div>
        <div class="fig"><dt>Project / Active</dt><dd class="num">5<small>（終了 5）</small></dd></div>
        <div class="fig"><dt>Events / Year</dt><dd class="is-unknown">––</dd></div>
      </dl>
    </div>
  </section>

  <!-- ══ Value ══ ⚠ 2つとも原文どおり。 -->
  <section class="sheet" style="margin-top:var(--sp-8)">
    <div class="wrap">
      <p class="label">Value</p>
      <p class="mvv mvv--md" style="margin-top:var(--sp-2)">誰を幸せにできるのかを問い続ける</p>
      <p class="mvv mvv--md" style="margin-top:var(--sp-2)">過去から学ぶことを忘れない</p>
    </div>
  </section>

  <footer class="foot">
    <div class="wrap">
      <svg class="logomark foot__logo" aria-hidden="true"><use href="#logomark"/></svg>
      <span class="vh">北大心理ゼミ</span>
      <div class="foot__grid">
        <div>
          <p class="label">Contact</p>
          <p><a href="mailto:hokkaido.u.psychology@gmail.com">hokkaido.u.psychology@gmail.com</a></p>
        </div>
        <div>
          <p class="label">Social</p>
          <p><a href="https://www.instagram.com/tan1_is_rational/">Instagram</a></p>
          <p><a href="https://x.com/hokudaishinri">X</a></p>
        </div>
      </div>
      <!-- ⚠ 削除・弱化してはならない。文面は 2026-08-10 に団体が確定したもの。 -->
      <p class="foot__note">北大心理ゼミは、北海道大学の公認サークルではありません。</p>
    </div>
  </footer>`;
}

/** 共通ナビ。⚠ ブランド名にキルゴUを使わない（16pxで潰れる）。 */
function commonNav() {
  return `
  <nav class="nav">
    <a class="nav__brand" href="#"><b>北大心理ゼミ</b><span>HOKUDAI SHINRI ZEMI</span></a>
    <ul class="nav__list">
      <li><a class="nav__link" href="#"><span class="nav__ja">作品集</span><span class="nav__en">Works</span></a></li>
      <li><a class="nav__link" href="#"><span class="nav__ja">イベント</span><span class="nav__en">Event</span></a></li>
      <li><a class="nav__link" href="#"><span class="nav__ja">部活</span><span class="nav__en">Club</span></a></li>
      <li><a class="nav__link" href="#"><span class="nav__ja">PJ</span><span class="nav__en">Project</span></a></li>
      <li><a class="nav__link" href="#"><span class="nav__ja">団体紹介</span><span class="nav__en">About</span></a></li>
    </ul>
  </nav>`;
}

document.addEventListener('DOMContentLoaded', () => {
  /* 題字の定義。ページ先頭で1回だけ。 */
  const defs = document.createElement('div');
  defs.innerHTML =
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true">` +
    `<symbol id="logomark" viewBox="6 -878 5652 1028"><path d="${LOGOMARK_PATH}"/></symbol>` +
    `</svg>`;
  document.body.prepend(defs.firstChild);

  /* 共通のナビと下半分を差し込む。各HTMLは目印の要素だけを置いている。 */
  const navSlot = document.querySelector('[data-slot="nav"]');
  if (navSlot) navSlot.outerHTML = commonNav();
  const belowSlot = document.querySelector('[data-slot="below"]');
  if (belowSlot) belowSlot.outerHTML = commonBelow();

  /* ── ③ 案内バー（⚠ モック閲覧用。本番には入らない）── */
  const CASES = [
    ['02×04', '題字の背景＋写真の帯', '02x04_title_flow.html'],
    ['02',    '写真の帯',             '02_photo_belt.html'],
    ['03',    '写真と名前が交互',     '03_mixed_belt.html'],
    ['05',    '縦2列が上下逆',        '05_vertical_columns.html'],
    ['08',    '大判が入れ替わる',     '08_crossfade.html'],
  ];
  const bar = document.querySelector('.mockbar');
  if (!bar) return;
  const here = location.pathname.split('/').pop();
  const nav = document.createElement('p');
  nav.className = 'mockbar__nav';
  nav.innerHTML =
    CASES.map(([no, name, file]) =>
      `<a href="${file}"${file === here ? ' aria-current="page"' : ''}>${no} ${name}</a>`
    ).join('') + `<a href="index.html">一覧にもどる</a>`;
  bar.append(nav);
});
