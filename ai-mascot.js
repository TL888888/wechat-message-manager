/*
 * AI 問答「等待中」的翻書小女生（2026-10-14 Michelle 提議）
 * ------------------------------------------------------------
 * AI 查資料要等幾秒到幾十秒，與其讓人盯著轉圈圈，不如放一個會動的小女生，旁邊小字每 2.5 秒換一句，
 * 句子依各系統的資料庫內容不同（由各頁面自己傳進來，例如 bom.html 的 BOM_WAIT_LINES）。
 * 小女生最早做在 orders.html（已接未出訂單，2026-10-13）。
 *
 * ⚠️ Michelle 決定（2026-10-14）：所有系統都用這個翻書小女生，圖、顏色都「不要動」，只改句子。
 *    中間試過四版「戴眼鏡的小男生」給技術類系統，她都覺得醜，最後全部撤掉。之後請不要再改圖。
 *
 * 用到的系統：出貨實績、已接未出訂單、行動秘書、服務部技術論壇、BOM、品保（文件問答 + EIP 異常問答）、
 *   市場產業資訊（以上在 TL_technology），以及營業商務訊息（wechat-message-manager 那個 repo 有複製一份這個檔案）。
 *
 * 這是一般 JavaScript（不是 JSX），所以 React 頁面和不用 React 的頁面（例如營業商務訊息）都能用：
 *   1) React 頁面：在主程式之前載入 <script src="/ai-mascot.js"></script>，然後
 *        const AiMascot = window.AiMascotReact;
 *        {loading && <AiMascot lines={['翻翻資料…', '快好了~']} />}
 *   2) 非 React 頁面：var stop = AiMascot.mount(某個div, { lines:[...] });
 *        查完後呼叫 stop() 停止換句子，再把 div 換成答案即可。
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
    '@media (prefers-reduced-motion: reduce){.rg-bob,.rg-eyes,.rg-book,.rg-hand-l,.rg-hand-r,.rg-spark{animation:none}.rg-cover{opacity:0}}'
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
    var hair = '#6b4226';
    return '<svg viewBox="0 0 120 112" width="96" height="90" aria-hidden="true">'
      + '<path class="rg-spark" d="M100 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fbbf24"/>'
      + '<path class="rg-spark s2" d="M16 30 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="#f9a8d4"/>'
      + '<g class="rg-bob">'
      + '<path d="M27 57 C23 29 38 14 60 14 C82 14 97 29 93 57 C92 66 87 72 80 70 C76 69 74 64 76 60 L44 60 C46 64 44 69 40 70 C33 72 28 66 27 57 Z" fill="' + hair + '"/>'
      + '<rect x="55" y="66" width="10" height="16" rx="3" fill="#f7d4bd"/>'
      + '<path d="M36 112 Q36 77 53 73.5 L60 82 L67 73.5 Q84 77 84 112 Z" fill="' + color + '"/>'
      + '<path d="M53 73.5 L60 82 L55.5 74.5 Z M67 73.5 L60 82 L64.5 74.5 Z" fill="#fff"/>'
      + '<path d="M53 73.5 L60 82 L67 73.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linejoin="round"/>'
      + '<ellipse cx="60" cy="53" rx="21" ry="19" fill="#ffe4d1"/>'
      + '<path d="M37 53 C35 30 44 19 60 19 C76 19 85 30 83 53 Q82 44 77 46 Q75 37 68 42 Q64 34 58 41 Q53 35 49 43 Q44 38 42 47 Q38 45 37 53 Z" fill="' + hair + '"/>'
      + '<path d="M44 27 Q53 21 63 23" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".3"/>'
      + '<path d="M74 19 L67 13 L67 25 Z M74 19 L81 13 L81 25 Z" fill="#f472b6"/><circle cx="74" cy="19" r="2.2" fill="#ec4899"/>'  // 頭頂蝴蝶結
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


  // 永遠用原本的樣子：綠色制服、淺綠底、深綠字（Michelle：都不要動）。舊頁面若還傳 kind/color 進來也會被忽略。
  var LOOK = { color: '#10b981', bg: '#ecfdf5', text: '#065f46' };
  var FALLBACK_LINES = ['資料翻找中…', '整理成好讀的樣子…', '快好了，再等我一下~'];

  function opts(o) {
    o = o || {};
    return { color: LOOK.color, bg: LOOK.bg, text: LOOK.text,
      lines: (o.lines && o.lines.length) ? o.lines : FALLBACK_LINES };
  }
  // 依等待秒數決定顯示哪一句（每 2.5 秒換下一句，最後一句停住）。
  // Michelle：不要顯示「已等幾秒」，不想讓人盯著秒數看。
  function lineAt(lines, sec) { return lines[Math.min(Math.floor(sec / 2.5), lines.length - 1)]; }
  function svg(kind, color) { return girlSvg(color || LOOK.color); } // kind 參數保留但不使用（以前有小男生）

  // 非 React 頁面用：把小人物放進 el，回傳一個停止函式
  function mount(el, o) {
    injectCss();
    o = opts(o);
    el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;background:' + o.bg + ';border-radius:12px;padding:8px 12px;width:fit-content;max-width:100%">'
      + girlSvg(o.color)
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
      var art = window.React.useMemo(function () { return { __html: girlSvg(o.color) }; }, [o.color]);
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: o.bg, borderRadius: 12, padding: '8px 12px', width: 'fit-content', maxWidth: '100%' } },
        h('span', { dangerouslySetInnerHTML: art, style: { display: 'inline-flex', flexShrink: 0 } }),
        h('div', { style: { fontSize: 14, fontWeight: 500, color: o.text } }, lineAt(o.lines, sec)));
    };
  }
})();
