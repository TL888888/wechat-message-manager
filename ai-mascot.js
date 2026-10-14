/*
 * AI 問答「等待中」小人物（2026-10-14 Michelle 提議）
 * ------------------------------------------------------------
 * AI 查資料要等幾秒到幾十秒，與其讓人盯著轉圈圈，不如放一個會動的小人物，旁邊小字每 2.5 秒換一句，
 * 句子依各系統的資料庫內容不同（由各頁面自己傳進來）。
 *
 *   - 'girl'：翻書的小女生（最早做在 orders.html 已接未出訂單，2026-10-13），給業務類系統用：
 *             出貨實績、已接未出訂單、行動秘書、營業商務訊息（wechat 那個 repo 有複製一份這個檔案）
 *   - 'boy' ：戴眼鏡、會推眼鏡（鏡片會反光）的工程師小男生（拿平板），給技術類系統用：
 *             服務部技術論壇、BOM、品保（文件問答 + EIP 異常問答）、市場產業資訊
 *
 * 這是一般 JavaScript（不是 JSX），所以 React 頁面和不用 React 的頁面（例如營業商務訊息）都能用：
 *   1) React 頁面：在主程式之前載入 <script src="/ai-mascot.js"></script>，然後
 *        const AiMascot = window.AiMascotReact;
 *        {loading && <AiMascot kind="boy" lines={[...]} color="#2563eb" bg="#eff6ff" text="#1e3a8a" />}
 *   2) 非 React 頁面：var stop = AiMascot.mount(某個div, { kind:'girl', lines:[...], color, bg, text });
 *        查完後呼叫 stop() 停止換句子，再把 div 換成答案即可。
 *   color = 衣服顏色、bg = 底色、text = 字的顏色（各系統配自己的主色）。
 *
 * ⚠️ 修改注意：這個檔案在 TL_technology 和 wechat-message-manager 各有一份，改一邊要記得複製到另一邊。
 * 動畫全部是手繪 SVG + CSS，沒有外部圖片。使用者若在系統設定「減少動態效果」，動畫會自動停止。
 */
