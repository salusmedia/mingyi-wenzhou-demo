// 名医温州 · 机构端（医院端 Web）
const ST = ['待就诊', '已完成', '已取消', '停诊退号', '爽约'];
function filterBar(F, withStatus = true) {
  const m = PC.meta;
  const hs = m.hospitals.map(h => [h.id, h.name]);
  const depts = m.depts.filter(d => !F.hospitalId || d.hospitalId === F.hospitalId).map(d => [d.id, (m.hospitals.length > 1 ? m.hospitals.find(h => h.id === d.hospitalId).short + '·' : '') + d.name]);
  const docs = m.doctors.filter(d => (!F.hospitalId || d.hospitalId === F.hospitalId) && (!F.deptId || d.deptId === F.deptId)).map(d => [d.id, d.name + '（' + d.deptName + '）']);
  return `<div class="filter">
    <div class="f">坐诊医院<select class="inp" data-k="hospitalId" ${hs.length === 1 ? 'disabled' : ''}>${opts(hs, F.hospitalId, hs.length > 1 ? '全部医院' : '')}</select></div>
    <div class="f">科室<select class="inp" data-k="deptId">${opts(depts, F.deptId, '全部科室')}</select></div>
    <div class="f">坐诊医生<select class="inp" data-k="doctorId">${opts(docs, F.doctorId, '全部医生')}</select></div>
    <div class="f">患者姓名<input class="inp" data-k="patient" value="${esc(F.patient || '')}" placeholder="支持模糊查询"></div>
    <div class="f">就诊日期起<input class="inp" type="date" data-k="from" value="${F.from || ''}"></div>
    <div class="f">就诊日期止<input class="inp" type="date" data-k="to" value="${F.to || ''}"></div>
    ${withStatus ? `<div class="f">预约状态<select class="inp" data-k="status">${opts(ST.map(s => [s, s]), F.status, '全部状态')}</select></div>` : ''}
    <div class="f">号源类别<select class="inp" data-k="category">${opts(m.dict.hyCategory.map(c => [c.code, c.name]), F.category, '全部类别')}</select></div>
    <button class="btn" data-q>查询</button><button class="btn gray" data-r>重置</button></div>`;
}
function bindFilter(el, F, run) {
  el.querySelectorAll('[data-k]').forEach(i => i.onchange = () => { F[i.dataset.k] = i.value; if (i.dataset.k === 'hospitalId') { F.deptId = ''; F.doctorId = ''; } if (i.dataset.k === 'deptId') F.doctorId = ''; if (i.tagName === 'SELECT') run(); });
  el.querySelector('[data-q]').onclick = () => { el.querySelectorAll('[data-k]').forEach(i => F[i.dataset.k] = i.value); F.page = 1; run(); };
  el.querySelector('[data-r]').onclick = () => { for (const k in F) delete F[k]; if (PC.meta.hospitals.length === 1) F.hospitalId = PC.meta.hospitals[0].id; run(); };
}
const qs = F => Object.entries(F).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const SF = {}; const MF = {};

