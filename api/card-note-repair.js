// ══ 名片管理：把塞在「備註」欄位裡的電話/手機/email/地址重新拆回正確欄位 ══
// 使用方式：
//   1. 先執行 previewCardNoteRepair()，只印出「會怎麼改」，不會真的存檔，自己看一遍確認沒問題
//   2. 確認沒問題後執行 runCardNoteRepair()，才會真的把結果存回資料庫
// 只會處理「phone/mobile/email/address 目前都是空的、但note有內容」的名片，
// 已經手動填過的名片不會被這段腳本動到。

function parseCardNote(note) {
  const lines = (note || '').split('\n');
  const phone = [], mobile = [], email = [], address = [], rest = [];

  const PHONE_RE = /^(?:TEL|Tel|tel|電話|电话|辦公室電話|办公室电话)\s*[:：]\s*(.+)$/;
  const MOBILE_RE = /^(?:Mobile|MOBILE|手機|手机|行動電話|行动电话)\s*[:：]\s*(.+)$/;
  const EMAIL_RE = /^(?:E-?mail|EMAIL|邮箱|電子郵件|电子邮件)\s*[:：]\s*(.+)$/i;
  const ADDRESS_RE = /^(?:地址|Address|ADDRESS)\s*[:：]\s*(.+)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(PHONE_RE))) { phone.push(m[1].trim()); continue; }
    if ((m = line.match(MOBILE_RE))) { mobile.push(m[1].trim()); continue; }
    if ((m = line.match(EMAIL_RE))) { email.push(m[1].trim()); continue; }
    if ((m = line.match(ADDRESS_RE))) { address.push(m[1].trim()); continue; }
    // 有些欄位混在同一行有多組資訊（少見），這裡先不特別處理，都歸進rest保留看得到，
    // 需要人工調整可以直接在畫面上編輯
    rest.push(line);
  }

  return {
    phone: phone.join('\n'),
    mobile: mobile.join('\n'),
    email: email.join('\n'),
    address: address.join('\n'),
    note: rest.join('\n'),
  };
}

async function previewCardNoteRepair() {
  const { data, error } = await sb
    .from('business_cards')
    .select('id,company,contact,phone,mobile,email,address,note')
    .is('phone', null)
    .is('mobile', null)
    .is('email', null)
    .is('address', null)
    .not('note', 'is', null);
  if (error) { console.error('查詢失敗:', error); return; }
  if (!data.length) { console.log('沒有需要處理的名片（可能都已經有結構化資料了）'); return; }

  console.log(`共 ${data.length} 筆名片需要重新解析，以下是預覽：`);
  data.forEach((r) => {
    const parsed = parseCardNote(r.note);
    console.log(
      `\n── ${r.company || '(無公司)'} / ${r.contact || '(無聯絡人)'} ──\n` +
      `電話: ${parsed.phone || '(無)'}\n` +
      `手機: ${parsed.mobile || '(無)'}\n` +
      `email: ${parsed.email || '(無)'}\n` +
      `地址: ${parsed.address || '(無)'}\n` +
      `剩餘備註: ${parsed.note || '(無)'}`
    );
  });
  window._cardNoteRepairPreview = data; // 存起來給下一步的 runCardNoteRepair() 用，不用重查一次
  console.log(`\n以上是預覽，確認沒問題後執行 runCardNoteRepair() 才會真的存檔。`);
}

async function runCardNoteRepair() {
  const data = window._cardNoteRepairPreview;
  if (!data) { console.log('請先執行 previewCardNoteRepair() 預覽過一次'); return; }
  let okCount = 0, failCount = 0;
  for (const r of data) {
    const parsed = parseCardNote(r.note);
    const { error } = await sb.from('business_cards').update({
      phone: parsed.phone || null,
      mobile: parsed.mobile || null,
      email: parsed.email || null,
      address: parsed.address || null,
      note: parsed.note || null,
    }).eq('id', r.id);
    if (error) { console.error(`${r.company} 更新失敗:`, error); failCount++; }
    else okCount++;
  }
  console.log(`完成：成功 ${okCount} 筆，失敗 ${failCount} 筆。重新整理頁面查看結果。`);
}

console.log('腳本已載入。先執行 previewCardNoteRepair() 看預覽，確認沒問題再執行 runCardNoteRepair() 存檔。');
