/**
 * 織造所 MAKE IN TOWN｜訂單後端
 * Google Apps Script Web App
 *
 * GitHub Pages 只負責前端；本檔負責：
 * 1. 產生正式訂單編號 YYYYMMDD + 3碼流水號
 * 2. 寫入 Google Sheets
 * 3. 自動寄送訂單確認 Email
 * 4. 回傳結果給 GitHub Pages 的隱藏 iframe
 *
 * 第一次使用前請修改 CONFIG 中的 SPREADSHEET_ID。
 */

const CONFIG = {
  SPREADSHEET_ID: '請填入你的 Google Sheets ID',
  SHEET_NAME: 'Orders',
  STORE_NAME: '織造所 MAKE IN TOWN',
  LINE_URL: 'https://lin.ee/yyzyhp2',
  BANK_NAME: '請填入銀行名稱',
  BANK_ACCOUNT: '請填入銀行帳號',
  TIMEZONE: 'Asia/Taipei',
  ALLOWED_ORIGIN: 'https://makeintown.github.io'
};

const HEADERS = [
  '訂單編號',
  '訂單日期',
  '訂購人姓名',
  'Email',
  '聯絡電話',
  '訂購項目',
  '商品小計',
  '運費',
  '訂單總金額',
  '7-11 收貨門市',
  '付款狀態',
  '訂單狀態',
  '匯款末5碼',
  '備註',
  'Email寄送時間'
];

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><html><body>MAKE IN TOWN order API is running.</body></html>');
}

function doPost(e) {
  let result;

  try {
    const raw = e && e.parameter && e.parameter.orderData;
    if (!raw) throw new Error('缺少 orderData');

    const order = JSON.parse(raw);
    validateOrder_(order);

    const orderNo = createOrderNumber_();
    const now = new Date();
    const dateText = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm:ss');

    const sheet = getOrderSheet_();
    sheet.appendRow([
      orderNo,
      dateText,
      order.name,
      order.email,
      order.phone,
      order.itemsText,
      Number(order.subtotal),
      Number(order.shipping),
      Number(order.total),
      order.store || '',
      '待付款',
      '新訂單',
      '',
      '',
      ''
    ]);

    sendOrderEmail_(order, orderNo, dateText);

    result = {
      ok: true,
      orderNo: orderNo,
      orderDate: dateText,
      emailSent: true
    };
  } catch (err) {
    console.error(err);
    result = {
      ok: false,
      message: err && err.message ? err.message : '訂單處理失敗'
    };
  }

  return createParentResponse_(result);
}

function validateOrder_(order) {
  if (!order || typeof order !== 'object') throw new Error('訂單資料格式錯誤');
  if (!order.name || !String(order.name).trim()) throw new Error('缺少訂購人姓名');
  if (!order.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(order.email).trim())) {
    throw new Error('Email 格式不正確');
  }
  if (!order.phone || !String(order.phone).trim()) throw new Error('缺少聯絡電話');
  if (!order.itemsText || !String(order.itemsText).trim()) throw new Error('缺少訂購項目');
  if (!Number.isFinite(Number(order.subtotal))) throw new Error('商品小計格式錯誤');
  if (!Number.isFinite(Number(order.shipping))) throw new Error('運費格式錯誤');
  if (!Number.isFinite(Number(order.total))) throw new Error('總金額格式錯誤');
  if (Number(order.total) !== Number(order.subtotal) + Number(order.shipping)) {
    throw new Error('訂單金額驗證失敗');
  }
}

function getOrderSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function createOrderNumber_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd');
    const key = 'ORDER_SEQUENCE_' + today;
    const next = Number(props.getProperty(key) || 0) + 1;

    if (next > 999) throw new Error('今日訂單流水號已達 999 筆');

    props.setProperty(key, String(next));
    return today + String(next).padStart(3, '0');
  } finally {
    lock.releaseLock();
  }
}

function sendOrderEmail_(order, orderNo, dateText) {
  const subject = CONFIG.STORE_NAME + '｜訂單確認 ' + orderNo;
  const storeText = order.store ? order.store : '不需寄送／課程現場';
  const shippingText = Number(order.shipping) > 0
    ? 'NT$ ' + Number(order.shipping).toLocaleString()
    : '免運';

  const textBody = [
    CONFIG.STORE_NAME,
    '',
    '【訂單確認】',
    '訂單編號：' + orderNo,
    '訂單日期：' + dateText,
    '',
    '【訂購人資訊】',
    '姓名：' + order.name,
    'Email：' + order.email,
    '聯絡電話：' + order.phone,
    '',
    '【訂購內容】',
    order.itemsText,
    '商品小計：NT$ ' + Number(order.subtotal).toLocaleString(),
    '運費：' + shippingText,
    '訂單總金額：NT$ ' + Number(order.total).toLocaleString(),
    '',
    '【收貨資訊】',
    '7-11 收貨門市：' + storeText,
    '',
    '【匯款資訊】',
    '銀行：' + CONFIG.BANK_NAME,
    '帳號：' + CONFIG.BANK_ACCOUNT,
    '',
    '【付款確認】',
    '完成付款後，請至官方 LINE 回覆：',
    '① 訂單編號：' + orderNo,
    '② 匯款帳號末 5 碼',
    '',
    '官方 LINE：' + CONFIG.LINE_URL,
    '',
    '謝謝您的訂購。'
  ].join('\n');

  const htmlBody = textBody
    .split('\n')
    .map(line => escapeHtml_(line))
    .join('<br>');

  MailApp.sendEmail({
    to: String(order.email).trim(),
    subject: subject,
    body: textBody,
    htmlBody: '<div style="font-family:Arial,sans-serif;line-height:1.8;max-width:680px">' + htmlBody + '</div>',
    name: CONFIG.STORE_NAME
  });
}

function createParentResponse_(result) {
  const safeJson = JSON.stringify(result)
    .replace(/\\/g, '\\\\')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
  window.parent.postMessage({ type: 'MAKE_IN_TOWN_ORDER_RESULT', payload: ${safeJson} }, '${CONFIG.ALLOWED_ORIGIN}');
</script>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 第一次設定完成後，可手動執行一次這個函式測試是否能寫入試算表。
 */
function setupSheet() {
  const sheet = getOrderSheet_();
  Logger.log('Orders sheet ready: ' + sheet.getParent().getUrl());
}