(function () {
  if (window.AiMascot) return;

  var CSS = [
    /* ---- 小女生（從 orders.html 搬過來，規格跟原本一樣） ---- */
    '.rg-bob{animation:rgBob 2.4s ease-in-out infinite;transform-box:view-box;transform-origin:60px 76px}',
    '.rg-eyes{animation:rgBlink 3.6s infinite;transform-box:fill-box;transform-origin:center}',
    '.rg-book{animation:rgClose 2.4s ease-in-out infinite;transform-box:view-box;transform-origin:60px 0}',
    '.rg-cover{animation:rgCover 2.4s ease-in-out infinite}',
    '.rg-hand-l{animation:rgHandL 2.4s ease-in-out infinite}',
    '.rg-hand-r{animation:rgHandR 2.4s ease-in-out infinite}',
    '.rg-spark{animation:rgSpark 1.6s ease-in-out infinite}',
    '.rg-spark.s2{animation-delay:.8s}',
    '@keyframes rgBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(-2deg)}}',
    '@keyframes rgBlink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}',
    '@keyframes rgClose{0%,30%{transform:scaleX(1)}50%,72%{transform:scaleX(.08)}92%,100%{transform:scaleX(1)}}',
    '@keyframes rgCover{0%,42%{opacity:0}50%,72%{opacity:1}80%,100%{opacity:0}}',
    '@keyframes rgHandL{0%,30%{transform:translate(0,0)}50%,72%{transform:translate(28px,0)}92%,100%{transform:translate(0,0)}}',
    '@keyframes rgHandR{0%,30%{transform:translate(0,0)}50%,72%{transform:translate(-28px,0)}92%,100%{transform:translate(0,0)}}',
    '@keyframes rgSpark{0%,100%{opacity:0;transform:scale(.5)}50%{opacity:1;transform:scale(1)}}',
    /* ---- 戴眼鏡小男生（2026-10-14 第二版：Michelle 說第一版太醜、豎起來的手指像比中指 →
         改成跟小女生同一個畫風；手只畫圓圓的拳頭，不畫手指）。拿著平板，螢幕上的長條圖會跳動，
         每 3 秒舉手碰一下眼鏡、鏡片閃一道光 ---- */
    '.gb-bob{animation:gbBob 3s ease-in-out infinite;transform-box:view-box;transform-origin:60px 76px}',
    '.gb-eyes{animation:rgBlink 4s infinite;transform-box:fill-box;transform-origin:center}',
    '.gb-glasses{animation:gbPush 3s ease-in-out infinite}',
    '.gb-hand{animation:gbHand 3s ease-in-out infinite}',
    '.gb-glint{animation:gbGlint 3s ease-in-out infinite}',
    '.gb-bar{animation:gbBar 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}',
    '.gb-bar.b2{animation-delay:.3s}.gb-bar.b3{animation-delay:.6s}.gb-bar.b4{animation-delay:.9s}',
    '.gb-spark{animation:rgSpark 1.8s ease-in-out infinite}',
    '.gb-spark.s2{animation-delay:.9s}',
    '@keyframes gbBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(2deg)}}',
    /* 右手：平常扶著平板 → 舉到眼鏡中間 → 往上碰一下 → 放回去 */
    '@keyframes gbHand{0%,35%{transform:translate(0,0)}50%{transform:translate(-36px,-46px)}56%,68%{transform:translate(-36px,-49.5px)}85%,100%{transform:translate(0,0)}}',
    /* 眼鏡：被碰的那一下往上移一點，之後慢慢滑回原位 */
    '@keyframes gbPush{0%,52%{transform:translateY(0)}57%,70%{transform:translateY(-2.5px)}90%,100%{transform:translateY(0)}}',
    /* 鏡片反光：推完眼鏡那一刻閃一下 */
    '@keyframes gbGlint{0%,56%{opacity:0}61%,74%{opacity:1}82%,100%{opacity:0}}',
    '@keyframes gbBar{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.45)}}',
    '@media (prefers-reduced-motion: reduce){.rg-bob,.rg-eyes,.rg-book,.rg-hand-l,.rg-hand-r,.rg-spark,.gb-bob,.gb-eyes,.gb-glasses,.gb-hand,.gb-glint,.gb-bar,.gb-spark{animation:none}.rg-cover,.gb-glint{opacity:0}}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('ai-mascot-css')) return;
    var st = document.createElement('style');
    st.id = 'ai-mascot-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // 翻書的小女生（2026-10-13 在 orders.html 做的，依 Michelle 意見修過四版，這些是她要的樣子，改圖時別改回去）：
  //   - 髮際線太高 → 頭髮包住頭頂、瀏海一撮一撮蓋到眉毛
  //   - 拿掉雙馬尾，改成一整塊圓潤的蓬鬆鮑伯頭（用一圈小圓疊會變捲髮，不要）
  //   - 脖子太長像長頸鹿 → 只露一點點；脖子畫在衣服後面、衣服做 V 字領口，看起來從領口長出來
  //   - 翻書 = 展開、合起來兩個動作：左右兩半一起往中間合上、停一下再打開，雙手跟著書的邊緣移動
  //   - 合起來時看到的封面是粉紅色（跟制服顏色才分得出來）
  function girlSvg(color) {
    return '<svg viewBox="0 0 120 112" width="96" height="90" aria-hidden="true">'
      + '<path class="rg-spark" d="M100 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fbbf24"/>'
      + '<path class="rg-spark s2" d="M16 30 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="#f9a8d4"/>'
      + '<g class="rg-bob">'
      + '<path d="M27 57 C23 29 38 14 60 14 C82 14 97 29 93 57 C92 66 87 72 80 70 C76 69 74 64 76 60 L44 60 C46 64 44 69 40 70 C33 72 28 66 27 57 Z" fill="#6b4226"/>'
      + '<rect x="55" y="66" width="10" height="16" rx="3" fill="#f7d4bd"/>'
      + '<path d="M36 112 Q36 77 53 73.5 L60 82 L67 73.5 Q84 77 84 112 Z" fill="' + color + '"/>'
      + '<path d="M53 73.5 L60 82 L55.5 74.5 Z M67 73.5 L60 82 L64.5 74.5 Z" fill="#fff"/>'
      + '<path d="M53 73.5 L60 82 L67 73.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linejoin="round"/>'
      + '<ellipse cx="60" cy="53" rx="21" ry="19" fill="#ffe4d1"/>'
      + '<path d="M37 53 C35 30 44 19 60 19 C76 19 85 30 83 53 Q82 44 77 46 Q75 37 68 42 Q64 34 58 41 Q53 35 49 43 Q44 38 42 47 Q38 45 37 53 Z" fill="#6b4226"/>'
      + '<path d="M44 27 Q53 21 63 23" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".3"/>'
      + '<path d="M74 19 L67 13 L67 25 Z M74 19 L81 13 L81 25 Z" fill="#f472b6"/>'
      + '<circle cx="74" cy="19" r="2.2" fill="#ec4899"/>'
      + '<g class="rg-eyes">'
      + '<ellipse cx="51" cy="55" rx="3.6" ry="4.6" fill="#3b2a20"/><ellipse cx="69" cy="55" rx="3.6" ry="4.6" fill="#3b2a20"/>'
      + '<circle cx="52.2" cy="53.4" r="1.4" fill="#fff"/><circle cx="70.2" cy="53.4" r="1.4" fill="#fff"/>'
      + '<circle cx="50" cy="57.3" r=".6" fill="#fff"/><circle cx="68" cy="57.3" r=".6" fill="#fff"/>'
      + '</g>'
      + '<ellipse cx="44" cy="61" rx="4" ry="2.3" fill="#fda4af" opacity=".75"/>'
      + '<ellipse cx="76" cy="61" rx="4" ry="2.3" fill="#fda4af" opacity=".75"/>'
      + '<path d="M57 63 Q60 66.5 63 63 Z" fill="#e11d48" stroke="#be123c" stroke-width=".6" stroke-linejoin="round"/>'
      + '</g>'
      + '<g transform="translate(0 78)">'
      + '<g class="rg-book">'
      + '<path d="M22 8 Q40 2 60 8 L60 32 Q40 26 22 32 Z" fill="#fff" stroke="#94a3b8" stroke-width="1.2"/>'
      + '<path d="M98 8 Q80 2 60 8 L60 32 Q80 26 98 32 Z" fill="#fff" stroke="#94a3b8" stroke-width="1.2"/>'
      + '<path d="M28 14 h24 M28 19 h20 M28 24 h22 M68 14 h24 M68 19 h20 M68 24 h22" stroke="#cbd5e1" stroke-width="1.4"/>'
      + '<path d="M60 6 L60 33" stroke="#64748b" stroke-width="1.5"/>'
      + '</g>'
      + '<g class="rg-cover"><rect x="50" y="4" width="20" height="30" rx="2.5" fill="#f9a8d4" stroke="#ec4899" stroke-width="1.2"/><rect x="54" y="10" width="12" height="6" rx="1" fill="#fff"/></g>'
      + '<circle class="rg-hand-l" cx="23" cy="22" r="4.5" fill="#ffe4d1" stroke="#f3c9ad" stroke-width=".8"/>'
      + '<circle class="rg-hand-r" cx="97" cy="22" r="4.5" fill="#ffe4d1" stroke="#f3c9ad" stroke-width=".8"/>'
      + '</g></svg>';
  }

  // 戴眼鏡的工程師小男生（第二版，跟小女生同一個畫風：大眼睛、腮紅、圓潤的頭髮）
  //   黑色旁分短髮、頭頂翹一根毛、白襯衫配彩色領子、細框圓眼鏡、張嘴笑（照 Michelle 給的參考圖風格）；雙手拿平板，右手會舉起來碰一下眼鏡。
  //   ⚠️ 手只畫圓圓的拳頭，不要畫豎起來的手指（第一版被看成比中指）。
  function boySvg(color) {
    return '<svg viewBox="0 0 120 112" width="96" height="90" aria-hidden="true">'
      + '<path class="gb-spark" d="M100 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#38bdf8"/>'
      + '<path class="gb-spark s2" d="M16 30 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="#a5b4fc"/>'
      + '<g class="gb-bob">'
      // 脖子（只露一點點）+ 白襯衫，領子用各系統的主色（2026-10-14 Michelle 給的參考圖：白襯衫配彩色領子）
      + '<rect x="55" y="66" width="10" height="16" rx="3" fill="#f7d4bd"/>'
      + '<path d="M36 112 Q36 77 53 73.5 L60 81 L67 73.5 Q84 77 84 112 Z" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>'
      + '<path d="M60 81 L60 112" stroke="#e2e8f0" stroke-width="1"/><circle cx="60" cy="91" r="1" fill="#cbd5e1"/><circle cx="60" cy="100" r="1" fill="#cbd5e1"/>'
      + '<path d="M51.5 72 L60 81 L52 84.5 L47.5 76 Z M68.5 72 L60 81 L68 84.5 L72.5 76 Z" fill="' + color + '" stroke="#0f172a" stroke-opacity=".25" stroke-width=".7" stroke-linejoin="round"/>'
      // 臉（跟小女生一樣大小）
      + '<ellipse cx="60" cy="53" rx="21" ry="19" fill="#ffe4d1"/>'
      // 黑色短髮：圓圓包住頭頂、旁分（左邊一道分線），瀏海往右撥，頭頂翹一根毛
      + '<path d="M38 55 C34 28 46 16 61 16 C77 16 87 28 82 55 Q81 44 76 40 Q66 37 58 39 Q52 40 49 36 Q44 42 42 47 Q40 50 38 55 Z" fill="#1f1f24"/>'
      + '<path d="M49 36 Q50 26 55 20" stroke="#3f3f46" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M62 17 Q61 9 66 7" stroke="#1f1f24" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M62 22 Q71 21 77 27" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".25"/>'
      // 圓眼睛：白眼球 + 黑眼珠 + 反光點（會眨）
      + '<g class="gb-eyes">'
      + '<ellipse cx="51" cy="54.5" rx="4.4" ry="5.2" fill="#fff" stroke="#3b2a20" stroke-width=".9"/><ellipse cx="69" cy="54.5" rx="4.4" ry="5.2" fill="#fff" stroke="#3b2a20" stroke-width=".9"/>'
      + '<ellipse cx="51.8" cy="55.5" rx="2.4" ry="3" fill="#2b1d16"/><ellipse cx="68.2" cy="55.5" rx="2.4" ry="3" fill="#2b1d16"/>'
      + '<circle cx="52.6" cy="54.4" r=".9" fill="#fff"/><circle cx="69" cy="54.4" r=".9" fill="#fff"/>'
      + '</g>'
      // 淡淡腮紅、張大嘴開心笑（看得到粉紅舌頭）
      + '<ellipse cx="43" cy="62.5" rx="3.6" ry="2" fill="#fda4af" opacity=".55"/><ellipse cx="77" cy="62.5" rx="3.6" ry="2" fill="#fda4af" opacity=".55"/>'
      + '<path d="M54.5 62.5 Q60 63.5 65.5 62.5 Q64.5 69.5 60 69.5 Q55.5 69.5 54.5 62.5 Z" fill="#9f1239" stroke="#3b2a20" stroke-width=".8" stroke-linejoin="round"/>'
      + '<path d="M56.5 67.3 Q60 65.3 63.5 67.3 Q62 69.3 60 69.3 Q58 69.3 56.5 67.3 Z" fill="#fb7185"/>'
      // 細框圓眼鏡（被碰的時候整副往上移）+ 鏡片反光
      + '<g class="gb-glasses">'
      + '<circle cx="51" cy="54.5" r="7.6" fill="#fff" fill-opacity=".15" stroke="#475569" stroke-width="1.4"/>'
      + '<circle cx="69" cy="54.5" r="7.6" fill="#fff" fill-opacity=".15" stroke="#475569" stroke-width="1.4"/>'
      + '<path d="M58.6 53.5 Q60 52.2 61.4 53.5" stroke="#475569" stroke-width="1.4" fill="none"/>'
      + '<g class="gb-glint"><path d="M47 58.5 L52.5 51 M65 58.5 L70.5 51" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>'
      + '</g>'
      + '</g>'
      // 平板（螢幕上的長條圖會一直跳，表示正在算資料）
      + '<g transform="translate(0 78)">'
      + '<rect x="25" y="4" width="70" height="30" rx="4" fill="#475569"/>'
      + '<rect x="29" y="7.5" width="62" height="23" rx="2" fill="#f8fafc"/>'
      + '<rect class="gb-bar" x="36" y="17" width="7" height="11" rx="1" fill="' + color + '" opacity=".55"/>'
      + '<rect class="gb-bar b2" x="47" y="12" width="7" height="16" rx="1" fill="' + color + '"/>'
      + '<rect class="gb-bar b3" x="58" y="19" width="7" height="9" rx="1" fill="' + color + '" opacity=".55"/>'
      + '<rect class="gb-bar b4" x="69" y="14" width="7" height="14" rx="1" fill="' + color + '"/>'
      + '<path d="M33 28.5 h54" stroke="#cbd5e1" stroke-width="1"/>'
      // 左手扶著平板；右手會舉起來碰眼鏡（圓圓的拳頭，顏色比臉深一點、有外框，舉到臉前面才看得出來）
      + '<circle cx="24" cy="22" r="4.5" fill="#fbd3b8" stroke="#c98463" stroke-width="1"/>'
      + '<circle class="gb-hand" cx="96" cy="22" r="4.5" fill="#fbd3b8" stroke="#c98463" stroke-width="1"/>'
      + '</g></svg>';
  }

  var DEFAULTS = {
    girl: { color: '#10b981', bg: '#ecfdf5', text: '#065f46' },
    boy:  { color: '#2563eb', bg: '#eff6ff', text: '#1e3a8a' }
  };
  var FALLBACK_LINES = ['資料翻找中…', '整理成好讀的樣子…', '快好了，再等我一下~'];

  function opts(o) {
    o = o || {};
    var kind = o.kind === 'boy' ? 'boy' : 'girl';
    var d = DEFAULTS[kind];
    return { kind: kind, color: o.color || d.color, bg: o.bg || d.bg, text: o.text || d.text,
      lines: (o.lines && o.lines.length) ? o.lines : FALLBACK_LINES };
  }
  // 依等待秒數決定顯示哪一句（每 2.5 秒換下一句，最後一句停住）。
  // Michelle：不要顯示「已等幾秒」，不想讓人盯著秒數看。
  function lineAt(lines, sec) { return lines[Math.min(Math.floor(sec / 2.5), lines.length - 1)]; }
  function svg(kind, color) { return kind === 'boy' ? boySvg(color) : girlSvg(color); }

  // 非 React 頁面用：把小人物放進 el，回傳一個停止函式
  function mount(el, o) {
    injectCss();
    o = opts(o);
    el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;background:' + o.bg + ';border-radius:12px;padding:8px 12px;width:fit-content;max-width:100%">'
      + svg(o.kind, o.color)
      + '<div class="ai-mascot-line" style="font-size:14px;font-weight:500;color:' + o.text + '"></div></div>';
    var lineEl = el.querySelector('.ai-mascot-line');
    var sec = 0;
    lineEl.textContent = lineAt(o.lines, 0);
    var t = setInterval(function () { sec += 0.5; lineEl.textContent = lineAt(o.lines, sec); }, 500);
    return function stop() { clearInterval(t); };
  }

  window.AiMascot = { mount: mount, svg: svg, lineAt: lineAt };

  // React 頁面用（有載入 React 才會建立）。畫面一出現就開始計時，消失就停止。
  if (window.React) {
    var h = window.React.createElement;
    window.AiMascotReact = function AiMascotReact(props) {
      var o = opts(props);
      var st = window.React.useState(0), sec = st[0], setSec = st[1];
      window.React.useEffect(function () {
        injectCss();
        var t = setInterval(function () { setSec(function (s) { return s + 0.5; }); }, 500);
        return function () { clearInterval(t); };
      }, []);
      // 用 useMemo 固定 SVG 字串，換句子時不會重畫小人物（動畫才不會從頭開始）
      var art = window.React.useMemo(function () { return { __html: svg(o.kind, o.color) }; }, [o.kind, o.color]);
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: o.bg, borderRadius: 12, padding: '8px 12px', width: 'fit-content', maxWidth: '100%' } },
        h('span', { dangerouslySetInnerHTML: art, style: { display: 'inline-flex', flexShrink: 0 } }),
        h('div', { style: { fontSize: 14, fontWeight: 500, color: o.text } }, lineAt(o.lines, sec)));
    };
  }
})();