const pages = {
  async stats(el) {
    if (PC.meta.hospitals.length === 1) SF.hospitalId = PC.meta.hospitals[0].id;
    SF.page = SF.page || 1;
    const run = async () => {
      const r = await api('/api/org/stats?' + qs(SF));
      const s = r.summary;
      el.innerHTML = `<div class="card">${filterBar(SF)}</div>
      <div class="kpis">
        <div class="kpi"><span>预约总量</span><b>${s.total}</b><i>就诊人 ${s.patients} 人</i></div>
        <div class="kpi"><span>已就诊</span><b style="color:#2f6fde">${s.done}</b><i>就诊率 ${s.total ? Math.round(s.done / Math.max(1, s.total - s.wait) * 100) : 0}%</i></div>
        <div class="kpi"><span>待就诊</span><b style="color:var(--acc)">${s.wait}</b><i>坐诊医生 ${s.doctors} 位</i></div>
        <div class="kpi"><span>取消 / 爽约</span><b>${s.cancel} / ${s.noshow}</b><i>取消率 ${s.total ? Math.round(s.cancel / s.total * 100) : 0}%</i></div>
        <div class="kpi"><span>停诊退号</span><b style="color:var(--red)">${s.stop}</b><i>已通知患者</i></div>
        <div class="kpi"><span>含留言预约</span><b style="color:var(--c)">${s.msg}</b><i>待受理需求 ${s.intentsPending} 条</i></div></div>
      <div class="row2"><div class="card"><div class="card-t">预约量趋势（按就诊日期）<small>橙色为未来已约</small></div>${barChart(r.trend)}</div>
        <div class="card"><div class="card-t">按号源类别</div><table class="t"><tr><th>号源类别</th><th class="n">预约</th><th class="n">已就诊</th><th>占比</th></tr>${r.byCategory.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${x.total}</td><td class="n">${x.done}</td><td><div class="bar"><i style="width:${Math.round(x.total / Math.max(1, s.total) * 100)}%"></i></div></td></tr>`).join('')}</table></div></div>
      <div class="row2"><div class="card"><div class="card-t">按坐诊医生统计<small>前 30 名</small></div><div class="tw" style="max-height:360px;overflow:auto"><table class="t"><tr><th>坐诊医生</th><th class="n">预约</th><th class="n">已就诊</th><th class="n">待就诊</th><th class="n">取消</th><th class="n">停诊</th><th class="n">留言</th></tr>${r.byDoctor.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${x.total}</td><td class="n">${x.done}</td><td class="n">${x.wait}</td><td class="n">${x.cancel}</td><td class="n">${x.stop}</td><td class="n">${x.msg}</td></tr>`).join('')}</table></div></div>
        <div class="card"><div class="card-t">按坐诊医院统计</div><table class="t"><tr><th>坐诊医院</th><th class="n">预约</th><th class="n">已就诊</th><th class="n">挂号费(元)</th></tr>${r.byHospital.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${x.total}</td><td class="n">${x.done}</td><td class="n">${x.fee.toLocaleString()}</td></tr>`).join('')}</table></div></div>
      <div class="card"><div class="card-t">预约明细<small>共 ${r.count} 条 · 患者信息已脱敏</small><button class="btn ghost sm" id="exs">导出明细</button></div><div class="tw"><table class="t"><tr><th>预约单号</th><th>坐诊医院</th><th>科室</th><th>坐诊医生</th><th>号源类别</th><th>就诊时间</th><th>患者姓名</th><th>证件号</th><th>联系电话</th><th>状态</th><th>渠道</th><th>留言</th></tr>
        ${r.rows.map(x => `<tr><td>${esc(x.no)}</td><td>${esc(x.hospitalName)}</td><td>${esc(x.deptName)}</td><td>${esc(x.doctorName)}</td><td>${esc(x.categoryName)}</td><td>${x.date} ${x.period}<br><span class="muted">${x.time}</span></td><td>${esc(x.patientMasked)}</td><td class="muted">${esc(x.patientId)}</td><td class="muted">${esc(x.patientPhone)}</td><td>${stTag(x.status)}</td><td class="muted">${esc(x.channel)}</td><td style="max-width:220px">${x.message ? esc(x.message) : '<span class="muted">—</span>'}</td></tr>`).join('') || '<tr><td colspan="12" class="empty">无符合条件的记录</td></tr>'}</table></div>
        <div class="pager">第 ${r.page} / ${Math.max(1, Math.ceil(r.count / r.size))} 页<button class="btn gray sm" id="pv" ${r.page <= 1 ? 'disabled' : ''}>上一页</button><button class="btn gray sm" id="nx" ${r.page * r.size >= r.count ? 'disabled' : ''}>下一页</button></div></div>`;
      bindFilter(el, SF, () => { SF.page = 1; run(); });
      $('#pv').onclick = () => { SF.page--; run(); }; $('#nx').onclick = () => { SF.page++; run(); };
      $('#exs').onclick = async () => {
        const all = await api('/api/org/stats?' + qs({ ...SF, page: 1, size: 5000 }));
        const head = ['预约单号', '坐诊医院', '科室', '坐诊医生', '号源类别', '就诊日期', '时段', '患者姓名', '状态', '渠道'];
        const csv = [head.join(',')].concat(all.rows.map(x => [x.no, x.hospitalName, x.deptName, x.doctorName, x.categoryName, x.date, x.period + ' ' + x.time, x.patientMasked, x.status, x.channel].join(','))).join('\r\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = '名医预约统计明细_' + todayISO() + '.csv'; a.click(); toast('已导出 ' + all.rows.length + ' 条');
      };
    };
    await run();
  },

  async msgs(el) {
    if (PC.meta.hospitals.length === 1) MF.hospitalId = PC.meta.hospitals[0].id;
    const sel = new Set();
    const run = async () => {
      const list = await api('/api/org/msgs?' + qs(MF));
      sel.clear();
      el.innerHTML = `<div class="card">${filterBar(MF)}</div>
      <div class="card"><div class="card-t">名医预约留言<small>共 ${list.length} 条，患者在提交预约时填写</small>
        <span style="display:flex;gap:8px"><button class="btn ghost" id="exSel" disabled>导出选中（<span id="nSel">0</span>）</button><button class="btn" id="exAll">批量导出全部（${list.length}）</button></span></div>
        <div class="tw"><table class="t"><tr><th><input type="checkbox" class="chk" id="ca"></th><th>提交时间</th><th>坐诊医院</th><th>科室</th><th>坐诊医生</th><th>就诊时间</th><th>患者</th><th>联系电话</th><th>状态</th><th style="width:34%">留言内容</th></tr>
        ${list.map(x => `<tr><td><input type="checkbox" class="chk" data-id="${x.id}"></td><td class="muted">${esc(x.createdAt)}</td><td>${esc(x.hospitalName)}</td><td>${esc(x.deptName)}</td><td>${esc(x.doctorName)}</td><td>${x.date} ${x.period}</td><td>${esc(x.patientMasked)}</td><td class="muted">${esc(x.patientPhone)}</td><td>${stTag(x.status)}</td><td>${esc(x.message)}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">暂无留言</td></tr>'}</table></div>
        <div class="muted" style="margin-top:10px">导出文件为 CSV（UTF-8 BOM，可直接用 Excel 打开），患者姓名与电话按脱敏规则导出；每次导出均记入操作日志。</div></div>`;
      bindFilter(el, MF, run);
      const upd = () => { $('#nSel').textContent = sel.size; $('#exSel').disabled = !sel.size; };
      el.querySelectorAll('[data-id]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.id) : sel.delete(c.dataset.id); upd(); });
      $('#ca').onchange = e => { el.querySelectorAll('[data-id]').forEach(c => { c.checked = e.target.checked; e.target.checked ? sel.add(c.dataset.id) : sel.delete(c.dataset.id); }); upd(); };
      const dl = ids => { const u = '/api/org/msgs/export?' + qs({ ...MF, ids: ids.join(','), token: PC.tk }); const a = document.createElement('a'); a.href = u; a.click(); toast('正在导出…'); };
      $('#exSel').onclick = () => dl([...sel]); $('#exAll').onclick = () => dl([]);
    };
    await run();
  },

  async intents(el) {
    const list = await api('/api/org/intents');
    let tab = '待受理';
    const draw = () => {
      const l = list.filter(i => tab === '全部' || i.status === tab);
      el.innerHTML = `<div class="card"><div class="tabs">${['待受理', '已受理', '已安排', '无法安排', '全部'].map(t => `<button data-t="${t}" class="${t === tab ? 'on' : ''}">${t}（${t === '全部' ? list.length : list.filter(i => i.status === t).length}）</button>`).join('')}</div>
      <div class="muted" style="margin-bottom:10px">居民在“安排医生”中选定目标名医并提交的预约意向，受理/安排结果将通过健康温州消息通知居民。</div>
      <div class="tw"><table class="t"><tr><th>提交时间</th><th>目标名医</th><th>患者</th><th>就医需求</th><th>期望时间</th><th>接受调剂</th><th>留言</th><th>状态</th><th>操作</th></tr>
      ${l.map(i => `<tr><td class="muted">${esc(i.createdAt)}</td><td>${esc(i.doctorName)}<br><span class="muted">${esc(i.hospitalName)}·${esc(i.deptName)}</span></td><td>${esc(i.patientName)}<br><span class="muted">${esc(i.patientPhone)}</span></td><td style="max-width:240px">${esc(i.disease)}</td><td>${esc(i.expect)}</td><td>${i.acceptOther ? '是' : '否'}</td><td style="max-width:180px">${esc(i.message) || '—'}</td><td>${stTag(i.status)}${i.reply ? `<div class="muted">${esc(i.reply)}</div>` : ''}</td>
        <td>${i.status === '待受理' || i.status === '已受理' ? `<button class="btn sm" data-h="${i.id}">处理</button>` : '<span class="muted">—</span>'}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">暂无记录</td></tr>'}</table></div></div>`;
      el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
        const it = list.find(x => x.id === b.dataset.h);
        modal('处理名医预约需求', `<div class="muted">${esc(it.patientName)} → ${esc(it.doctorName)}（${esc(it.hospitalName)}）：${esc(it.disease)}</div>
          <div class="fld"><label>处理结果</label><select class="inp" id="hs"><option>已受理</option><option selected>已安排</option><option>无法安排</option></select></div>
          <div class="fld"><label>回复居民（将推送健康温州消息）</label><textarea class="inp" id="hr" rows="3">已为您安排 ${esc(it.doctorName)} 医生近期加号，请留意预约记录并按时就诊。</textarea></div>`, async m => {
          const r = await api('/api/org/intents/' + it.id, { status: m.querySelector('#hs').value, reply: m.querySelector('#hr').value });
          Object.assign(it, r); toast('已处理，居民已收到通知'); draw();
        });
      });
    };
    draw();
  },

  async stop(el) {
    const m = PC.meta;
    let docId = m.doctors[0]?.id, sel = new Set();
    const draw = async () => {
      const sch = docId ? await api('/api/org/schedule?doctorId=' + docId) : [];
      const stops = await api('/api/org/stops');
      sel.clear();
      el.innerHTML = `<div class="card"><div class="card-t">发起停诊通知<small>停诊后：号源自动停约 → 已约患者自动退号 → 健康温州消息 + 短信通知 → 关注者收到排班变动</small></div>
        <div class="filter"><div class="f">坐诊医生<select class="inp" id="sd" style="width:280px">${opts(m.doctors.map(d => [d.id, d.hospitalShort + ' · ' + d.deptName + ' · ' + d.name]), docId)}</select></div></div>
        <div style="margin:14px 0 8px;font-weight:600">选择停诊时段（未来排班）</div>
        <div class="sched">${sch.map(s => `<button data-k="${s.date}|${s.period}" ${s.status === '停诊' ? 'disabled' : ''}>${s.date} ${'日一二三四五六'[new Date(s.date + 'T00:00:00').getDay()].replace(/^/, '周')} ${s.period}<br><span class="muted">${s.status === '停诊' ? '已停诊' : `已约 ${s.used} / ${s.total}`}</span></button>`).join('') || '<div class="muted">该医生近期无排班</div>'}</div>
        <div class="filter" style="margin-top:14px"><div class="f">停诊原因<select class="inp" id="rs" style="width:240px"><option>名医外出参加学术会议</option><option>名医临时公务安排</option><option>名医身体原因</option><option>院内紧急手术/抢救</option><option>其他原因</option></select></div>
        <button class="btn red" id="go" disabled>发布停诊并通知患者</button></div></div>
      <div class="card"><div class="card-t">停诊记录<small>含医院 HIS 经 RADTS_YYGH_TZ_TINGZHEN 接口推送的停诊</small></div><table class="t"><tr><th>操作时间</th><th>医生</th><th>停诊日期</th><th>时段</th><th>原因</th><th>来源</th><th class="n">退号并通知</th></tr>
        ${stops.map(s => `<tr><td class="muted">${esc(s.t)}</td><td>${esc(s.doctorName)} <span class="muted">${esc(s.hospitalName)}·${esc(s.deptName)}</span></td><td>${s.date}</td><td>${esc(s.period)}</td><td>${esc(s.reason)}</td><td class="muted">${esc(s.source)}</td><td class="n">${s.affected} 人</td></tr>`).join('') || '<tr><td colspan="7" class="empty">暂无停诊记录</td></tr>'}</table></div>`;
      $('#sd').onchange = e => { docId = e.target.value; draw(); };
      el.querySelectorAll('.sched button[data-k]').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.classList.contains('on') ? sel.add(b.dataset.k) : sel.delete(b.dataset.k); $('#go').disabled = !sel.size; });
      $('#go').onclick = () => modal('确认发布停诊', `<p>将对 <b>${sel.size}</b> 个时段发布停诊：${[...sel].map(k => k.replace('|', ' ')).join('、')}。<br>已预约患者将自动退号，并通过 <b>健康温州消息</b> 和 <b>短信</b> 通知。</p>`, async () => {
        let n = 0; for (const k of sel) { const [date, period] = k.split('|'); const r = await api('/api/org/stop', { doctorId: docId, date, period, reason: $('#rs').value }); n += r.affected; }
        toast(`停诊已发布，${n} 位患者已退号并收到通知`); draw();
      }, '确认停诊');
    };
    await draw();
  },
};

