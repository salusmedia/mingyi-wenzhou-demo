// 温州名医汇（名医温州）演示系统 —— 零依赖 Node 服务
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildSeed, hashPwd, idCheck, today, nowStr } = require('./seed');

const PORT = process.env.PORT || 8790;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const PUB = path.join(__dirname, 'public');
const OPEN_APPKEY = process.env.OPEN_APPKEY || 'WZMY-DEMO-APPKEY';

let db;
function load() {
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { reseed(); }
}
function reseed() {
  db = buildSeed();
  const ps = db._pendingStop; delete db._pendingStop;
  if (ps) doStop({ ...ps, reason: '名医外出参加省级学术会议', source: '医院HIS（RADTS_YYGH_TZ_TINGZHEN）', operator: '系统初始化' });
  save(true);
}
let saveTimer = null;
function save(now) {
  const write = () => { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(db)); };
  if (now) return write();
  clearTimeout(saveTimer); saveTimer = setTimeout(write, 300);
}

const seq = p => p + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
const verifyPwd = (pwd, stored) => { const [salt] = stored.split(':'); return hashPwd(pwd, salt) === stored; };
const maskName = n => !n ? '' : n.length <= 2 ? n[0] + '*' : n[0] + '*'.repeat(n.length - 2) + n[n.length - 1];
const maskId = s => s ? s.slice(0, 6) + '********' + s.slice(-4) : '';
const maskPhone = s => s ? s.slice(0, 3) + '****' + s.slice(-4) : '';
const validId = id => /^\d{17}[\dX]$/.test(id) && idCheck(id.slice(0, 17)) === id[17];
const H = id => db.hospitals.find(h => h.id === id);
const D = id => db.depts.find(d => d.id === id);
const DOC = id => db.doctors.find(d => d.id === id);
const U = id => db.users.find(u => u.id === id);
const catName = c => (db.dict.hyCategory.find(x => x.code === c) || {}).name || c;
const mylbName = c => (db.dict.mylb.find(x => x.code === c) || {}).name || c;

function iflog(dir, code, name, req, resp, ok = true) {
  db.iflogs.unshift({ id: seq('L'), t: nowStr(), dir, code, name, req: JSON.stringify(req).slice(0, 600), resp: JSON.stringify(resp).slice(0, 600), ok, ms: 20 + Math.floor(Math.random() * 120) });
  if (db.iflogs.length > 400) db.iflogs.length = 400;
}

// 健康温州消息机制 + 短信平台（模拟三方消息平台）
function notify(userId, type, title, content, sms) {
  const u = U(userId); if (!u) return;
  const m = { id: seq('M'), userId, channel: '健康温州消息', type, title, content, read: false, t: nowStr() };
  db.messages.unshift(m);
  iflog('出', 'HW_MSG_PUSH', '健康温州消息平台-模板消息推送', { openid: 'o' + u.id + '***', template: type, title }, { code: 0, msg: 'success', msgId: m.id });
  if (sms) {
    db.sms.unshift({ id: seq('SMS'), userId, phone: u.phone, content: '【健康温州】' + sms, t: nowStr(), status: '已送达' });
    iflog('出', 'SMS_SEND', '短信平台-短信下发', { phone: maskPhone(u.phone), content: sms.slice(0, 40) + '…' }, { code: 0, status: 'DELIVRD' });
  }
}

function docBrief(d) {
  const h = H(d.hospitalId), dp = D(d.deptId);
  const t = today(0);
  const fut = db.slots.filter(s => s.doctorId === d.id && s.date >= t && s.date <= today(14) && s.status === '正常');
  const remain = fut.reduce((a, s) => a + (s.total - s.used), 0);
  return { id: d.id, code: d.code, name: d.name, gender: d.gender, title: d.title, mylb: d.mylb, mylbName: mylbName(d.mylb), honor: d.honor,
    hospitalId: d.hospitalId, hospitalName: h.name, hospitalShort: h.short, deptId: d.deptId, deptName: dp.name, specialty: d.specialty,
    hyCategory: d.hyCategory, hyCategoryName: catName(d.hyCategory), fee: d.fee, avatarColor: d.avatarColor, remain, hasSchedule: fut.length > 0,
    scheduleText: d.schedule.map(s => '周' + '日一二三四五六'[s.weekday] + s.period).join('、') };
}

function apView(a, full) {
  const d = DOC(a.doctorId), h = H(a.hospitalId), dp = D(a.deptId), u = U(a.userId);
  const v = { ...a, doctorName: d.name, doctorTitle: d.title, hospitalName: h.name, deptName: dp.name, categoryName: catName(a.category) };
  if (full) { v.patientName = u.name; v.patientPhone = u.phone; v.patientId = u.idCard; }
  return v;
}

// 停诊：号源停诊 + 已约退号 + 健康温州消息 + 短信
function doStop({ doctorId, date, period, reason, source, operator }) {
  const d = DOC(doctorId); if (!d) return { error: '医生不存在' };
  const slots = db.slots.filter(s => s.doctorId === doctorId && s.date === date && (!period || period === '全天' || s.period === period));
  if (!slots.length) return { error: '该医生在所选日期/时段无排班' };
  if (slots.every(s => s.status === '停诊')) return { error: '该时段已停诊，请勿重复操作' };
  const affected = [];
  for (const s of slots) {
    s.status = '停诊';
    for (const a of db.appointments.filter(a => a.slotId === s.id && a.status === '待就诊')) {
      a.status = '停诊退号';
      a.logs.push({ t: nowStr(), a: `医院停诊（${reason}），号源自动退回，挂号费原路退回`, by: '医院' });
      affected.push(a);
      notify(a.userId, '停诊通知', '名医停诊通知',
        `您预约的${H(a.hospitalId).short}${D(a.deptId).name} ${d.name}医生 ${a.date} ${a.period}（${a.time}）因“${reason}”停诊，挂号费将原路退回。您可在“名医温州”重新预约或提交名医预约需求。`,
        `您预约的${d.name}医生${a.date}${a.period}门诊因故停诊，费用原路退回，可登录健康温州“名医温州”改约。`);
    }
  }
  // 关注该医生的居民也收到排班变动
  for (const f of db.follows.filter(f => f.doctorId === doctorId)) {
    if (affected.some(a => a.userId === f.userId)) continue;
    notify(f.userId, '关注动态', '关注名医排班变动', `您关注的 ${d.name}（${H(d.hospitalId).short}·${D(d.deptId).name}）${date} ${period || '全天'} 门诊停诊。`);
  }
  const rec = { id: seq('T'), doctorId, hospitalId: d.hospitalId, date, period: period || '全天', reason, source, operator, affected: affected.length, t: nowStr() };
  db.stops.unshift(rec);
  d.updatedAt = nowStr();
  save();
  return { ok: true, record: rec, affected: affected.length };
}

