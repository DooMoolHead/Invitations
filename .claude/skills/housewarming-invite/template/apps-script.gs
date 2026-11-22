/**
 * 밍짜네 집들이 — 참석/날짜투표 저장용 Google Apps Script
 * 사용법은 invite/README.md 참고. 시트 1행에 머리글이 자동으로 만들어집니다.
 */
/** 호스트 비밀번호: 초대장에서 '호스트'를 누르고 이 값을 넣으면 응답을 삭제할 수 있어요. 꼭 바꾸세요. */
const ADMIN_KEY = '여기에-비밀번호';
const HEAD = ['ts', 'name', 'attend', 'dates', 'count', 'car', 'message', 'transport', 'ride'];

function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEAD);
  return sh;
}
function rows_() {
  const v = sheet_().getDataRange().getValues().slice(1);
  return v.filter(r => r[1]).map(r => ({
    ts: r[0], name: String(r[1]), attend: String(r[2] || 'yes'),
    dates: String(r[3] || '').split(',').filter(Boolean),
    count: Number(r[4]) || 1, car: String(r[5] || ''), message: String(r[6] || ''),
    transport: String(r[7] || ''), ride: String(r[8] || ''),
  }));
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function settings_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('settings') || '{}'); } catch (e) { return {}; }
}
function doGet() { return out_({ ok: true, rows: rows_(), settings: settings_() }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'settings') {
      if (String(body.key || '') !== ADMIN_KEY) return out_({ ok: false, error: 'key' });
      const s = body.settings || {};
      const dates = (s.dates || []).map(String).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 20);
      PropertiesService.getScriptProperties().setProperty('settings', JSON.stringify({ dates: dates }));
      return out_({ ok: true, rows: rows_(), settings: settings_() });
    }
    if (body.action === 'delete') {
      if (String(body.key || '') !== ADMIN_KEY) return out_({ ok: false, error: 'key' });
      const sh0 = sheet_(), target = String(body.name || '').replace(/\s+/g, '');
      const ns = sh0.getRange(1, 2, sh0.getLastRow(), 1).getValues().map(r => String(r[0]).replace(/\s+/g, ''));
      const k = ns.indexOf(target);
      if (k > 0) sh0.deleteRow(k + 1);
      return out_({ ok: true, rows: rows_(), settings: settings_() });
    }
    const x = body.entry || {};
    const name = String(x.name || '').trim().slice(0, 30);
    if (!name) return out_({ ok: false, error: 'name' });
    const row = [new Date(), name, x.attend === 'no' ? 'no' : 'yes',
      (x.dates || []).slice(0, 8).join(','), Math.min(Number(x.count) || 1, 10),
      String(x.car || '').slice(0, 15), String(x.message || '').slice(0, 200),
      String(x.transport || '').slice(0, 10), String(x.ride || '').slice(0, 20)];
    const sh = sheet_();
    const names = sh.getRange(1, 2, sh.getLastRow(), 1).getValues().map(r => String(r[0]).replace(/\s+/g, ''));
    const i = names.indexOf(name.replace(/\s+/g, ''));
    if (i > 0) sh.getRange(i + 1, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    return out_({ ok: true, rows: rows_(), settings: settings_() });
  } finally { lock.releaseLock(); }
}
