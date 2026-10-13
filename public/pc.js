// 机构端 / 管理后台 公共框架
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PC = { key: '', tk: '', acct: null, meta: null, cfg: null };
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { return ''; } }
async function api(path, body, silent) {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + PC.tk }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ code: -1, msg: '网络异常' }));
  if (j.code === 401) { ls(PC.key, ''); PC.tk = ''; showLogin(); throw new Error('401'); }
  if (j.code !== 0) { if (!silent) toast(j.msg || '操作失败'); throw new Error(j.msg); }
  return j.data;
}
function toast(m, ms = 2000) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function modal(title, html, onOk, okText = '确定') {
  const m = document.createElement('div'); m.className = 'msk';
  m.innerHTML = `<div class="modal"><h3>${esc(title)}</h3>${html}<div class="ft"><button class="btn gray" data-x>取消</button>${onOk ? `<button class="btn" data-ok>${okText}</button>` : ''}</div></div>`;
  m.querySelector('[data-x]').onclick = () => m.remove();
  m.addEventListener('mousedown', e => { if (e.target === m) m.remove(); });
  if (onOk) m.querySelector('[data-ok]').onclick = async () => { try { if (await onOk(m) !== false) m.remove(); } catch (e) { if (e.message !== '401') console.error(e); } };
  document.body.appendChild(m); return m;
}
const stTag = s => `<span class="tag ${{ '待就诊': 'org', '已完成': 'blue', '已取消': 'gray', '停诊退号': 'red', '爽约': 'gray', '待受理': 'org', '已受理': 'blue', '已安排': '', '无法安排': 'gray', '待处理': 'org', '已回复': '' }[s] ?? ''}">${esc(s)}</span>`;
const mylbTag = (c, n) => `<span class="tag ${c === '1' ? 'gold' : c === '4' ? 'org' : c === '2' ? 'blue' : ''}">${esc(n)}</span>`;
function opts(list, v, all) { return (all ? `<option value="">${all}</option>` : '') + list.map(x => `<option value="${esc(x[0])}" ${x[0] === v ? 'selected' : ''}>${esc(x[1])}</option>`).join(''); }
function barChart(data, h = 200) {
  if (!data.length) return '<div class="empty">暂无数据</div>';
  const W = 760, max = Math.max(...data.map(d => d[1])), bw = W / data.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none">${[0.25, 0.5, 0.75, 1].map(f => `<line x1="0" x2="${W}" y1="${h - 20 - (h - 34) * f}" y2="${h - 20 - (h - 34) * f}" stroke="#eef2f3"/>`).join('')}
    ${data.map((d, i) => { const bh = (h - 34) * d[1] / max; return `<rect x="${i * bw + bw * .18}" y="${h - 20 - bh}" width="${bw * .64}" height="${bh}" rx="2" fill="${d[0] >= todayISO() ? '#e8833a' : '#14a39a'}"><title>${d[0]}：${d[1]} 人次</title></rect>`; }).join('')}
    ${data.filter((_, i) => i % Math.ceil(data.length / 10) === 0).map(d => `<text x="${data.indexOf(d) * bw + bw / 2}" y="${h - 4}" font-size="11" fill="#8a959b" text-anchor="middle">${d[0].slice(5)}</text>`).join('')}</svg>`;
}
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function showLogin() {
  const c = PC.cfg; let ans;
  const newCap = () => { const a = 2 + Math.floor(Math.random() * 8), b = 1 + Math.floor(Math.random() * 9); ans = a + b; return `${a} + ${b} = ?`; };
  document.body.innerHTML = `<div class="login"><div class="l"><div><h1>${esc(c.title)}</h1><p>${c.desc}</p></div><div style="opacity:.7;font-size:12px">温州市公立医院高质量发展项目 · 市级公立医院云HIS系统更新迭代提升项目<br>演示环境 · 所有数据均为脱敏测试数据</div></div>
  <div class="r"><form id="lf" autocomplete="off"><h2>${esc(c.loginTitle)}</h2><div class="muted">${esc(c.loginSub)}</div>
    <div class="fld"><label>账号</label><input class="inp" id="u" placeholder="请输入用户名"></div>
    <div class="fld"><label>密码</label><input class="inp" id="p" type="password" placeholder="请输入密码"></div>
    <div class="fld"><label>验证码</label><div class="cap"><input class="inp" id="cp" placeholder="请输入计算结果"><span id="cap" title="点击刷新">${newCap()}</span></div></div>
    <button class="btn lg" type="submit">登 录</button>
    <div class="hint">${c.hint}</div></form></div></div>`;
  $('#cap').onclick = e => e.target.textContent = newCap();
  document.querySelectorAll('.hint b[data-u]').forEach(b => b.onclick = () => { $('#u').value = b.dataset.u; $('#p').value = b.dataset.p; $('#cp').value = ans; });
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await api('/api/org/login', { username: $('#u').value, password: $('#p').value, captcha: $('#cp').value, captchaAns: ans });
      if (c.platformOnly && r.account.role !== 'platform') { toast('该账号无管理后台权限'); return; }
      PC.tk = r.token; ls(PC.key, r.token); boot();
    } catch { $('#cap').textContent = newCap(); }
  };
}
async function boot() {
  try { PC.meta = await api('/api/org/meta'); } catch { return; }
  PC.acct = PC.meta.account;
  if (PC.cfg.platformOnly && PC.acct.role !== 'platform') { ls(PC.key, ''); return showLogin(); }
  const c = PC.cfg;
  document.body.innerHTML = `<div class="layout"><aside class="side"><div class="brand"><i>名</i><div>${esc(c.brand)}<small>${esc(c.brandSub)}</small></div></div><nav id="nav"></nav></aside>
    <div class="main"><div class="top"><h2 id="ttl"></h2><span class="who">👤 ${esc(PC.acct.name)}（${esc(PC.acct.username)}）</span><button class="btn gray sm" id="lo">退出</button></div><div class="page" id="pg"></div></div></div>`;
  $('#lo').onclick = () => { ls(PC.key, ''); PC.tk = ''; showLogin(); };
  window.onhashchange = route; route();
}
async function route() {
  const c = PC.cfg; const id = location.hash.slice(2) || c.menu.find(m => m.id).id;
  const m = c.menu.find(x => x.id === id) || c.menu.find(x => x.id);
  $('#nav').innerHTML = c.menu.map(x => x.g ? `<div class="g">${esc(x.g)}</div>` : `<a href="#/${x.id}" class="${x.id === m.id ? 'on' : ''}"><span>${x.icon}</span>${esc(x.name)}${x.badge ? `<em id="b-${x.id}" style="display:none"></em>` : ''}</a>`).join('');
  $('#ttl').textContent = m.name;
  $('#pg').innerHTML = '<div class="empty">加载中…</div>';
  try { await c.pages[m.id]($('#pg')); } catch (e) { if (e.message !== '401') { console.error(e); $('#pg').innerHTML = `<div class="empty">加载失败：${esc(e.message)}</div>`; } }
  if (c.badges) c.badges();
}
function startPC(cfg) {
  PC.cfg = cfg; PC.key = cfg.key; PC.tk = ls(cfg.key);
  PC.tk ? boot() : showLogin();
}