// ---------- HTTP 工具 ----------
function send(res, code, obj, headers = {}) {
  const body = typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
const ok = (res, data) => send(res, 200, { code: 0, data });
const fail = (res, msg, code = 400) => send(res, code, { code: code, msg });
function body(req) {
  return new Promise(r => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch { r({}); } }); });
}
function auth(req, q, kind) {
  const tk = (req.headers.authorization || '').replace('Bearer ', '') || q.get('token');
  const s = tk && db.sessions[tk];
  if (!s || s.kind !== kind) return null;
  return s;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, p) {
  if (p === '/') p = '/index.html';
  const fp = path.normalize(path.join(PUB, p));
  if (!fp.startsWith(PUB)) return send(res, 403, 'forbidden');
  fs.readFile(fp, (e, buf) => {
    if (e) return send(res, 404, { code: 404, msg: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const smsCodes = {}; // phone -> {code, exp}

// ---------- 路由 ----------
const routes = [];
const route = (m, p, fn) => routes.push({ m, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

// ===== 居民端：账号 =====
route('POST', '/api/sms/send', async (req, res) => {
  const { phone, scene } = await body(req);
  if (!/^1\d{10}$/.test(phone || '')) return fail(res, '请输入正确的手机号');
  const exists = db.users.some(u => u.phone === phone);
  if (scene === 'register' && exists) return fail(res, '该手机号已注册，请直接登录');
  if ((scene === 'reset' || scene === 'login') && !exists) return fail(res, '该手机号尚未注册');
  const code = String(100000 + Math.floor(Math.random() * 900000));
  smsCodes[phone] = { code, exp: Date.now() + 5 * 60e3 };
  iflog('出', 'SMS_VCODE', '短信平台-验证码下发', { phone: maskPhone(phone), scene }, { code: 0 });
  ok(res, { demoCode: code, tip: '演示环境：验证码直接返回，正式环境经短信平台下发' });
});
const checkCode = (phone, code) => { const c = smsCodes[phone]; if (!c || c.exp < Date.now() || c.code !== code) return false; delete smsCodes[phone]; return true; };
function newSession(kind, payload) { const tk = crypto.randomBytes(18).toString('hex'); db.sessions[tk] = { kind, ...payload, t: Date.now() }; save(); return tk; }
const userView = u => ({ id: u.id, phone: maskPhone(u.phone), phoneRaw: u.phone, name: u.name, idCard: maskId(u.idCard), verified: u.verified, createdAt: u.createdAt });

route('POST', '/api/auth/register', async (req, res) => {
  const { phone, code, password, name, idCard } = await body(req);
  if (!/^1\d{10}$/.test(phone || '')) return fail(res, '手机号格式不正确');
  if (db.users.some(u => u.phone === phone)) return fail(res, '该手机号已注册');
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,20}$/.test(password || '')) return fail(res, '密码需 8-20 位且同时包含字母和数字');
  const id = (idCard || '').toUpperCase();
  if (idCard && !validId(id)) return fail(res, '身份证号校验未通过');
  if (id && db.users.some(u => u.idCard === id)) return fail(res, '该身份证号已绑定其他账号');
  if (id && !name) return fail(res, '填写身份证号时请同时填写真实姓名');
  if (!checkCode(phone, code)) return fail(res, '验证码错误或已过期');
  const u = { id: 'U' + String(db.users.length + 1).padStart(4, '0') + crypto.randomBytes(1).toString('hex'), phone, name: name || '', idCard: id, verified: !!(name && id), password: hashPwd(password), createdAt: nowStr() };
  db.users.push(u);
  if (u.verified) iflog('出', 'GA_IDV', '公安实名核验服务', { name: maskName(u.name), idCard: maskId(id) }, { result: '一致' });
  ok(res, { token: newSession('user', { userId: u.id }), user: userView(u) });
});
route('POST', '/api/auth/login', async (req, res) => {
  const { account, password, phone, code, mode } = await body(req);
  let u;
  if (mode === 'sms') {
    u = db.users.find(x => x.phone === phone);
    if (!u) return fail(res, '该手机号尚未注册');
    if (!checkCode(phone, code)) return fail(res, '验证码错误或已过期');
  } else {
    const a = (account || '').toUpperCase();
    u = db.users.find(x => x.phone === a || x.idCard === a);
    if (!u || !verifyPwd(password || '', u.password)) return fail(res, '账号或密码错误');
  }
  ok(res, { token: newSession('user', { userId: u.id }), user: userView(u) });
});
route('POST', '/api/auth/reset', async (req, res) => {
  const { phone, code, password, idCard } = await body(req);
  const u = db.users.find(x => x.phone === phone);
  if (!u) return fail(res, '该手机号尚未注册');
  if (u.idCard && !idCard) return fail(res, '已实名账号请填写身份证号以核验身份');
  if (u.idCard && u.idCard !== idCard.toUpperCase()) return fail(res, '身份证号与账号不匹配');
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,20}$/.test(password || '')) return fail(res, '密码需 8-20 位且同时包含字母和数字');
  if (!checkCode(phone, code)) return fail(res, '验证码错误或已过期');
  u.password = hashPwd(password); save();
  ok(res, true);
});
route('GET', '/api/me', (req, res, q) => { const s = auth(req, q, 'user'); if (!s) return fail(res, '请先登录', 401); ok(res, userView(U(s.userId))); });
route('POST', '/api/me/realname', async (req, res, q) => {
  const s = auth(req, q, 'user'); if (!s) return fail(res, '请先登录', 401);
  const { name, idCard } = await body(req); const id = (idCard || '').toUpperCase();
  if (!/^[一-龥·]{2,15}$/.test(name || '')) return fail(res, '请输入真实姓名');
  if (!validId(id)) return fail(res, '身份证号校验未通过');
  if (db.users.some(u => u.idCard === id && u.id !== s.userId)) return fail(res, '该身份证号已绑定其他账号');
  const u = U(s.userId); u.name = name; u.idCard = id; u.verified = true;
  iflog('出', 'GA_IDV', '公安实名核验服务', { name: maskName(name), idCard: maskId(id) }, { result: '一致' });
  save(); ok(res, userView(u));
});
route('POST', '/api/auth/logout', (req, res, q) => { const tk = (req.headers.authorization || '').replace('Bearer ', ''); delete db.sessions[tk]; save(); ok(res, true); });

// ===== 居民端：查询 =====
route('GET', '/api/home', (req, res) => {
  const regions = db.regions.map(r => ({ ...r, hospitalCount: db.hospitals.filter(h => h.region === r.id && h.enabled).length,
    doctorCount: db.doctors.filter(d => d.enabled && H(d.hospitalId).region === r.id).length }));
  ok(res, { settings: db.settings, regions, dict: db.dict });
});
route('GET', '/api/hospitals', (req, res, q) => {
  const region = q.get('region');
  const list = db.hospitals.filter(h => h.enabled && (!region || h.region === region)).map(h => {
    const docs = db.doctors.filter(d => d.hospitalId === h.id && d.enabled);
    const depts = db.depts.filter(dp => dp.hospitalId === h.id).map(dp => ({ id: dp.id, name: dp.name, count: docs.filter(d => d.deptId === dp.id).length })).filter(x => x.count);
    const remain = docs.reduce((a, d) => a + docBrief(d).remain, 0);
    return { ...h, regionName: db.regions.find(r => r.id === h.region).name, doctorCount: docs.length, depts, remain };
  });
  ok(res, list);
});
route('GET', '/api/hospital/:id', (req, res, q, p) => {
  const h = H(p.id); if (!h) return fail(res, '机构不存在', 404);
  const docs = db.doctors.filter(d => d.hospitalId === h.id && d.enabled).map(docBrief);
  const depts = db.depts.filter(dp => dp.hospitalId === h.id).map(dp => ({ ...dp, doctors: docs.filter(d => d.deptId === dp.id) })).filter(x => x.doctors.length);
  ok(res, { ...h, regionName: db.regions.find(r => r.id === h.region).name, depts });
});
route('GET', '/api/doctors', (req, res, q) => {
  const kw = (q.get('q') || '').trim().toLowerCase();
  const terms = kw.split(/\s+/).filter(Boolean);
  let list = db.doctors.filter(d => d.enabled).map(docBrief);
  if (terms.length) list = list.filter(d => terms.every(t => [d.name, d.deptName, d.hospitalName, d.hospitalShort, d.title, d.mylbName, d.honor, ...d.specialty].join(' ').toLowerCase().includes(t)));
  for (const k of ['hospitalId', 'deptId', 'mylb']) if (q.get(k)) list = list.filter(d => d[k] === q.get(k));
  if (q.get('dept')) list = list.filter(d => d.deptName === q.get('dept'));
  if (q.get('region')) list = list.filter(d => H(d.hospitalId).region === q.get('region'));
  if (q.get('hasSlot') === '1') list = list.filter(d => d.remain > 0);
  if (q.get('ids')) { const ids = q.get('ids').split(','); list = list.filter(d => ids.includes(d.id)); }
  list.sort((a, b) => a.mylb.localeCompare(b.mylb) || b.remain - a.remain);
  ok(res, list);
});
route('GET', '/api/depts', (req, res) => ok(res, [...new Set(db.depts.map(d => d.name))]));
route('GET', '/api/doctor/:id', (req, res, q, p) => {
  const d = DOC(p.id); if (!d || !d.enabled) return fail(res, '医生不存在', 404);
  const s = auth(req, q, 'user');
  const t = today(0);
  const slots = db.slots.filter(x => x.doctorId === d.id && x.date >= t && x.date <= today(14)).map(x => ({ ...x, remain: x.total - x.used, categoryName: catName(x.category) }));
  const stops = db.stops.filter(x => x.doctorId === d.id && x.date >= t);
  ok(res, { ...docBrief(d), intro: d.intro, licenseNo: d.licenseNo.slice(0, 7) + '****' + d.licenseNo.slice(-3), practiceYears: d.practiceYears, schedule: d.schedule,
    services: d.services, updatedAt: d.updatedAt, slots, stops, hospital: H(d.hospitalId),
    followed: !!(s && db.follows.some(f => f.userId === s.userId && f.doctorId === d.id)), followers: db.follows.filter(f => f.doctorId === d.id).length + 30 + (parseInt(d.id.slice(1)) * 7) % 200 });
});

// ===== 居民端：需登录 =====
function needUser(fn) { return async (req, res, q, p) => { const s = auth(req, q, 'user'); if (!s) return fail(res, '请先登录', 401); const u = U(s.userId); if (!u) return fail(res, '请先登录', 401); return fn(req, res, q, p, u); }; }

route('POST', '/api/follow', needUser(async (req, res, q, p, u) => {
  const { doctorId } = await body(req);
  if (!DOC(doctorId)) return fail(res, '医生不存在');
  const i = db.follows.findIndex(f => f.userId === u.id && f.doctorId === doctorId);
  if (i >= 0) db.follows.splice(i, 1); else db.follows.push({ userId: u.id, doctorId, t: nowStr() });
  save(); ok(res, { followed: i < 0 });
}));
route('GET', '/api/follows', needUser((req, res, q, p, u) => {
  const t = today(0);
  const list = db.follows.filter(f => f.userId === u.id).map(f => {
    const d = DOC(f.doctorId); const b = docBrief(d);
    const next = db.slots.filter(s => s.doctorId === d.id && s.date >= t && s.status === '正常').sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period))[0];
    const stops = db.stops.filter(s => s.doctorId === d.id && s.date >= t);
    return { ...b, followedAt: f.t, next: next ? next.date + ' ' + next.period : '', stops, updatedAt: d.updatedAt };
  });
  ok(res, list);
}));
route('POST', '/api/appointments', needUser(async (req, res, q, p, u) => {
  const { slotId, message } = await body(req);
  if (!u.verified) return fail(res, '预约挂号须先完成实名认证');
  const s = db.slots.find(x => x.id === slotId);
  if (!s) return fail(res, '号源不存在');
  if (s.status !== '正常') return fail(res, '该号源已停诊');
  if (s.date < today(0) || s.date > today(14)) return fail(res, '不在可预约时间范围内');
  if (s.used >= s.total) return fail(res, '该时段号源已约满，可提交名医预约需求');
  if (db.appointments.some(a => a.userId === u.id && a.doctorId === s.doctorId && a.date === s.date && a.status === '待就诊')) return fail(res, '同一就诊人同一医生同一天限约 1 个号');
  if ((message || '').length > 300) return fail(res, '留言不超过 300 字');
  s.used++;
  const d = DOC(s.doctorId);
  const a = { id: seq('A'), no: 'MY' + s.date.replace(/-/g, '') + String(Math.floor(Math.random() * 9000) + 1000), userId: u.id, slotId: s.id, doctorId: s.doctorId, hospitalId: s.hospitalId, deptId: s.deptId,
    date: s.date, period: s.period, time: s.time, category: s.category, fee: s.fee, status: '待就诊', message: (message || '').trim(), channel: req.headers['x-channel'] === 'gzh' ? '健康温州公众号' : '健康温州小程序', createdAt: nowStr(),
    logs: [{ t: nowStr(), a: '预约成功' + (message ? '（含留言）' : ''), by: '居民' }] };
  db.appointments.push(a);
  iflog('出', 'RADTS_YYGH_HYSD', '统一号源池-号源锁定', { slotId: s.id, category: s.category }, { code: 0, lockId: 'LK' + a.id });
  iflog('出', 'RADTS_YYGH_YYGH', '统一号源池-预约挂号', { orgCode: H(s.hospitalId).code, doctorCode: d.code, date: s.date, period: s.period, category: s.category }, { code: 0, orderNo: a.no });
  const sched = d.schedule.map(x => '周' + '日一二三四五六'[x.weekday] + x.period).join('、');
  notify(u.id, '预约成功', '名医预约成功通知', `您已成功预约 ${H(s.hospitalId).short}·${D(s.deptId).name} ${d.name}（${catName(s.category)}）${s.date} ${s.period} ${s.time}，请携带身份证或医保卡按时就诊。`,
    a.message ? `您已预约${d.name}医生${s.date}${s.period}${s.time}号源，留言已转达医院。${d.name}医生坐诊排班：${sched}，如有变动将另行通知。` : null);
  save(); ok(res, apView(a));
}));
route('GET', '/api/appointments', needUser((req, res, q, p, u) => {
  ok(res, db.appointments.filter(a => a.userId === u.id).map(a => apView(a)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}));
route('POST', '/api/appointments/:id/cancel', needUser(async (req, res, q, p, u) => {
  const a = db.appointments.find(x => x.id === p.id && x.userId === u.id);
  if (!a) return fail(res, '记录不存在');
  if (a.status !== '待就诊') return fail(res, '当前状态不可取消');
  if (a.date <= today(0)) return fail(res, '就诊当天不可线上取消，请联系医院');
  const { reason } = await body(req);
  a.status = '已取消'; a.logs.push({ t: nowStr(), a: '居民取消预约' + (reason ? '：' + reason : ''), by: '居民' });
  const s = db.slots.find(x => x.id === a.slotId); if (s) s.used--;
  iflog('出', 'RADTS_YYGH_QXYY', '统一号源池-取消预约', { orderNo: a.no }, { code: 0 });
  notify(u.id, '取消预约', '预约取消成功', `您已取消 ${a.date} ${a.period} ${DOC(a.doctorId).name}医生的预约，挂号费将原路退回。`);
  save(); ok(res, apView(a));
}));
route('POST', '/api/appointments/:id/reschedule', needUser(async (req, res, q, p, u) => {
  const a = db.appointments.find(x => x.id === p.id && x.userId === u.id);
  if (!a || a.status !== '待就诊') return fail(res, '当前状态不可改约');
  if (a.date <= today(0)) return fail(res, '就诊当天不可改约');
  const { slotId } = await body(req);
  const s = db.slots.find(x => x.id === slotId);
  if (!s || s.doctorId !== a.doctorId) return fail(res, '只能改约同一医生的号源');
  if (s.category !== a.category) return fail(res, '只能在同一号源类别内改约');
  if (s.status !== '正常' || s.used >= s.total) return fail(res, '目标号源不可约');
  if (s.id === a.slotId) return fail(res, '与原时段相同');
  const old = db.slots.find(x => x.id === a.slotId); if (old) old.used--;
  s.used++;
  a.logs.push({ t: nowStr(), a: `改约：${a.date} ${a.period} ${a.time} → ${s.date} ${s.period} ${s.time}`, by: '居民' });
  Object.assign(a, { slotId: s.id, date: s.date, period: s.period, time: s.time });
  iflog('出', 'RADTS_YYGH_GY', '统一号源池-改约', { orderNo: a.no, newSlot: s.id }, { code: 0 });
  notify(u.id, '改约成功', '预约改约成功', `您的预约已改至 ${s.date} ${s.period} ${s.time}，${DOC(a.doctorId).name}医生。`);
  save(); ok(res, apView(a));
}));
route('POST', '/api/intents', needUser(async (req, res, q, p, u) => {
  const { doctorId, disease, expect, acceptOther, message } = await body(req);
  const d = DOC(doctorId); if (!d) return fail(res, '请选择目标名医');
  if (!(disease || '').trim()) return fail(res, '请填写就医需求/病情描述');
  if (db.intents.some(i => i.userId === u.id && i.doctorId === doctorId && i.status === '待受理')) return fail(res, '您对该名医已有待受理的预约需求');
  const it = { id: seq('I'), userId: u.id, doctorId, hospitalId: d.hospitalId, deptId: d.deptId, disease: disease.trim(), expect: expect || '尽快', acceptOther: !!acceptOther, message: (message || '').trim(), status: '待受理', reply: '', createdAt: nowStr() };
  db.intents.push(it);
  notify(u.id, '需求提交', '名医预约需求已提交', `您向 ${d.name}医生提交的预约需求已记录，医院将在 1-2 个工作日内受理并通过健康温州消息通知您。`);
  save(); ok(res, it);
}));
route('GET', '/api/intents', needUser((req, res, q, p, u) => {
  ok(res, db.intents.filter(i => i.userId === u.id).map(i => ({ ...i, doctorName: DOC(i.doctorId).name, hospitalName: H(i.hospitalId).name, deptName: D(i.deptId).name })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}));
route('POST', '/api/feedback', needUser(async (req, res, q, p, u) => {
  const { type, content, contact } = await body(req);
  if (!(content || '').trim() || content.trim().length < 5) return fail(res, '意见内容不少于 5 个字');
  const f = { id: seq('F'), userId: u.id, type: type || '其他', content: content.trim(), contact: contact || '', status: '待处理', reply: '', createdAt: nowStr() };
  db.feedback.push(f); save(); ok(res, f);
}));
route('GET', '/api/feedback', needUser((req, res, q, p, u) => ok(res, db.feedback.filter(f => f.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))));
route('GET', '/api/messages', needUser((req, res, q, p, u) => ok(res, { messages: db.messages.filter(m => m.userId === u.id).sort((a, b) => b.t.localeCompare(a.t)), sms: db.sms.filter(s => s.userId === u.id).map(s => ({ ...s, phone: maskPhone(s.phone) })) })));
route('POST', '/api/messages/read', needUser(async (req, res, q, p, u) => { db.messages.filter(m => m.userId === u.id).forEach(m => m.read = true); save(); ok(res, true); }));
route('GET', '/api/badge', needUser((req, res, q, p, u) => ok(res, { unread: db.messages.filter(m => m.userId === u.id && !m.read).length, upcoming: db.appointments.filter(a => a.userId === u.id && a.status === '待就诊').length })));

// ===== 机构端 / 管理后台 =====
route('POST', '/api/org/login', async (req, res) => {
  const { username, password, captcha, captchaAns } = await body(req);
  if (captcha !== undefined && String(captcha) !== String(captchaAns)) return fail(res, '验证码错误');
  const a = db.accounts.find(x => x.username === (username || '').trim().toLowerCase());
  if (!a || !verifyPwd(password || '', a.password)) return fail(res, '用户名或密码错误');
  if (a.disabled) return fail(res, '账号已停用');
  a.lastLogin = nowStr();
  ok(res, { token: newSession('staff', { username: a.username }), account: { username: a.username, role: a.role, name: a.name, hospitalId: a.hospitalId } });
});
function needStaff(fn, platformOnly) {
  return async (req, res, q, p) => {
    const s = auth(req, q, 'staff'); if (!s) return fail(res, '请先登录', 401);
    const a = db.accounts.find(x => x.username === s.username); if (!a) return fail(res, '请先登录', 401);
    if (platformOnly && a.role !== 'platform') return fail(res, '仅平台管理员可操作', 403);
    return fn(req, res, q, p, a);
  };
}
const scopeHosp = a => a.hospitalId ? [a.hospitalId] : db.hospitals.map(h => h.id);

route('GET', '/api/org/meta', needStaff((req, res, q, p, a) => {
  const hs = scopeHosp(a);
  ok(res, { account: { username: a.username, role: a.role, name: a.name, hospitalId: a.hospitalId },
    hospitals: db.hospitals.filter(h => hs.includes(h.id)).map(h => ({ id: h.id, name: h.name, short: h.short })),
    depts: db.depts.filter(d => hs.includes(d.hospitalId)), doctors: db.doctors.filter(d => hs.includes(d.hospitalId)).map(docBrief), dict: db.dict, today: today(0) });
}));
function filterAppts(q, a) {
  const hs = scopeHosp(a);
  const f = k => (q.get(k) || '').trim();
  let list = db.appointments.filter(x => hs.includes(x.hospitalId));
  if (f('hospitalId')) list = list.filter(x => x.hospitalId === f('hospitalId'));
  if (f('deptId')) list = list.filter(x => x.deptId === f('deptId'));
  if (f('doctorId')) list = list.filter(x => x.doctorId === f('doctorId'));
  if (f('doctor')) list = list.filter(x => DOC(x.doctorId).name.includes(f('doctor')));
  if (f('patient')) list = list.filter(x => U(x.userId).name.includes(f('patient')));
  if (f('from')) list = list.filter(x => x.date >= f('from'));
  if (f('to')) list = list.filter(x => x.date <= f('to'));
  if (f('status')) list = list.filter(x => x.status === f('status'));
  if (f('category')) list = list.filter(x => x.category === f('category'));
  if (q.get('hasMsg') === '1') list = list.filter(x => x.message);
  return list.sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
}
const rowView = x => { const v = apView(x, true); v.patientMasked = maskName(v.patientName); v.patientPhone = maskPhone(v.patientPhone); v.patientId = maskId(v.patientId); return v; };
route('GET', '/api/org/stats', needStaff((req, res, q, p, a) => {
  const list = filterAppts(q, a);
  const by = (keyFn, nameFn) => { const m = {}; for (const x of list) { const k = keyFn(x); m[k] = m[k] || { key: k, name: nameFn(x), total: 0, done: 0, wait: 0, cancel: 0, stop: 0, noshow: 0, msg: 0, fee: 0 }; const o = m[k]; o.total++; if (x.status === '已完成') { o.done++; o.fee += x.fee; } if (x.status === '待就诊') o.wait++; if (x.status === '已取消') o.cancel++; if (x.status === '停诊退号') o.stop++; if (x.status === '爽约') o.noshow++; if (x.message) o.msg++; } return Object.values(m).sort((a, b) => b.total - a.total); };
  const days = {}; for (const x of list) days[x.date] = (days[x.date] || 0) + 1;
  const page = +(q.get('page') || 1), size = +(q.get('size') || 15);
  ok(res, {
    summary: { total: list.length, done: list.filter(x => x.status === '已完成').length, wait: list.filter(x => x.status === '待就诊').length, cancel: list.filter(x => x.status === '已取消').length,
      stop: list.filter(x => x.status === '停诊退号').length, noshow: list.filter(x => x.status === '爽约').length, msg: list.filter(x => x.message).length, patients: new Set(list.map(x => x.userId)).size,
      doctors: new Set(list.map(x => x.doctorId)).size, intentsPending: db.intents.filter(i => scopeHosp(a).includes(i.hospitalId) && i.status === '待受理').length },
    byHospital: by(x => x.hospitalId, x => H(x.hospitalId).name), byDoctor: by(x => x.doctorId, x => DOC(x.doctorId).name + '（' + H(x.hospitalId).short + '·' + D(x.deptId).name + '）').slice(0, 30),
    byCategory: by(x => x.category, x => catName(x.category)), trend: Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])),
    rows: list.slice((page - 1) * size, page * size).map(rowView), count: list.length, page, size,
  });
}));
route('GET', '/api/org/msgs', needStaff((req, res, q, p, a) => {
  q.set('hasMsg', '1');
  const list = filterAppts(q, a).map(rowView);
  ok(res, list);
}));
function csvCell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
route('GET', '/api/org/msgs/export', needStaff((req, res, q, p, a) => {
  q.set('hasMsg', '1');
  let list = filterAppts(q, a);
  const ids = (q.get('ids') || '').split(',').filter(Boolean);
  if (ids.length) list = list.filter(x => ids.includes(x.id));
  const head = ['预约单号', '坐诊医院', '科室', '坐诊医生', '号源类别', '就诊日期', '时段', '患者姓名', '联系电话', '预约状态', '留言内容', '预约渠道', '提交时间'];
  const lines = [head.join(',')].concat(list.map(x => { const v = apView(x, true); return [v.no, v.hospitalName, v.deptName, v.doctorName, v.categoryName, v.date, v.period + ' ' + v.time, maskName(v.patientName), maskPhone(v.patientPhone), v.status, v.message, v.channel, v.createdAt].map(csvCell).join(','); }));
  iflog('内', 'EXPORT', '留言内容导出', { by: a.username, count: list.length }, { file: 'csv' });
  save();
  const fn = encodeURIComponent('名医预约留言_' + today(0) + '.csv');
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${fn}` });
  res.end('﻿' + lines.join('\r\n'));
}));
route('GET', '/api/org/intents', needStaff((req, res, q, p, a) => {
  const hs = scopeHosp(a);
  ok(res, db.intents.filter(i => hs.includes(i.hospitalId)).map(i => { const u = U(i.userId); return { ...i, patientName: maskName(u.name), patientPhone: maskPhone(u.phone), doctorName: DOC(i.doctorId).name, hospitalName: H(i.hospitalId).short, deptName: D(i.deptId).name }; }).sort((x, y) => y.createdAt.localeCompare(x.createdAt)));
}));
route('POST', '/api/org/intents/:id', needStaff(async (req, res, q, p, a) => {
  const it = db.intents.find(i => i.id === p.id && scopeHosp(a).includes(i.hospitalId)); if (!it) return fail(res, '记录不存在');
  const { status, reply } = await body(req);
  if (!['已受理', '已安排', '无法安排'].includes(status)) return fail(res, '状态不正确');
  it.status = status; it.reply = reply || ''; it.handledBy = a.name; it.handledAt = nowStr();
  const d = DOC(it.doctorId);
  notify(it.userId, '意向' + status, '名医预约需求' + status, `您向 ${d.name}医生提交的预约需求${status}。${reply || ''}`, status === '无法安排' ? `您向${d.name}医生提交的预约需求暂无法安排：${reply || '名医近期无可用排班'}，可在名医温州选择其他名医。` : null);
  save(); ok(res, it);
}));
route('GET', '/api/org/stops', needStaff((req, res, q, p, a) => {
  const hs = scopeHosp(a);
  ok(res, db.stops.filter(s => hs.includes(s.hospitalId)).map(s => ({ ...s, doctorName: DOC(s.doctorId).name, hospitalName: H(s.hospitalId).short, deptName: D(DOC(s.doctorId).deptId).name })));
}));
route('GET', '/api/org/schedule', needStaff((req, res, q, p, a) => {
  const d = DOC(q.get('doctorId')); if (!d || !scopeHosp(a).includes(d.hospitalId)) return fail(res, '医生不存在');
  const t = today(0);
  const m = {};
  for (const s of db.slots.filter(s => s.doctorId === d.id && s.date >= t)) { const k = s.date + '|' + s.period; m[k] = m[k] || { date: s.date, period: s.period, total: 0, used: 0, status: s.status }; m[k].total += s.total; m[k].used += s.used; if (s.status === '停诊') m[k].status = '停诊'; }
  ok(res, Object.values(m).sort((x, y) => (x.date + x.period).localeCompare(y.date + y.period)));
}));
route('POST', '/api/org/stop', needStaff(async (req, res, q, p, a) => {
  const { doctorId, date, period, reason } = await body(req);
  const d = DOC(doctorId); if (!d || !scopeHosp(a).includes(d.hospitalId)) return fail(res, '无权操作该医生');
  if (!reason) return fail(res, '请填写停诊原因');
  const r = doStop({ doctorId, date, period, reason, source: '机构端', operator: a.name });
  if (r.error) return fail(res, r.error);
  iflog('入', 'RADTS_YYGH_TZ_TINGZHEN', '停诊通知（机构端发起）', { orgCode: H(d.hospitalId).code, doctorCode: d.code, date, period, reason }, { code: 0, affected: r.affected });
  save(); ok(res, r);
}));

// 管理后台（平台）
route('GET', '/api/admin/overview', needStaff((req, res) => {
  ok(res, { regions: db.regions.length, hospitals: db.hospitals.length, doctors: db.doctors.length, users: db.users.length, appts: db.appointments.length,
    feedbackPending: db.feedback.filter(f => f.status === '待处理').length, iflogs: db.iflogs.length, stops: db.stops.length, seededAt: db.meta.seededAt });
}, true));
route('GET', '/api/admin/regions', needStaff((req, res) => ok(res, { regions: db.regions, settings: db.settings }), true));
route('POST', '/api/admin/regions', needStaff(async (req, res) => {
  const b = await body(req);
  if (!b.name) return fail(res, '名称不能为空');
  let r = db.regions.find(x => x.id === b.id);
  if (!r) { r = { id: 'R' + String(db.regions.length + 1).padStart(2, '0') }; db.regions.push(r); }
  Object.assign(r, { name: b.name, area: b.area || '', intro: b.intro || '', banner: b.banner || '' });
  save(); ok(res, r);
}, true));
route('POST', '/api/admin/settings', needStaff(async (req, res) => { const b = await body(req); Object.assign(db.settings, { notice: b.notice ?? db.settings.notice, bookRule: b.bookRule ?? db.settings.bookRule }); save(); ok(res, db.settings); }, true));
route('GET', '/api/admin/hospitals', needStaff((req, res) => ok(res, db.hospitals.map(h => ({ ...h, doctorCount: db.doctors.filter(d => d.hospitalId === h.id).length, depts: db.depts.filter(d => d.hospitalId === h.id) }))), true));
route('POST', '/api/admin/hospitals', needStaff(async (req, res) => {
  const b = await body(req); const h = H(b.id); if (!h) return fail(res, '机构不存在');
  for (const k of ['name', 'short', 'region', 'level', 'addr', 'phone', 'intro']) if (b[k] !== undefined) h[k] = b[k];
  if (b.enabled !== undefined) h.enabled = !!b.enabled;
  save(); ok(res, h);
}, true));
route('GET', '/api/admin/doctors', needStaff((req, res, q) => {
  let list = db.doctors.map(d => ({ ...docBrief(d), enabled: d.enabled, intro: d.intro, licenseNo: d.licenseNo, schedule: d.schedule, honor: d.honor, updatedAt: d.updatedAt }));
  if (q.get('q')) list = list.filter(d => (d.name + d.hospitalName + d.deptName).includes(q.get('q')));
  if (q.get('hospitalId')) list = list.filter(d => d.hospitalId === q.get('hospitalId'));
  ok(res, list);
}, true));
route('POST', '/api/admin/doctors', needStaff(async (req, res) => {
  const b = await body(req);
  if (!b.name || !b.hospitalId || !b.deptId) return fail(res, '姓名、机构、科室必填');
  if (!D(b.deptId) || D(b.deptId).hospitalId !== b.hospitalId) return fail(res, '科室与机构不匹配');
  let d = DOC(b.id);
  if (!d) { const n = db.doctors.length + 1; d = { id: 'Y' + String(n).padStart(4, '0') + 'N', code: 'YS' + (200000 + n), licenseNo: b.licenseNo || '110330300000000', practiceYears: 20, avatarColor: '#0e7c86', services: ['预约挂号', '名医预约需求'], schedule: [], gender: '男', enabled: true }; db.doctors.push(d); }
  for (const k of ['name', 'gender', 'title', 'mylb', 'hyCategory', 'honor', 'intro', 'licenseNo', 'hospitalId', 'deptId']) if (b[k] !== undefined) d[k] = b[k];
  if (b.specialty !== undefined) d.specialty = Array.isArray(b.specialty) ? b.specialty : String(b.specialty).split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  if (b.fee !== undefined) d.fee = +b.fee;
  if (b.enabled !== undefined) d.enabled = !!b.enabled;
  if (b.schedule) d.schedule = b.schedule;
  d.updatedAt = nowStr();
  iflog('入', '02_01_01_08', '医生介绍信息同步（含名医类别字段）', { doctorCode: d.code, name: d.name, MYLB: d.mylb }, { code: 0 });
  save(); ok(res, d);
}, true));
route('GET', '/api/admin/slots', needStaff((req, res, q) => {
  const t = today(0);
  let list = db.slots.filter(s => s.date >= (q.get('from') || t) && s.date <= (q.get('to') || today(14)));
  if (q.get('hospitalId')) list = list.filter(s => s.hospitalId === q.get('hospitalId'));
  if (q.get('doctorId')) list = list.filter(s => s.doctorId === q.get('doctorId'));
  if (q.get('category')) list = list.filter(s => s.category === q.get('category'));
  if (q.get('status')) list = list.filter(s => s.status === q.get('status'));
  ok(res, list.slice(0, 400).map(s => ({ ...s, doctorName: DOC(s.doctorId).name, hospitalName: H(s.hospitalId).short, deptName: D(s.deptId).name, categoryName: catName(s.category) })));
}, true));
route('POST', '/api/admin/slots', needStaff(async (req, res) => {
  const b = await body(req);
  if (b.id) {
    const s = db.slots.find(x => x.id === b.id); if (!s) return fail(res, '号源不存在');
    if (b.total !== undefined) { if (+b.total < s.used) return fail(res, '号源总数不能小于已约数'); s.total = +b.total; }
    if (b.category) s.category = b.category;
    if (b.fee !== undefined) s.fee = +b.fee;
    if (b.status && b.status !== s.status) { if (b.status === '停诊') return fail(res, '停诊请走停诊通知流程'); s.status = b.status; }
    iflog('入', 'RADTS_YYGH_HYWH', '号源池维护-号源调整', { slotId: s.id, total: s.total, category: s.category }, { code: 0 });
    save(); return ok(res, s);
  }
  const d = DOC(b.doctorId); if (!d) return fail(res, '请选择医生');
  if (!b.date || b.date < today(0)) return fail(res, '日期不正确');
  const segs = { '上午': ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-11:30'], '下午': ['13:30-14:30', '14:30-15:30', '15:30-16:30', '16:30-17:00'] }[b.period];
  if (!segs) return fail(res, '时段不正确');
  if (db.slots.some(s => s.doctorId === d.id && s.date === b.date && s.period === b.period)) return fail(res, '该医生该时段已有号源');
  const created = segs.map(t => { const s = { id: 'S' + crypto.randomBytes(4).toString('hex'), doctorId: d.id, hospitalId: d.hospitalId, deptId: d.deptId, date: b.date, period: b.period, time: t, category: b.category || d.hyCategory, fee: +(b.fee || d.fee), total: +(b.total || 3), used: 0, status: '正常' }; db.slots.push(s); return s; });
  iflog('入', 'RADTS_YYGH_HYWH', '号源池维护-新增号源', { doctorCode: d.code, date: b.date, period: b.period, n: created.length }, { code: 0 });
  // 通知关注者
  for (const f of db.follows.filter(f => f.doctorId === d.id)) notify(f.userId, '关注动态', '关注名医新增号源', `您关注的 ${d.name}（${H(d.hospitalId).short}）新增 ${b.date} ${b.period} 号源，欢迎预约。`);
  d.updatedAt = nowStr();
  save(); ok(res, created);
}, true));
route('GET', '/api/admin/feedback', needStaff((req, res) => ok(res, db.feedback.map(f => ({ ...f, user: maskName((U(f.userId) || {}).name), phone: maskPhone((U(f.userId) || {}).phone) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))), true));
route('POST', '/api/admin/feedback/:id', needStaff(async (req, res, q, p) => {
  const f = db.feedback.find(x => x.id === p.id); if (!f) return fail(res, '不存在');
  const { reply } = await body(req); if (!reply) return fail(res, '请填写回复');
  f.reply = reply; f.status = '已回复'; f.repliedAt = nowStr();
  notify(f.userId, '意见回复', '您的优化意见已回复', reply);
  save(); ok(res, f);
}, true));
route('GET', '/api/admin/accounts', needStaff((req, res) => ok(res, db.accounts.map(a => ({ username: a.username, role: a.role, name: a.name, hospitalId: a.hospitalId, hospitalName: a.hospitalId ? H(a.hospitalId).name : '全部', disabled: !!a.disabled, lastLogin: a.lastLogin || '' }))), true));
route('POST', '/api/admin/accounts', needStaff(async (req, res) => {
  const b = await body(req);
  const u = (b.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) return fail(res, '用户名 3-20 位字母数字');
  let a = db.accounts.find(x => x.username === u);
  if (!a) { if (!b.password) return fail(res, '新账号需设置密码'); a = { username: u, role: 'org' }; db.accounts.push(a); }
  if (b.name) a.name = b.name;
  if (b.hospitalId !== undefined) a.hospitalId = b.hospitalId || null;
  if (b.password) a.password = hashPwd(b.password);
  if (b.disabled !== undefined) a.disabled = !!b.disabled;
  save(); ok(res, true);
}, true));
route('GET', '/api/admin/iflogs', needStaff((req, res) => ok(res, db.iflogs.slice(0, 200)), true));
route('POST', '/api/admin/reset', needStaff((req, res) => { reseed(); ok(res, true); }, true));
route('POST', '/api/admin/ping', needStaff(async (req, res) => {
  const { target } = await body(req);
  const map = { HW_MSG: '健康温州消息平台', SMS: '短信平台', POOL: '统一号源池平台', HIS: '医院HIS预约接口', GA: '公安实名核验服务' };
  const ms = 15 + Math.floor(Math.random() * 90);
  iflog('出', 'PING_' + target, '联调测试-' + (map[target] || target), { target }, { code: 0, ms });
  save(); ok(res, { name: map[target] || target, ok: true, ms });
}, true));

// ===== 第三方调用接口（开放接口）=====
function needKey(fn) { return async (req, res, q, p) => { if ((req.headers['x-app-key'] || q.get('appKey')) !== OPEN_APPKEY) return send(res, 401, { code: 401, msg: 'appKey 无效' }); return fn(req, res, q, p); }; }
route('GET', '/open/dict/hy-category', needKey((req, res) => {
  const r = { code: 0, data: { categories: db.dict.hyCategory.map(({ code, name, desc }) => ({ HYLBDM: code, HYLBMC: name, SM: desc })), transactions: db.dict.hyTransactions.map(t => ({ JYDM: t.code, JYMC: t.name, BZ: t.note })) } };
  iflog('入', 'DICT_HYLB', '号源类别字典查询', {}, { n: 4 }); save(); send(res, 200, r);
}));
route('POST', '/open/02_01_01_08', needKey(async (req, res) => {
  const b = await body(req);
  let list = db.doctors.filter(d => d.enabled);
  if (b.YLJGDM) list = list.filter(d => H(d.hospitalId).code === b.YLJGDM);
  if (b.KSDM) list = list.filter(d => D(d.deptId).code === b.KSDM);
  if (b.YSDM) list = list.filter(d => d.code === b.YSDM);
  const data = list.map(d => ({ YLJGDM: H(d.hospitalId).code, YLJGMC: H(d.hospitalId).name, KSDM: D(d.deptId).code, KSMC: D(d.deptId).name, YSDM: d.code, YSXM: d.name, XB: d.gender, ZC: d.title, SC: d.specialty.join('、'), JJ: d.intro, MYLB: d.mylb, MYLBMC: mylbName(d.mylb), HYLB: d.hyCategory }));
  iflog('入', '02_01_01_08', '医生介绍信息查询（新增名医类别字段 MYLB）', b, { n: data.length }); save();
  send(res, 200, { code: 0, total: data.length, data });
}));
route('POST', '/open/RADTS_YYGH_TZ_TINGZHEN', needKey(async (req, res) => {
  const b = await body(req);
  const h = db.hospitals.find(x => x.code === b.YLJGDM);
  const d = h && db.doctors.find(x => x.code === b.YSDM && x.hospitalId === h.id);
  if (!d) { const r = { code: 1001, msg: '医疗机构或医生代码不存在' }; iflog('入', 'RADTS_YYGH_TZ_TINGZHEN', '停诊通知', b, r, false); save(); return send(res, 200, r); }
  const period = { '1': '上午', '2': '下午', '0': '全天' }[String(b.SJD)] || b.SJD || '全天';
  const r = doStop({ doctorId: d.id, date: b.TZRQ, period, reason: b.TZYY || '医院停诊', source: '第三方接口 RADTS_YYGH_TZ_TINGZHEN', operator: '医院HIS' });
  const out = r.error ? { code: 1002, msg: r.error } : { code: 0, msg: '停诊处理成功', data: { TZLSH: r.record.id, YXYYS: r.affected, TZFS: '健康温州消息+短信' } };
  iflog('入', 'RADTS_YYGH_TZ_TINGZHEN', '停诊通知', b, out, !r.error); save();
  send(res, 200, out);
}));
route('POST', '/open/mingyi-doctor-intro', needKey(async (req, res) => {
  const b = await body(req);
  let list = db.doctors.filter(d => d.enabled);
  if (b.YLJGDM) list = list.filter(d => H(d.hospitalId).code === b.YLJGDM);
  if (b.KSDM) list = list.filter(d => D(d.deptId).code === b.KSDM);
  const data = list.map(d => { const x = docBrief(d); return { YLJGDM: H(d.hospitalId).code, YLJGMC: x.hospitalName, KSDM: D(d.deptId).code, KSMC: x.deptName, YSDM: d.code, YSXM: d.name, ZC: d.title, MYLB: d.mylb, MYLBMC: x.mylbName, HYLB: d.hyCategory, YWPB: x.hasSchedule ? '1' : '0', SYHY: x.remain, ZZSJ: x.scheduleText }; });
  iflog('入', 'MY_YSJS_CX', '【名医医生介绍】查询', b, { n: data.length }); save();
  send(res, 200, { code: 0, total: data.length, data });
}));
route('GET', '/open/meta', (req, res) => { const ex = db.slots.find(s => s.date > today(1) && s.status === '正常' && db.slots.filter(x => x.doctorId === s.doctorId && x.date === s.date && x.status === '正常').length === 4); ok(res, { appKey: OPEN_APPKEY, example: ex ? { YLJGDM: H(ex.hospitalId).code, YSDM: DOC(ex.doctorId).code, TZRQ: ex.date, SJD: ex.period === '上午' ? '1' : '2', name: DOC(ex.doctorId).name } : null, hospitals: db.hospitals.map(h => ({ code: h.code, name: h.name, depts: db.depts.filter(d => d.hospitalId === h.id).map(d => ({ code: d.code, name: d.name })), doctors: db.doctors.filter(d => d.hospitalId === h.id).map(d => ({ code: d.code, name: d.name, dept: D(d.deptId).name })) })) }); });

// ---------- 启动 ----------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = decodeURIComponent(u.pathname);
  if (p.startsWith('/api/') || p.startsWith('/open/')) {
    for (const r of routes) {
      if (r.m !== req.method) continue;
      const m = p.match(r.re);
      if (m) { try { return await r.fn(req, res, u.searchParams, m.groups || {}); } catch (e) { console.error(e); return fail(res, '服务异常：' + e.message, 500); } }
    }
    return fail(res, '接口不存在', 404);
  }
  if (req.method !== 'GET') return fail(res, 'method not allowed', 405);
  serveStatic(req, res, p);
});
load();
server.listen(PORT, () => console.log('名医温州 DEMO 运行于 http://localhost:' + PORT));
