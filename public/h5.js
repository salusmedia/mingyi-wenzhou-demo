// 名医温州 · 居民端（健康温州公众号/小程序 H5）
const $ = s => document.querySelector(s);
let app = $('#app');
const TK = 'mywz_token';
const store = { get tk() { try { return localStorage.getItem(TK) || ''; } catch { return ''; } }, set tk(v) { try { v ? localStorage.setItem(TK, v) : localStorage.removeItem(TK); } catch {} } };
const CHANNEL = new URLSearchParams(location.search).get('from') === 'gzh' ? '健康温州公众号' : '健康温州小程序';
let HOME = null, ME = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = '日一二三四五六';
const cnDay = d => { const t = new Date(d + 'T00:00:00'); return { md: (t.getMonth() + 1) + '/' + t.getDate(), wd: '周' + WD[t.getDay()] }; };
const todayStr = (o = 0) => { const d = new Date(Date.now() + o * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

let RID = 0;
async function api(path, opt = {}) {
  const rid = RID;
  const r = await fetch(path, { method: opt.body ? 'POST' : (opt.method || 'GET'), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + store.tk, 'X-Channel': CHANNEL === '健康温州公众号' ? 'gzh' : 'mp' }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const j = await r.json().catch(() => ({ code: -1, msg: '网络异常' }));
  if (rid !== RID && !opt.body) throw new Error('stale');
  if (j.code === 401) { store.tk = ''; ME = null; if (!opt.silent) { go('/login?back=' + encodeURIComponent(location.hash.slice(1))); throw new Error('401'); } }
  if (j.code !== 0) { if (!opt.silent) toast(j.msg || '操作失败'); throw new Error(j.msg); }
  return j.data;
}
function toast(m, ms = 1800) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function go(h) { location.hash = h; }
function back() { history.length > 1 ? history.back() : go('/home'); }
function confirmBox(title, text, okText = '确定') {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'mask center';
    m.innerHTML = `<div class="dialog"><b>${esc(title)}</b><p>${text}</p><div class="bs"><button class="btn gray" data-v="0">取消</button><button class="btn" data-v="1">${okText}</button></div></div>`;
    m.onclick = e => { const v = e.target.dataset.v; if (v !== undefined) { m.remove(); res(v === '1'); } };
    document.body.appendChild(m);
  });
}
function sheet(html, onMount) {
  const m = document.createElement('div'); m.className = 'mask';
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
  document.body.appendChild(m); onMount && onMount(m); return m;
}
const hd = (t, opt = {}) => `<div class="hd">${opt.noback ? '' : '<button class="bk" onclick="back()">‹</button>'}${esc(t)}${opt.rt || ''}</div>`;
function avatar(d, size = 56) {
  const s = d.name[0];
  return `<div class="av" style="width:${size}px;height:${size}px;background:${d.avatarColor};font-size:${size * .4}px"><svg viewBox="0 0 56 56"><circle cx="28" cy="66" r="30" fill="rgba(255,255,255,.18)"/></svg><span>${esc(s)}</span></div>`;
}
const mylbTag = d => `<span class="tag ${d.mylb === '1' ? 'gold' : d.mylb === '4' ? 'org' : d.mylb === '2' ? 'blue' : ''}">${esc(d.mylbName)}</span>`;
const stCls = s => ({ '待就诊': 'wait', '已完成': 'done', '已取消': 'cancel', '停诊退号': 'stop', '爽约': 'cancel' }[s] || '');
function docRow(d, opt = {}) {
  return `<div class="doc" data-doc="${d.id}">
    <a href="#/doctor/${d.id}">${avatar(d)}</a>
    <div class="bd" onclick="go('/doctor/${d.id}')">
      <div class="nm">${esc(d.name)}<small>${esc(d.title)}</small></div>
      <div class="h">${esc(d.hospitalShort)} · ${esc(d.deptName)}</div>
      <div>${mylbTag(d)}<span class="tag gray">${esc(d.hyCategoryName)}</span></div>
      <div class="sp" style="margin-top:4px">擅长：${esc(d.specialty.join('、'))}</div>
    </div>
    <div class="op">
      <span class="remain ${d.remain ? '' : 'no'}">${d.remain ? '余号 ' + d.remain : '暂无号'}</span>
      ${d.remain ? `<button class="btn sm" onclick="go('/book/${d.id}')">预约</button>` : `<button class="btn sm ghost" onclick="go('/intent/${d.id}')">提需求</button>`}
    </div></div>`;
}
let badge = { unread: 0, upcoming: 0 };
async function refreshBadge() { if (!store.tk) { badge = { unread: 0, upcoming: 0 }; return; } try { badge = await api('/api/badge', { silent: true }); } catch {} }
function tabbar(on) {
  app.classList.remove('nobar');
  return `<nav class="tabbar">
    <a href="#/home" class="${on === 'home' ? 'on' : ''}"><i>⌂</i>首页</a>
    <a href="#/search" class="${on === 'search' ? 'on' : ''}"><i>⌕</i>找名医</a>
    <a href="#/records" class="${on === 'records' ? 'on' : ''}"><i>▤</i>预约记录${badge.upcoming ? `<em>${badge.upcoming}</em>` : ''}</a>
    <a href="#/me" class="${on === 'me' ? 'on' : ''}"><i>☺</i>我的${badge.unread ? `<em>${badge.unread}</em>` : ''}</a></nav>`;
}
async function needLogin() { if (!store.tk) { go('/login?back=' + encodeURIComponent(location.hash.slice(1))); return false; } if (!ME) { try { ME = await api('/api/me'); } catch { return false; } } return true; }

// ========= 页面 =========
const P = {};

P.home = async () => {
  HOME = HOME || await api('/api/home');
  await refreshBadge();
  const region = sessionStorage.getItem('region') || '';
  const hs = await api('/api/hospitals' + (region ? '?region=' + region : ''));
  const recs = (await api('/api/doctors?hasSlot=1' + (region ? '&region=' + region : ''))).slice(0, 5);
  const r = HOME.regions.find(x => x.id === region);
  app.innerHTML = `
  <div class="hero"><div class="top"><div class="logo"><i>名</i><div>名医温州<span class="from">健康温州 · ${CHANNEL.slice(4)}</span></div></div><span class="loc">📍 温州市</span></div>
    <div class="search" onclick="go('/search')"><span>⌕</span><input placeholder="搜索医生姓名、科室、医院、疾病" readonly></div></div>
  <div class="grid">
    <a href="#/reg"><b style="background:#0b7a75">挂</b>预约挂号</a>
    <a href="#/search?focus=1"><b style="background:#2f6fde">搜</b>医生搜索</a>
    <a href="#/intent"><b style="background:#e8833a">需</b>安排医生</a>
    <a href="#/follows"><b style="background:#b8456b">★</b>我的关注</a>
    <a href="#/records"><b style="background:#7b5bd6">录</b>预约记录${badge.upcoming ? `<em>${badge.upcoming}</em>` : ''}</a>
    <a href="#/messages"><b style="background:#2c8a4b">信</b>消息通知${badge.unread ? `<em>${badge.unread}</em>` : ''}</a>
    <a href="#/feedback"><b style="background:#c0663a">议</b>优化意见</a>
    <a href="#/intents"><b style="background:#4f7b8a">单</b>我的需求</a>
  </div>
  <div class="notice">📢 <span>${esc(HOME.settings.notice)}</span></div>
  <div class="sec"><div class="sec-t">各地名医汇<small>${HOME.regions.length} 个地区</small></div>
    <div class="rtabs"><button class="${!region ? 'on' : ''}" data-r="">全部</button>${HOME.regions.map(x => `<button class="${x.id === region ? 'on' : ''}" data-r="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    ${r ? `<div class="rcard"><b>${esc(r.name)} · ${esc(r.banner)}</b>${esc(r.intro)}<div class="muted" style="margin-top:4px">覆盖 ${esc(r.area)} · ${r.hospitalCount} 家机构 · ${r.doctorCount} 位名医</div></div>`
      : `<div class="rcard"><b>温州名医汇 · 区域名医一网通约</b>汇聚全市 ${HOME.regions.reduce((a, x) => a + x.hospitalCount, 0)} 家医疗机构 ${HOME.regions.reduce((a, x) => a + x.doctorCount, 0)} 位名医，统一号源池、统一预约入口。</div>`}
  </div>
  <div class="sec"><div class="sec-t">预约列表<small>点击机构进入名医预约</small></div>
    ${hs.map(h => `<div class="hosp" onclick="go('/hospital/${h.id}')"><div class="ic">${esc(h.short.slice(0, 2))}</div><div class="bd">
      <div class="nm">${esc(h.name)}</div><div class="muted"><span class="tag">${esc(h.level)}</span>${esc(h.regionName)} · 名医 ${h.doctorCount} 位 · <span style="color:var(--c)">余号 ${h.remain}</span></div>
      <div class="chips">${h.depts.map(d => `<span>${esc(d.name)} ${d.count}</span>`).join('')}</div></div></div>`).join('')}
  </div>
  <div class="sec"><div class="sec-t">近期可约名医<small onclick="go('/search?hasSlot=1')">更多 ›</small></div>${recs.map(d => docRow(d)).join('')}</div>
  <div class="muted" style="text-align:center;padding:10px 0 4px">温州市卫生健康委员会 · 健康温州 主办<br>演示数据，医生与患者均为虚构</div>
  ${tabbar('home')}`;
  app.querySelectorAll('.rtabs button').forEach(b => b.onclick = () => { sessionStorage.setItem('region', b.dataset.r); render(); });
};

P.hospital = async (id) => {
  const h = await api('/api/hospital/' + id);
  let cur = sessionStorage.getItem('dept_' + id) || h.depts[0]?.id;
  const draw = () => {
    const dp = h.depts.find(x => x.id === cur) || h.depts[0];
    app.querySelector('.dlist').innerHTML = `<div class="l">${h.depts.map(x => `<button data-d="${x.id}" class="${x.id === dp.id ? 'on' : ''}">${esc(x.name)}<br><small class="muted">名医 ${x.doctors.length}</small></button>`).join('')}</div><div class="r">${dp.doctors.map(d => docRow(d)).join('')}</div>`;
    app.querySelectorAll('.dlist .l button').forEach(b => b.onclick = () => { cur = b.dataset.d; sessionStorage.setItem('dept_' + id, cur); draw(); });
  };
  app.classList.add('nobar');
  app.innerHTML = `${hd(h.short + ' · 名医预约')}
  <div class="sec"><div style="display:flex;gap:12px;align-items:center"><div class="hosp" style="padding:0;border:0"><div class="ic">${esc(h.short.slice(0, 2))}</div></div><div><b style="font-size:16px">${esc(h.name)}</b><div class="muted"><span class="tag">${esc(h.level)}</span>${esc(h.regionName)}</div></div></div>
    <p class="muted" style="margin-top:8px;font-size:13px;color:#4b585e">${esc(h.intro)}</p>
    <div class="muted" style="margin-top:6px">📍 ${esc(h.addr)}　☎ ${esc(h.phone)}</div></div>
  <div class="dlist"></div>`;
  draw();
};

P.search = async (q) => {
  const p = new URLSearchParams(q);
  const depts = await api('/api/depts');
  let kw = p.get('q') || '', mylb = p.get('mylb') || '', hasSlot = p.get('hasSlot') || '';
  const hist = JSON.parse(localStorage.getItem('mywz_hist') || '[]');
  app.innerHTML = `${hd('医生搜索')}
  <div style="padding:10px 12px;background:#fff"><div class="search" style="margin:0;background:#f1f4f5"><span>⌕</span><input id="kw" placeholder="医生姓名 / 科室 / 医院 / 疾病，空格分隔多条件" value="${esc(kw)}"><button id="sbtn" style="color:var(--c)">搜索</button></div></div>
  <div class="filters"><button data-f="mylb" data-v="">全部类别</button><button data-f="mylb" data-v="1">国家级名医</button><button data-f="mylb" data-v="2">省级名医</button><button data-f="mylb" data-v="3">市级名医</button><button data-f="mylb" data-v="4">名中医</button><button data-f="hasSlot" data-v="1">仅看有号</button></div>
  <div id="res"></div>${tabbar('search')}`;
  const res = $('#res');
  const sync = () => app.querySelectorAll('.filters button').forEach(b => b.classList.toggle('on', b.dataset.f === 'mylb' ? b.dataset.v === mylb : hasSlot === '1'));
  async function run() {
    sync();
    if (!kw && !mylb && !hasSlot) {
      res.innerHTML = `${hist.length ? `<div class="sec"><div class="sec-t">搜索历史<small id="clr">清空</small></div><div class="hot">${hist.map(h => `<button data-k="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>` : ''}
      <div class="sec"><div class="sec-t">按科室找名医</div><div class="hot">${depts.map(d => `<button data-k="${esc(d)}">${esc(d)}</button>`).join('')}</div></div>
      <div class="sec"><div class="sec-t">热门搜索</div><div class="hot">${['高血压', '肺结节', '糖尿病', '关节置换', '失眠', '儿童哮喘', '甲状腺', '名中医'].map(d => `<button data-k="${d}">${d}</button>`).join('')}</div></div>`;
      res.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kw = b.dataset.k; $('#kw').value = kw; run(); });
      const c = $('#clr'); if (c) c.onclick = () => { localStorage.removeItem('mywz_hist'); hist.length = 0; run(); };
      return;
    }
    if (kw && !hist.includes(kw)) { hist.unshift(kw); hist.length = Math.min(hist.length, 8); localStorage.setItem('mywz_hist', JSON.stringify(hist)); }
    const list = await api(`/api/doctors?q=${encodeURIComponent(kw)}&mylb=${mylb}&hasSlot=${hasSlot}`);
    res.innerHTML = `<div class="muted" style="padding:10px 14px 0">共找到 ${list.length} 位名医${kw ? '（关键词：' + esc(kw) + '）' : ''}</div>` + (list.length ? `<div class="sec">${list.map(d => docRow(d)).join('')}</div>` : `<div class="empty"><b>⌕</b>没有找到相关名医，换个关键词试试</div>`);
  }
  $('#sbtn').onclick = () => { kw = $('#kw').value.trim(); run(); };
  $('#kw').onkeydown = e => { if (e.key === 'Enter') { kw = e.target.value.trim(); run(); } };
  app.querySelectorAll('.filters button').forEach(b => b.onclick = () => { if (b.dataset.f === 'mylb') mylb = b.dataset.v; else hasSlot = hasSlot ? '' : '1'; run(); });
  if (p.get('focus')) setTimeout(() => $('#kw').focus(), 50);
  run();
};

P.doctor = async (id) => {
  const d = await api('/api/doctor/' + id, { silent: true }).catch(e => { if (e.message === 'stale') throw e; return null; });
  if (!d) { app.innerHTML = hd('医生信息') + '<div class="empty"><b>?</b>医生不存在或已下线</div>'; return; }
  const days = [...new Set(d.slots.map(s => s.date))];
  const wkRows = ['上午', '下午'].map(pp => `<div>${pp}</div>` + [1, 2, 3, 4, 5, 6, 0].map(w => `<div class="${d.schedule.some(s => s.weekday === w && s.period === pp) ? 'on' : ''}">${d.schedule.some(s => s.weekday === w && s.period === pp) ? '坐诊' : ''}</div>`).join('')).join('');
  app.classList.add('nobar');
  app.innerHTML = `<div class="hd tr"><button class="bk" onclick="back()">‹</button></div>
  <div class="dhead"><div class="row">${avatar(d, 72)}<div><div class="nm">${esc(d.name)}<small>${esc(d.title)}</small></div><div class="h">${esc(d.hospitalName)} · ${esc(d.deptName)}</div>
    <div class="tags"><span class="tag gold">${esc(d.mylbName)}</span><span class="tag">${esc(d.honor)}</span></div></div></div>
    <div class="acts"><button id="fol" class="${d.followed ? 'on' : ''}">${d.followed ? '✓ 已关注' : '+ 关注'}</button><button id="shr">↗ 分享</button></div></div>
  <div class="stat3"><div><b>${d.practiceYears}年</b><span>从业经验</span></div><div><b>${d.remain}</b><span>14天内余号</span></div><div><b id="fcnt">${d.followers}</b><span>关注人数</span></div></div>
  ${d.stops.length ? `<div class="notice" style="background:#fde8e8;color:var(--red)">⚠ 停诊公告：${d.stops.map(s => `${s.date} ${s.period}（${esc(s.reason)}）`).join('；')}</div>` : ''}
  <div class="sec"><div class="sec-t">相关问诊服务</div><div class="svc">
    <button onclick="go('/book/${d.id}')"><b style="color:var(--c)">挂</b>预约挂号</button>
    <button onclick="go('/intent/${d.id}')"><b style="color:var(--acc)">需</b>名医预约需求</button>
    <button onclick="toast('${esc(d.services[2])}将跳转至医院互联网医院（演示）')"><b style="color:#7b5bd6">诊</b>${esc(d.services[2])}</button></div></div>
  <div class="sec"><div class="sec-t">坐诊时间<small>${esc(d.scheduleText)}</small></div>
    <div class="wk"><div></div>${[1, 2, 3, 4, 5, 6, 0].map(w => `<div>周${WD[w]}</div>`).join('')}${wkRows}</div>
    <div style="margin-top:12px" class="dates">${days.map(dt => { const ss = d.slots.filter(s => s.date === dt); const rm = ss.filter(s => s.status === '正常').reduce((a, s) => a + s.remain, 0); const stop = ss.every(s => s.status === '停诊'); const c = cnDay(dt); return `<button class="${stop ? 'stop' : rm ? '' : 'full'}" onclick="go('/book/${d.id}?date=${dt}')">${c.wd}<b>${c.md}</b><i>${stop ? '停诊' : rm ? '余' + rm : '约满'}</i></button>`; }).join('') || '<span class="muted">近 14 天暂无排班，可提交名医预约需求</span>'}</div></div>
  <div class="sec"><div class="sec-t">执业资质</div>
    <div class="kv"><span>执业机构</span>${esc(d.hospitalName)}</div><div class="kv"><span>执业科室</span>${esc(d.deptName)}</div>
    <div class="kv"><span>专业技术职称</span>${esc(d.title)}</div><div class="kv"><span>执业证编号</span>${esc(d.licenseNo)} <span class="tag" style="margin-left:6px;width:auto">已核验</span></div>
    <div class="kv"><span>名医类别</span>${esc(d.mylbName)}</div><div class="kv"><span>号源类别</span>${esc(d.hyCategoryName)} · ¥${d.fee}</div></div>
  <div class="sec"><div class="sec-t">擅长领域</div><div class="hot">${d.specialty.map(s => `<span class="tag" style="font-size:13px;padding:2px 10px">${esc(s)}</span>`).join('')}</div></div>
  <div class="sec"><div class="sec-t">医生介绍<small>更新于 ${esc(d.updatedAt.slice(0, 10))}</small></div><p style="font-size:14px;color:#4b585e;line-height:1.8">${esc(d.intro)}</p></div>
  <div style="height:70px"></div>
  <div class="foot"><button class="btn ghost" onclick="go('/intent/${d.id}')">提交预约需求</button><button class="btn" style="flex:1" onclick="go('/book/${d.id}')">${d.remain ? '立即预约挂号' : '查看号源'}</button></div>`;
  $('#fol').onclick = async () => {
    if (!await needLogin()) return;
    const r = await api('/api/follow', { body: { doctorId: d.id } });
    const b = $('#fol'); b.classList.toggle('on', r.followed); b.textContent = r.followed ? '✓ 已关注' : '+ 关注';
    $('#fcnt').textContent = +$('#fcnt').textContent + (r.followed ? 1 : -1);
    toast(r.followed ? '已关注，排班变动将第一时间通知您' : '已取消关注');
  };
  $('#shr').onclick = () => share(d);
};

// ---- 分享：微信好友 / 保存图片 / 复制链接 ----
function share(d) {
  const url = location.origin + location.pathname + '#/doctor/' + d.id;
  const cv = document.createElement('canvas'); const W = 600, Hh = 920; cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, 360); grd.addColorStop(0, '#0b7a75'); grd.addColorStop(1, '#3fbfa8');
  g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = grd; g.fillRect(0, 0, W, 360);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(540, 40, 160, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.fillText('名医温州', 40, 64);
  g.font = '18px sans-serif'; g.globalAlpha = .85; g.fillText('健康温州 · 温州名医汇', 40, 94); g.globalAlpha = 1;
  g.fillStyle = d.avatarColor; g.beginPath(); g.arc(110, 210, 64, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.fillText(d.name[0], 110, 230); g.textAlign = 'left';
  g.font = 'bold 40px sans-serif'; g.fillText(d.name, 200, 196);
  g.font = '22px sans-serif'; g.fillText(d.title + ' · ' + d.mylbName, 200, 236);
  g.font = '20px sans-serif'; g.globalAlpha = .9; g.fillText(d.hospitalName, 200, 270); g.fillText(d.deptName, 200, 300); g.globalAlpha = 1;
  g.fillStyle = '#fff'; roundRect(g, 30, 330, W - 60, 380, 20); g.fill();
  g.fillStyle = '#1f2a2e'; g.font = 'bold 24px sans-serif'; g.fillText('擅长领域', 60, 380);
  g.font = '21px sans-serif'; g.fillStyle = '#4b585e'; wrap(g, d.specialty.join('、'), 60, 416, W - 120, 32, 3);
  g.fillStyle = '#1f2a2e'; g.font = 'bold 24px sans-serif'; g.fillText('坐诊时间', 60, 530);
  g.font = '21px sans-serif'; g.fillStyle = '#0b7a75'; wrap(g, d.scheduleText, 60, 566, W - 120, 32, 2);
  g.fillStyle = '#4b585e'; g.fillText('号源类别：' + d.hyCategoryName, 60, 640);
  g.fillText('近 14 天余号：' + d.remain, 60, 676);
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), cs = Math.floor(170 / n), qx = 60, qy = 735;
  g.fillStyle = '#fff'; roundRect(g, 30, 720, W - 60, 170, 20); g.fill();
  g.fillStyle = '#111'; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(qx + c * cs * .82, qy + r * cs * .82, cs * .82 + .3, cs * .82 + .3);
  g.fillStyle = '#1f2a2e'; g.font = 'bold 24px sans-serif'; g.fillText('长按识别二维码', 250, 790);
  g.font = '19px sans-serif'; g.fillStyle = '#66737a'; g.fillText('查看名医详情 · 在线预约挂号', 250, 826); g.fillText('健康温州 · 名医温州', 250, 858);
  const png = cv.toDataURL('image/png');
  sheet(`<h3>分享名医</h3><img class="poster" src="${png}" alt="名医分享海报"><div class="muted" style="text-align:center;margin-top:8px">手机端可长按图片保存</div>
    <div class="share-ops"><button id="s-wx"><b style="background:#2aae67">微</b>微信好友</button><button id="s-tl"><b style="background:#e8833a">圈</b>朋友圈</button><button id="s-save"><b style="background:#2f6fde">⇩</b>保存图片</button><button id="s-link"><b style="background:#7b5bd6">⧉</b>复制链接</button></div>
    <button class="btn blk gray" style="margin-top:14px" data-close>取消</button>`, m => {
    const guide = () => { const gd = document.createElement('div'); gd.className = 'wxguide'; gd.innerHTML = '<b>↗</b>点击右上角「···」<br>选择「发送给朋友」或「分享到朋友圈」<br><small style="opacity:.7">（在健康温州公众号/小程序内打开时生效）</small>'; gd.onclick = () => gd.remove(); document.body.appendChild(gd); };
    m.querySelector('#s-wx').onclick = async () => { if (navigator.share && !/MicroMessenger/i.test(navigator.userAgent)) { try { await navigator.share({ title: `名医温州 · ${d.name}（${d.hospitalShort}）`, text: `${d.name} ${d.title}，擅长${d.specialty.join('、')}`, url }); return; } catch {} } guide(); };
    m.querySelector('#s-tl').onclick = guide;
    m.querySelector('#s-save').onclick = () => { const a = document.createElement('a'); a.href = png; a.download = `名医温州_${d.name}.png`; a.click(); toast('图片已保存'); };
    m.querySelector('#s-link').onclick = async () => { try { await navigator.clipboard.writeText(url); } catch { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } toast('链接已复制，可粘贴发送给好友'); };
  });
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, t, x, y, w, lh, max) { let line = '', n = 0; for (const ch of t) { if (g.measureText(line + ch).width > w) { g.fillText(line, x, y); y += lh; line = ch; if (++n >= max) return; } else line += ch; } g.fillText(line, x, y); }

// ---- 预约挂号（选科室→选医生→选时段→留言→提交）----
P.reg = async (q) => {
  const p = new URLSearchParams(q);
  const hid = p.get('h'), did = p.get('d');
  app.classList.add('nobar');
  const steps = n => `<div class="steps">${['选择医院', '选择科室', '选择名医', '选择时段'].map((s, i) => `<span class="${i <= n ? 'on' : ''}">${i + 1}. ${s}</span>`).join('')}</div>`;
  if (!hid) {
    const hs = await api('/api/hospitals');
    app.innerHTML = hd('预约挂号') + steps(0) + `<div class="sec">${hs.map(h => `<div class="hosp" onclick="go('/reg?h=${h.id}')"><div class="ic">${esc(h.short.slice(0, 2))}</div><div class="bd"><div class="nm">${esc(h.name)}</div><div class="muted">${esc(h.regionName)} · 名医 ${h.doctorCount} 位 · 余号 ${h.remain}</div></div><span style="color:#c0c7cb;font-size:20px">›</span></div>`).join('')}</div>`;
    return;
  }
  const h = await api('/api/hospital/' + hid);
  if (!did) {
    app.innerHTML = hd('预约挂号') + steps(1) + `<div class="sec"><div class="sec-t">${esc(h.name)}</div>${h.depts.map(dp => `<div class="list-item" onclick="go('/reg?h=${hid}&d=${dp.id}')"><span>${esc(dp.name)}</span><span class="muted">名医 ${dp.doctors.length} 位 · 余号 ${dp.doctors.reduce((a, x) => a + x.remain, 0)} ›</span></div>`).join('')}</div>`;
    return;
  }
  const dp = h.depts.find(x => x.id === did);
  app.innerHTML = hd('预约挂号') + steps(2) + `<div class="sec"><div class="sec-t">${esc(h.short)} · ${esc(dp.name)}</div>${dp.doctors.map(d => docRow(d)).join('')}</div>`;
};

P.book = async (id, q) => {
  if (!await needLogin()) return;
  const p = new URLSearchParams(q);
  const d = await api('/api/doctor/' + id);
  const days = [...new Set(d.slots.map(s => s.date))];
  let date = p.get('date') || days.find(dt => d.slots.some(s => s.date === dt && s.status === '正常' && s.remain > 0)) || days[0];
  let slot = null;
  app.classList.add('nobar');
  app.innerHTML = `${hd('预约挂号')}
  <div class="sec" style="display:flex;gap:12px;align-items:center">${avatar(d, 50)}<div style="flex:1"><b style="font-size:16px">${esc(d.name)}</b> <span class="muted">${esc(d.title)}</span><div class="muted">${esc(d.hospitalName)} · ${esc(d.deptName)}</div><div>${mylbTag(d)}<span class="tag gray">${esc(d.hyCategoryName)}</span></div></div></div>
  <div class="sec"><div class="sec-t">选择就诊日期<small>可约未来 14 天</small></div><div class="dates" id="dates"></div><div id="slots"></div></div>
  <div class="sec"><div class="sec-t">就诊人</div>
    ${ME.verified ? `<div class="kv"><span>姓名</span>${esc(ME.name)} <span class="tag" style="margin-left:6px">已实名</span></div><div class="kv"><span>证件号</span>${esc(ME.idCard)}</div><div class="kv"><span>手机号</span>${esc(ME.phone)}</div>`
      : `<div class="muted" style="margin-bottom:8px">预约挂号须实名就医，请先完成实名认证</div><button class="btn sm" onclick="go('/realname?back=${encodeURIComponent('/book/' + id)}')">去实名认证</button>`}</div>
  <div class="sec"><div class="sec-t">留言板<small>选填，将同步给医院及医生</small></div>
    <div class="qtags">${['首诊', '复诊', '带外院检查报告', '希望靠前时段', '老人行动不便', '需开具检查单'].map(t => `<button>${t}</button>`).join('')}</div>
    <textarea class="ta" id="msg" maxlength="300" placeholder="可补充说明病情、既往检查、就诊需求等（不超过 300 字）。有留言的预约，系统将短信通知您该医生的排班信息。"></textarea><div class="muted" style="text-align:right"><span id="cnt">0</span>/300</div></div>
  <div class="sec muted" style="font-size:12px">预约须知：${esc((HOME || await api('/api/home')).settings.bookRule)}</div>
  <div style="height:70px"></div>
  <div class="foot"><div class="fee">挂号费 <b>¥${d.fee}</b><br><span id="sel">请选择就诊时段</span></div><button class="btn" id="sub" disabled>确认预约</button></div>`;
  const msg = $('#msg');
  msg.oninput = () => $('#cnt').textContent = msg.value.length;
  app.querySelectorAll('.qtags button').forEach(b => b.onclick = () => { msg.value = (msg.value ? msg.value + '；' : '') + b.textContent; msg.oninput(); });
  function draw() {
    $('#dates').innerHTML = days.map(dt => { const ss = d.slots.filter(s => s.date === dt); const rm = ss.filter(s => s.status === '正常').reduce((a, s) => a + s.remain, 0); const stop = ss.every(s => s.status === '停诊'); const c = cnDay(dt); return `<button data-dt="${dt}" class="${dt === date ? 'on' : ''} ${stop ? 'stop' : rm ? '' : 'full'}">${dt === todayStr() ? '今天' : c.wd}<b>${c.md}</b><i>${stop ? '停诊' : rm ? '余' + rm : '约满'}</i></button>`; }).join('') || '<div class="muted">近 14 天暂无排班</div>';
    const ss = d.slots.filter(s => s.date === date);
    $('#slots').innerHTML = ['上午', '下午'].filter(pp => ss.some(s => s.period === pp)).map(pp => `<div style="margin-top:12px;font-weight:600">${pp}${ss.some(s => s.period === pp && s.status === '停诊') ? ' <span class="tag red">停诊</span>' : ''}</div><div class="slots">${ss.filter(s => s.period === pp).map(s => `<button data-s="${s.id}" class="${slot && slot.id === s.id ? 'on' : ''}" ${s.status !== '正常' || s.remain <= 0 ? 'disabled' : ''}>${s.time}<small>${s.status !== '正常' ? '停诊' : s.remain > 0 ? '剩余 ' + s.remain + ' 个' : '已约满'} · ${esc(s.categoryName)}</small></button>`).join('')}</div>`).join('')
      + (ss.length && ss.every(s => s.status !== '正常' || s.remain <= 0) ? `<div class="notice" style="margin:12px 0 0">当天号源不可约，可 <a href="#/intent/${d.id}">提交名医预约需求</a>，由医院协调安排。</div>` : '');
    $('#dates').querySelectorAll('button').forEach(b => b.onclick = () => { date = b.dataset.dt; slot = null; upd(); draw(); });
    $('#slots').querySelectorAll('button[data-s]').forEach(b => b.onclick = () => { slot = d.slots.find(s => s.id === b.dataset.s); upd(); draw(); });
  }
  function upd() { $('#sel').textContent = slot ? `${slot.date} ${slot.period} ${slot.time}` : '请选择就诊时段'; $('#sub').disabled = !slot || !ME.verified; }
  draw();
  $('#sub').onclick = async () => {
    if (!await confirmBox('确认预约', `${esc(d.name)} · ${slot.date} ${slot.period} ${slot.time}<br>挂号费 ¥${d.fee}，就诊时缴费`, '确认预约')) return;
    const a = await api('/api/appointments', { body: { slotId: slot.id, message: msg.value } });
    go('/record/' + a.id + '?ok=1');
  };
};

P.intent = async (id) => {
  if (!await needLogin()) return;
  app.classList.add('nobar');
  let d = id ? await api('/api/doctor/' + id) : null;
  app.innerHTML = `${hd('安排医生 · 名医预约需求')}
  <div class="notice" style="margin-top:10px">号源已约满或无合适时段？选定目标名医，提交您的就医需求，医院将在 1-2 个工作日内受理并协调安排。</div>
  <div class="sec" id="dsel"></div>
  <div class="form">
    <div style="padding:12px 0 6px;font-weight:600">就医需求 / 病情描述 <span style="color:var(--red)">*</span></div>
    <textarea class="ta" id="dis" maxlength="300" placeholder="请简要描述症状、持续时间、已做检查及诊断等"></textarea>
    <div class="fi"><label>期望时间</label><select id="exp"><option>尽快</option><option>本周内</option><option>两周内</option><option>工作日上午</option><option>工作日下午</option><option>周末</option></select></div>
    <div class="fi"><label>接受调剂</label><select id="acc"><option value="1">接受同科室其他名医</option><option value="0">仅限目标名医</option></select></div>
    <div style="padding:12px 0 6px;font-weight:600">留言板 <span class="muted">（选填，向医院/医生补充说明）</span></div>
    <textarea class="ta" id="msg" maxlength="200" placeholder="如：老人行动不便，希望安排上午就诊" style="min-height:70px;margin-bottom:12px"></textarea>
  </div>
  <div class="pad" style="margin-top:16px"><button class="btn blk" id="sub">提交预约需求</button></div>`;
  const drawD = () => $('#dsel').innerHTML = d ? `<div class="sec-t">目标名医<small id="chg">更换 ›</small></div><div style="display:flex;gap:12px;align-items:center">${avatar(d, 46)}<div><b>${esc(d.name)}</b> <span class="muted">${esc(d.title)}</span><div class="muted">${esc(d.hospitalName)} · ${esc(d.deptName)}</div></div></div>`
    : `<div class="sec-t">目标名医<small id="chg">选择名医 ›</small></div><div class="muted">请先选择目标名医</div>`;
  drawD();
  $('#dsel').addEventListener('click', async e => {
    if (e.target.id !== 'chg') return;
    const all = await api('/api/doctors');
    sheet(`<h3>选择目标名医</h3><div class="search" style="margin:0 0 8px;background:#f1f4f5"><span>⌕</span><input id="pk" placeholder="姓名/科室/医院"></div><div id="pl"></div>`, m => {
      const pl = m.querySelector('#pl');
      const dr = k => pl.innerHTML = all.filter(x => !k || (x.name + x.deptName + x.hospitalName + x.specialty.join('')).includes(k)).slice(0, 40).map(x => `<div class="list-item" data-id="${x.id}"><span><b>${esc(x.name)}</b> <span class="muted">${esc(x.title)}</span><br><span class="muted">${esc(x.hospitalShort)} · ${esc(x.deptName)}</span></span>${mylbTag(x)}</div>`).join('');
      dr(''); m.querySelector('#pk').oninput = e => dr(e.target.value.trim());
      pl.onclick = async e => { const it = e.target.closest('[data-id]'); if (!it) return; d = await api('/api/doctor/' + it.dataset.id); drawD(); m.remove(); };
    });
  });
  $('#sub').onclick = async () => {
    if (!d) return toast('请选择目标名医');
    await api('/api/intents', { body: { doctorId: d.id, disease: $('#dis').value, expect: $('#exp').value, acceptOther: $('#acc').value === '1', message: $('#msg').value } });
    toast('需求已提交，医院受理后将通知您'); setTimeout(() => go('/intents'), 900);
  };
};

P.intents = async () => {
  if (!await needLogin()) return;
  const list = await api('/api/intents');
  app.classList.add('nobar');
  app.innerHTML = hd('我的名医预约需求', { rt: '<a class="rt" href="#/intent">+ 新需求</a>' }) + (list.length ? list.map(i => `<div class="rec"><div class="t"><span>${esc(i.doctorName)} · ${esc(i.deptName)}</span><span class="st ${i.status === '已安排' ? 'done' : i.status === '无法安排' ? 'cancel' : 'wait'}">${esc(i.status)}</span></div>
    <div class="r">${esc(i.hospitalName)}<br>需求：${esc(i.disease)}<br>期望：${esc(i.expect)} · ${i.acceptOther ? '接受调剂' : '仅限目标名医'}${i.message ? '<br>留言：' + esc(i.message) : ''}${i.reply ? `<br><span style="color:var(--c)">医院回复：${esc(i.reply)}</span>` : ''}</div><div class="muted" style="margin-top:6px">提交于 ${esc(i.createdAt)}</div></div>`).join('') : '<div class="empty"><b>📝</b>暂无名医预约需求</div>');
};

P.records = async (q) => {
  if (!await needLogin()) return;
  await refreshBadge();
  const list = await api('/api/appointments');
  let tab = new URLSearchParams(q).get('t') || '全部';
  app.innerHTML = `${hd('预约记录', { noback: true })}<div class="filters" style="padding-bottom:4px">${['全部', '待就诊', '已完成', '已取消', '停诊退号'].map(t => `<button data-t="${t}">${t} ${t === '全部' ? list.length : list.filter(a => a.status === t).length}</button>`).join('')}</div><div id="rl"></div>${tabbar('records')}`;
  const draw = () => {
    app.querySelectorAll('.filters button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const l = list.filter(a => tab === '全部' || a.status === tab);
    $('#rl').innerHTML = l.length ? l.map(a => `<div class="rec" onclick="go('/record/${a.id}')"><div class="t"><span>${esc(a.doctorName)} <small class="muted">${esc(a.doctorTitle)}</small></span><span class="st ${stCls(a.status)}">${esc(a.status)}</span></div>
      <div class="r">${esc(a.hospitalName)} · ${esc(a.deptName)}<br>就诊时间：${a.date} ${a.period} ${a.time}<br>号源类别：${esc(a.categoryName)} · ¥${a.fee}${a.message ? '<br>留言：' + esc(a.message.slice(0, 30)) + (a.message.length > 30 ? '…' : '') : ''}</div>
      <div class="muted" style="margin-top:6px;display:flex;justify-content:space-between"><span>单号 ${esc(a.no)}</span><span>${esc(a.createdAt)}</span></div></div>`).join('') : '<div class="empty"><b>▤</b>暂无预约记录<br><a href="#/home">去预约名医</a></div>';
  };
  app.querySelectorAll('.filters button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
  draw();
};

P.record = async (id, q) => {
  if (!await needLogin()) return;
  const a = (await api('/api/appointments')).find(x => x.id === id);
  if (!a) { app.innerHTML = hd('预约详情') + '<div class="empty">记录不存在</div>'; return; }
  const okFlag = new URLSearchParams(q).get('ok');
  const cls = { '已取消': 'st-cancel', '爽约': 'st-cancel', '停诊退号': 'st-stop', '已完成': 'st-done' }[a.status] || '';
  app.classList.add('nobar');
  app.innerHTML = `${hd(okFlag ? '预约成功' : '预约详情')}
  <div class="ticket"><div class="tt ${cls}"><div style="opacity:.85;font-size:13px">${okFlag ? '✓ 预约成功，已通过健康温州消息通知您' : '预约状态'}</div><h3>${esc(a.status)}</h3><div style="font-size:13px;opacity:.9;margin-top:4px">单号 ${esc(a.no)}</div></div>
  <div class="bd"><div class="kv"><span>就诊医院</span>${esc(a.hospitalName)}</div><div class="kv"><span>就诊科室</span>${esc(a.deptName)}</div><div class="kv"><span>坐诊名医</span>${esc(a.doctorName)} ${esc(a.doctorTitle)}</div>
  <div class="kv"><span>就诊时间</span><b style="color:var(--c)">${a.date} ${cnDay(a.date).wd} ${a.period} ${a.time}</b></div><div class="kv"><span>号源类别</span>${esc(a.categoryName)}</div><div class="kv"><span>挂号费</span>¥${a.fee}</div>
  <div class="kv"><span>预约渠道</span>${esc(a.channel)}</div>${a.message ? `<div class="kv"><span>我的留言</span>${esc(a.message)}</div>` : ''}</div></div>
  ${a.status === '待就诊' ? `<div class="sec muted" style="font-size:12px">就诊提示：请于就诊时段前 30 分钟到院，携带身份证或医保卡至自助机/门诊服务台签到取号。</div>` : ''}
  <div class="sec"><div class="sec-t">全流程追踪</div><div class="tl">${a.logs.map(l => `<div>${esc(l.a)}<small>${esc(l.t)} · ${esc(l.by)}</small></div>`).join('')}</div></div>
  <div style="height:70px"></div>
  ${a.status === '待就诊' ? `<div class="foot"><button class="btn gray" id="cc">取消预约</button><button class="btn ghost" id="rs" style="flex:1">改约</button><button class="btn" onclick="go('/doctor/${a.doctorId}')">医生主页</button></div>` : `<div class="foot"><button class="btn ghost" style="flex:1" onclick="go('/records')">返回记录</button><button class="btn" style="flex:1" onclick="go('/book/${a.doctorId}')">再次预约</button></div>`}`;
  const cc = $('#cc'); if (cc) cc.onclick = async () => {
    if (!await confirmBox('取消预约', '取消后号源将释放给其他居民，挂号费原路退回。确定取消吗？', '确定取消')) return;
    await api(`/api/appointments/${a.id}/cancel`, { body: { reason: '行程有变' } }); toast('已取消'); render();
  };
  const rs = $('#rs'); if (rs) rs.onclick = async () => {
    const d = await api('/api/doctor/' + a.doctorId);
    const av = d.slots.filter(s => s.status === '正常' && s.remain > 0 && s.category === a.category && s.id !== a.slotId && s.date > todayStr());
    sheet(`<h3>改约（同医生同号源类别）</h3>${av.length ? `<div class="slots">${av.map(s => `<button data-s="${s.id}">${s.date.slice(5)} ${cnDay(s.date).wd} ${s.period}<small>${s.time} · 余 ${s.remain}</small></button>`).join('')}</div>` : '<div class="empty">暂无可改约的号源</div>'}<button class="btn blk gray" style="margin-top:14px" data-close>取消</button>`, m => {
      m.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { await api(`/api/appointments/${a.id}/reschedule`, { body: { slotId: b.dataset.s } }); m.remove(); toast('改约成功'); render(); });
    });
  };
};

P.follows = async () => {
  if (!await needLogin()) return;
  const list = await api('/api/follows');
  app.classList.add('nobar');
  app.innerHTML = hd('我的关注') + (list.length ? `<div class="muted" style="padding:10px 14px 0">共关注 ${list.length} 位名医，排班变动、停诊、新增号源将通过健康温州消息提醒您</div>` + list.map(d => `<div class="sec" style="padding:4px 14px">${docRow(d)}
    <div style="font-size:12px;padding:0 0 10px;color:#4b585e">🗓 坐诊：${esc(d.scheduleText)}　${d.next ? '最近排班：' + esc(d.next) : '近期暂无排班'}${d.stops.length ? `<br><span style="color:var(--red)">⚠ 停诊：${d.stops.map(s => s.date + ' ' + s.period).join('；')}</span>` : ''}<br><span class="muted">信息更新于 ${esc(d.updatedAt)}</span></div></div>`).join('')
    : '<div class="empty"><b>☆</b>还没有关注名医<br><a href="#/search">去找名医</a></div>');
};

P.messages = async () => {
  if (!await needLogin()) return;
  const r = await api('/api/messages');
  let tab = 'msg';
  app.classList.add('nobar');
  app.innerHTML = hd('消息通知', { rt: '<button class="rt" id="ra">全部已读</button>' }) + `<div class="seg"><button data-t="msg">健康温州消息 ${r.messages.filter(m => !m.read).length ? '(' + r.messages.filter(m => !m.read).length + ')' : ''}</button><button data-t="sms">短信通知 (${r.sms.length})</button></div><div id="ml"></div>`;
  const draw = () => {
    app.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    $('#ml').innerHTML = tab === 'msg' ? (r.messages.length ? r.messages.map(m => `<div class="msg"><div class="t">${m.read ? '' : '<i></i>'}<span class="tag ${m.type.includes('停诊') ? 'red' : m.type.includes('关注') ? 'blue' : ''}">${esc(m.type)}</span>${esc(m.title)}</div><p>${esc(m.content)}</p><div class="src"><span>来源：${esc(m.channel)}</span><span>${esc(m.t.slice(5, 16))}</span></div></div>`).join('') : '<div class="empty"><b>✉</b>暂无消息</div>')
      : (r.sms.length ? r.sms.map(s => `<div class="sms"><div class="muted">发送至 ${esc(s.phone)} · ${esc(s.t)} · ${esc(s.status)}</div><div class="bubble">${esc(s.content)}</div></div>`).join('') : '<div class="empty"><b>✉</b>暂无短信记录<br><span>停诊、含留言的预约会以短信方式通知</span></div>');
  };
  app.querySelectorAll('.seg button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
  $('#ra').onclick = async () => { await api('/api/messages/read', { body: {} }); r.messages.forEach(m => m.read = true); draw(); toast('已全部标为已读'); };
  draw();
  setTimeout(() => api('/api/messages/read', { body: {}, silent: true }).catch(() => {}), 2500);
};

P.feedback = async () => {
  if (!await needLogin()) return;
  const list = await api('/api/feedback');
  let type = '预约体验';
  app.classList.add('nobar');
  app.innerHTML = `${hd('优化意见')}
  <div class="sec"><div class="sec-t">意见类型</div><div class="filters" style="padding:0">${['预约体验', '平台使用', '功能建议', '医生服务', '其他'].map(t => `<button data-t="${t}">${t}</button>`).join('')}</div>
    <div style="margin-top:12px"><textarea class="ta" id="ct" maxlength="500" placeholder="请描述您在就医预约或平台使用中遇到的问题与建议，我们会认真对待每一条意见（5-500 字）"></textarea></div>
    <div class="fi" style="border:0"><label>联系方式</label><input id="ctc" placeholder="选填，便于我们回访" value="${esc(ME.phoneRaw || '')}"></div>
    <button class="btn blk" id="sub">提交意见</button></div>
  <div class="sec"><div class="sec-t">我的意见记录</div>${list.length ? list.map(f => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between"><span class="tag">${esc(f.type)}</span><span class="st ${f.status === '已回复' ? 'done' : 'wait'}">${esc(f.status)}</span></div><p style="margin-top:6px;font-size:13px">${esc(f.content)}</p>${f.reply ? `<p style="margin-top:6px;font-size:13px;color:var(--c);background:var(--c-l);padding:8px;border-radius:8px">平台回复：${esc(f.reply)}</p>` : ''}<div class="muted">${esc(f.createdAt)}</div></div>`).join('') : '<div class="muted">暂无记录</div>'}</div>`;
  const sync = () => app.querySelectorAll('.filters button').forEach(b => b.classList.toggle('on', b.dataset.t === type));
  app.querySelectorAll('.filters button').forEach(b => b.onclick = () => { type = b.dataset.t; sync(); }); sync();
  $('#sub').onclick = async () => { await api('/api/feedback', { body: { type, content: $('#ct').value, contact: $('#ctc').value } }); toast('感谢您的意见！'); render(); };
};

P.me = async () => {
  const logged = store.tk && await api('/api/me', { silent: true }).then(u => (ME = u)).catch(e => { if (e.message === 'stale') throw e; return null; });
  await refreshBadge();
  app.innerHTML = `<div class="me-card">${logged ? `<div class="av" style="width:60px;height:60px;font-size:24px">${esc((ME.name || '居')[0])}</div><div><b style="font-size:18px">${esc(ME.name || '未实名用户')}</b><div style="opacity:.9;font-size:13px">${esc(ME.phone)}　${ME.verified ? '✓ 已实名' : '未实名'}</div></div>`
    : `<div class="av" style="width:60px;height:60px;font-size:24px">?</div><div onclick="go('/login')"><b style="font-size:18px">登录 / 注册</b><div style="opacity:.9;font-size:13px">登录后享受名医预约服务</div></div>`}</div>
  <div class="menu" style="margin-top:-24px;position:relative">
    <a href="#/realname"><i>🪪</i><span>实名认证</span><em>${logged ? (ME.verified ? ME.idCard : '去认证') : ''}</em></a>
    <a href="#/records"><i>▤</i><span>预约记录</span><em>${badge.upcoming ? badge.upcoming + ' 条待就诊' : ''}</em></a>
    <a href="#/intents"><i>📝</i><span>名医预约需求</span></a>
    <a href="#/follows"><i>★</i><span>我的关注</span></a>
    <a href="#/messages"><i>✉</i><span>消息通知</span><em>${badge.unread ? badge.unread + ' 条未读' : ''}</em></a></div>
  <div class="menu"><a href="#/feedback"><i>💡</i><span>优化意见</span></a><a href="#/forgot"><i>🔒</i><span>修改/找回密码</span></a></div>
  ${logged ? '<div class="pad" style="margin-top:20px"><button class="btn blk gray" id="lo">退出登录</button></div>' : ''}
  ${tabbar('me')}`;
  const lo = $('#lo'); if (lo) lo.onclick = async () => { await api('/api/auth/logout', { body: {}, silent: true }).catch(() => {}); store.tk = ''; ME = null; toast('已退出'); render(); };
};

// ---- 账号：登录 / 注册 / 找回密码 / 实名 ----
function codeBtn(sel, phoneSel, scene, fillSel) {
  const b = $(sel);
  b.onclick = async () => {
    const phone = $(phoneSel).value.trim();
    const r = await api('/api/sms/send', { body: { phone, scene } });
    toast('验证码已发送（演示：' + r.demoCode + '）', 2600);
    if (fillSel) $(fillSel).value = r.demoCode;
    let n = 60; b.disabled = true; const t = setInterval(() => { b.textContent = n-- + 's'; if (n < 0) { clearInterval(t); b.disabled = false; b.textContent = '获取验证码'; } }, 1000);
  };
}
function backTo(q) { const b = new URLSearchParams(q).get('back'); go(b || '/home'); }
P.login = async (q) => {
  let mode = 'pwd';
  app.classList.add('nobar');
  app.innerHTML = `<div class="login-hero"><button style="color:#fff;font-size:22px;position:absolute;top:8px;left:8px" onclick="back()">‹</button><h1>名医温州</h1><p>健康温州 · 统一身份认证 · 实名就医</p></div>
  <div class="seg"><button data-m="pwd">密码登录</button><button data-m="sms">验证码登录</button></div>
  <div class="form" id="f"></div>
  <div class="pad" style="margin-top:18px"><button class="btn blk" id="sub">登录</button></div>
  <div class="links"><a href="#/register${q ? '?' + q : ''}">新用户注册</a><a href="#/forgot">忘记密码？</a></div>
  <div class="demo-tip"><span>演示账号：13800000001<br>密码：Demo@123</span><button class="btn sm" id="fill">一键填入</button></div>
  <div class="muted" style="text-align:center;margin-top:16px;font-size:11px">登录即表示同意《名医温州用户服务协议》《隐私政策》</div>`;
  const draw = () => {
    app.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    $('#f').innerHTML = mode === 'pwd' ? `<div class="fi"><label>账号</label><input id="ac" placeholder="手机号 / 身份证号"></div><div class="fi"><label>密码</label><input id="pw" type="password" placeholder="请输入密码"></div>`
      : `<div class="fi"><label>手机号</label><input id="ph" maxlength="11" inputmode="numeric" placeholder="请输入手机号"></div><div class="fi"><label>验证码</label><input id="cd" maxlength="6" inputmode="numeric" placeholder="6 位验证码"><button class="code" id="gc">获取验证码</button></div>`;
    if (mode === 'sms') codeBtn('#gc', '#ph', 'login', '#cd');
  };
  app.querySelectorAll('.seg button').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
  draw();
  $('#fill').onclick = () => { mode = 'pwd'; draw(); $('#ac').value = '13800000001'; $('#pw').value = 'Demo@123'; };
  $('#sub').onclick = async () => {
    const body = mode === 'pwd' ? { account: $('#ac').value.trim(), password: $('#pw').value } : { mode: 'sms', phone: $('#ph').value.trim(), code: $('#cd').value.trim() };
    const r = await api('/api/auth/login', { body }); store.tk = r.token; ME = r.user; toast('登录成功'); backTo(q);
  };
};
function genTestId() {
  const area = '330302', y = 1960 + Math.floor(Math.random() * 45), m = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0'), d = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const id17 = area + y + m + d + String(Math.floor(Math.random() * 999)).padStart(3, '0');
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]; let s = 0; for (let i = 0; i < 17; i++) s += +id17[i] * w[i];
  return id17 + '10X98765432'[s % 11];
}
P.register = async (q) => {
  app.classList.add('nobar');
  app.innerHTML = `${hd('注册账号')}
  <div class="form"><div class="fi"><label>手机号</label><input id="ph" maxlength="11" inputmode="numeric" placeholder="请输入手机号"></div>
  <div class="fi"><label>验证码</label><input id="cd" maxlength="6" inputmode="numeric" placeholder="6 位验证码"><button class="code" id="gc">获取验证码</button></div>
  <div class="fi"><label>设置密码</label><input id="pw" type="password" placeholder="8-20 位，含字母和数字"></div>
  <div class="fi"><label>确认密码</label><input id="pw2" type="password" placeholder="再次输入密码"></div></div>
  <div class="muted" style="padding:6px 16px 0">实名信息（预约挂号需实名，可稍后补充）</div>
  <div class="form"><div class="fi"><label>真实姓名</label><input id="nm" placeholder="与身份证一致"></div>
  <div class="fi"><label>身份证号</label><input id="idc" maxlength="18" placeholder="18 位身份证号"><button class="code" id="gid">测试号</button></div></div>
  <label class="chk" style="padding:0 12px"><input type="checkbox" id="agr"> 我已阅读并同意《名医温州用户服务协议》《隐私政策》，同意平台为实名就医核验身份信息</label>
  <div class="pad"><button class="btn blk" id="sub">注册并登录</button></div>
  <div class="links"><span></span><a href="#/login">已有账号，去登录</a></div>`;
  codeBtn('#gc', '#ph', 'register', '#cd');
  $('#gid').onclick = () => { $('#idc').value = genTestId(); toast('已生成校验位合法的测试身份证号'); };
  $('#sub').onclick = async () => {
    if (!$('#agr').checked) return toast('请先阅读并同意用户协议');
    if ($('#pw').value !== $('#pw2').value) return toast('两次密码不一致');
    const r = await api('/api/auth/register', { body: { phone: $('#ph').value.trim(), code: $('#cd').value.trim(), password: $('#pw').value, name: $('#nm').value.trim(), idCard: $('#idc').value.trim() } });
    store.tk = r.token; ME = r.user; toast(r.user.verified ? '注册成功，已完成实名认证' : '注册成功'); backTo(q);
  };
};
P.forgot = async () => {
  app.classList.add('nobar');
  app.innerHTML = `${hd('找回密码')}
  <div class="notice" style="margin-top:10px">为保障账号安全，需验证手机号；已实名用户还需核对身份证号。</div>
  <div class="form"><div class="fi"><label>手机号</label><input id="ph" maxlength="11" inputmode="numeric" placeholder="注册手机号"></div>
  <div class="fi"><label>身份证号</label><input id="idc" maxlength="18" placeholder="已实名用户必填"></div>
  <div class="fi"><label>验证码</label><input id="cd" maxlength="6" placeholder="6 位验证码"><button class="code" id="gc">获取验证码</button></div>
  <div class="fi"><label>新密码</label><input id="pw" type="password" placeholder="8-20 位，含字母和数字"></div></div>
  <div class="pad" style="margin-top:16px"><button class="btn blk" id="sub">重置密码</button></div>`;
  codeBtn('#gc', '#ph', 'reset', '#cd');
  $('#sub').onclick = async () => { await api('/api/auth/reset', { body: { phone: $('#ph').value.trim(), idCard: $('#idc').value.trim(), code: $('#cd').value.trim(), password: $('#pw').value } }); toast('密码已重置，请重新登录'); setTimeout(() => go('/login'), 800); };
};
P.realname = async (q) => {
  if (!await needLogin()) return;
  app.classList.add('nobar');
  app.innerHTML = `${hd('实名认证')}
  ${ME.verified ? `<div class="sec" style="text-align:center"><div style="font-size:44px;color:var(--c)">✓</div><b>已完成实名认证</b><div class="kv" style="justify-content:center">${esc(ME.name)} · ${esc(ME.idCard)}</div><div class="muted">身份信息已通过公安实名核验服务校验</div></div>`
    : `<div class="notice" style="margin-top:10px">根据实名就医要求，预约挂号前须完成实名认证。信息仅用于身份核验与就医。</div>
  <div class="form"><div class="fi"><label>真实姓名</label><input id="nm" placeholder="与身份证一致"></div><div class="fi"><label>身份证号</label><input id="idc" maxlength="18" placeholder="18 位身份证号"><button class="code" id="gid">测试号</button></div></div>
  <div class="pad" style="margin-top:16px"><button class="btn blk" id="sub">提交认证</button></div>`}`;
  if (!ME.verified) {
    $('#gid').onclick = () => { $('#idc').value = genTestId(); };
    $('#sub').onclick = async () => { ME = await api('/api/me/realname', { body: { name: $('#nm').value.trim(), idCard: $('#idc').value.trim() } }); toast('实名认证成功'); setTimeout(() => backTo(q), 700); };
  }
};

// ========= 路由 =========
async function render() {
  const h = location.hash.slice(1) || '/home';
  const [path, q] = h.split('?');
  const seg = path.split('/').filter(Boolean);
  const fn = P[seg[0]] || P.home;
  RID++; // 上一页未完成的异步渲染在下一次 api 返回时中止
  document.querySelectorAll('.mask').forEach(m => m.remove());
  window.scrollTo(0, 0);
  try { await (seg[1] !== undefined ? fn(seg[1], q || '') : fn(q || '')); }
  catch (e) { if (e.message !== '401' && e.message !== 'stale') console.error(e); }
}
window.addEventListener('hashchange', render);
render();
