/*
 * AI 問答「等待中」小人物（2026-10-14 Michelle 提議）
 * ------------------------------------------------------------
 * AI 查資料要等幾秒到幾十秒，與其讓人盯著轉圈圈，不如放一個會動的小人物，旁邊小字每 2.5 秒換一句，
 * 句子依各系統的資料庫內容不同（由各頁面自己傳進來）。
 *
 *   - 'girl'：翻書的小女生（最早做在 orders.html 已接未出訂單，2026-10-13），給業務類系統用：
 *             出貨實績、已接未出訂單、行動秘書、營業商務訊息（wechat 那個 repo 有複製一份這個檔案）
 *   - 'boy' ：戴眼鏡、會推眼鏡（鏡片會反光）的工程師小男生，給技術類系統用：
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
    /* ---- 戴眼鏡小男生：一邊看筆電，每 3 秒舉手推一下眼鏡，鏡片閃一道光 ---- */
    '.gb-bob{animation:gbBob 3s ease-in-out infinite;transform-box:view-box;transform-origin:60px 80px}',
    '.gb-eyes{animation:rgBlink 4s infinite;transform-box:fill-box;transform-origin:center}',
    '.gb-glasses{animation:gbPush 3s ease-in-out infinite}',
    '.gb-hand{animation:gbHand 3s ease-in-out infinite}',
    '.gb-glint{animation:gbGlint 3s ease-in-out infinite}',
    '.gb-cursor{animation:gbCursor 1s steps(1) infinite}',
    '.gb-spark{animation:rgSpark 1.8s ease-in-out infinite}',
    '.gb-spark.s2{animation-delay:.9s}',
    '@keyframes gbBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}',
    /* 手：平常放在筆電上 → 舉到眼鏡中間 → 推一下 → 放回去 */
    '@keyframes gbHand{0%,35%{transform:translate(0,0)}50%{transform:translate(-30px,-43px)}56%{transform:translate(-30px,-46.5px)}68%{transform:translate(-30px,-46.5px)}85%,100%{transform:translate(0,0)}}',
    /* 眼鏡：被推的那一下往上移一點，之後慢慢滑回原位 */
    '@keyframes gbPush{0%,50%{transform:translateY(0)}56%,70%{transform:translateY(-2.5px)}90%,100%{transform:translateY(0)}}',
    /* 鏡片反光：推完眼鏡那一刻閃一下 */
    '@keyframes gbGlint{0%,55%{opacity:0}60%,72%{opacity:1}80%,100%{opacity:0}}',
    '@keyframes gbCursor{0%{opacity:1}50%{opacity:0}}',
    '@media (prefers-reduced-motion: reduce){.rg-bob,.rg-eyes,.rg-book,.rg-hand-l,.rg-hand-r,.rg-spark,.gb-bob,.gb-eyes,.gb-glasses,.gb-hand,.gb-glint,.gb-cursor,.gb-spark{animation:none}.rg-cover,.gb-glint{opacity:0}}'
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

  // 戴眼鏡的工程師小男生：翹一撮呆毛（看起來比較愛玩）、圓框眼鏡、連帽衣，坐在筆電後面
  function boySvg(color) {
    return '<svg viewBox="0 0 120 112" width="96" height="90" aria-hidden="true">'
      // 旁邊飄的小符號：齒輪感的小星星 + 程式碼括號
      + '<path class="gb-spark" d="M101 16 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#38bdf8"/>'
      + '<text class="gb-spark s2" x="9" y="36" font-size="11" font-weight="700" font-family="monospace" fill="#a78bfa">&lt;/&gt;</text>'
      + '<g class="gb-bob">'
      // 連帽衣（帽子在脖子後面）+ 脖子
      + '<path d="M40 80 Q60 70 80 80 L80 86 L40 86 Z" fill="' + color + '" opacity=".75"/>'
      + '<rect x="55" y="66" width="10" height="14" rx="3" fill="#f7d4bd"/>'
      + '<path d="M34 112 Q34 79 52 75 Q60 80 68 75 Q86 79 86 112 Z" fill="' + color + '"/>'
      + '<path d="M56 79 L55 92 M64 79 L65 92" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>'
      + '<circle cx="55" cy="93" r="1.3" fill="#fff"/><circle cx="65" cy="93" r="1.3" fill="#fff"/>'
      // 臉
      + '<ellipse cx="60" cy="52" rx="20" ry="19" fill="#ffe4d1"/>'
      + '<ellipse cx="40" cy="54" rx="3" ry="4" fill="#ffe4d1"/><ellipse cx="80" cy="54" rx="3" ry="4" fill="#ffe4d1"/>'
      // 短髮（刺刺的瀏海）+ 頭頂一撮呆毛
      + '<path d="M39 52 C36 30 46 20 60 20 C75 20 85 30 81 52 Q79 42 74 41 L72 46 L68 39 L64 45 L60 38 L56 45 L52 39 L48 46 L46 41 Q41 42 39 52 Z" fill="#2f2a33"/>'
      + '<path d="M60 21 Q57 10 66 8 Q61 13 63 21 Z" fill="#2f2a33"/>'
      + '<path d="M47 27 Q55 22 64 24" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".25"/>'
      // 眼睛（會眨）
      + '<g class="gb-eyes"><circle cx="52" cy="54" r="2.6" fill="#2b2b2b"/><circle cx="68" cy="54" r="2.6" fill="#2b2b2b"/>'
      + '<circle cx="53" cy="53" r=".9" fill="#fff"/><circle cx="69" cy="53" r=".9" fill="#fff"/></g>'
      // 有點得意的歪嘴笑 + 淡淡腮紅
      + '<path d="M55 63 Q60 66 66 61.5" stroke="#9f3a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="45" cy="60" rx="3.2" ry="1.8" fill="#fda4af" opacity=".55"/><ellipse cx="75" cy="60" rx="3.2" ry="1.8" fill="#fda4af" opacity=".55"/>'
      // 圓框眼鏡（被推的時候整副往上移）+ 鏡片反光
      + '<g class="gb-glasses">'
      + '<circle cx="52" cy="54" r="7" fill="#e0f2fe" fill-opacity=".35" stroke="#334155" stroke-width="2"/>'
      + '<circle cx="68" cy="54" r="7" fill="#e0f2fe" fill-opacity=".35" stroke="#334155" stroke-width="2"/>'
      + '<path d="M59 53 Q60 51.5 61 53" stroke="#334155" stroke-width="2" fill="none"/>'
      + '<path d="M45 52 L41 50 M75 52 L79 50" stroke="#334155" stroke-width="1.6"/>'
      + '<g class="gb-glint"><path d="M48 57 L54 49 M64 57 L70 49" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g>'
      + '</g>'
      + '</g>'
      // 筆電（從背面看，銀色機身 + 貼紙），螢幕光照在下巴
      + '<g transform="translate(0 80)">'
      + '<path d="M30 2 L90 2 L94 30 L26 30 Z" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.2"/>'
      + '<circle cx="60" cy="15" r="5" fill="#f8fafc" stroke="#94a3b8" stroke-width=".8"/>'
      + '<path d="M57.5 15 h5" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/>'
      + '<rect class="gb-cursor" x="62.6" y="13.2" width="1.6" height="3.6" fill="' + color + '"/>'
      + '<rect x="22" y="29" width="76" height="4" rx="2" fill="#94a3b8"/>'
      // 左手放在筆電上；右手會舉起來推眼鏡（手的顏色比臉深一點、加外框，推到臉前面時才看得出來）
      + '<circle cx="31" cy="26" r="4.5" fill="#fbd3b8" stroke="#c98463" stroke-width="1"/>'
      + '<g class="gb-hand"><circle cx="90" cy="26" r="4.5" fill="#fbd3b8" stroke="#c98463" stroke-width="1"/>'
      + '<rect x="88.6" y="17.5" width="2.8" height="7" rx="1.4" fill="#fbd3b8" stroke="#c98463" stroke-width="1"/></g>'
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