startPC({
  key: 'mywz_org', title: '名医温州 · 机构端', brand: '名医温州', brandSub: '机构端 · 医院管理',
  desc: '面向坐诊医院的名医预约管理工作台：按坐诊医院、坐诊医生、患者姓名等维度统计查询预约情况，批量导出预约留言，处理居民名医预约需求，发布停诊通知。',
  loginTitle: '机构管理员登录', loginSub: '请使用平台分配的机构账号登录',
  hint: '演示账号（点击填入）：<br><b data-u="h01" data-p="Org@123">h01 / Org@123</b>　温医大附一 管理员<br><b data-u="h04" data-p="Org@123">h04 / Org@123</b>　市中医院 管理员<br><b data-u="wzyy" data-p="Org@123">wzyy / Org@123</b>　市级统计员（全部坐诊医院）',
  menu: [{ g: '统计分析' }, { id: 'stats', name: '统计查询', icon: '▦' }, { g: '业务处理' }, { id: 'msgs', name: '留言内容导出', icon: '✉' }, { id: 'intents', name: '名医预约需求', icon: '📝', badge: 1 }, { id: 'stop', name: '停诊通知', icon: '⛔' }],
  pages,
  badges: async () => { try { const l = await api('/api/org/intents', null, true); const n = l.filter(i => i.status === '待受理').length; const b = $('#b-intents'); if (b && n) { b.textContent = n; b.style.display = ''; } } catch {} },
});
