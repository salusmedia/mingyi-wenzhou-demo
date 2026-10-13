// 名医温州 · 管理后台（平台）
const WDN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const pages = {
  async home(el) {
    const o = await api('/api/admin/overview');
    const logs = (await api('/api/admin/iflogs')).slice(0, 8);
    el.innerHTML = `<div class="kpis">
      <div class="kpi"><span>各地名医汇</span><b>${o.regions}</b><i>个地区</i></div><div class="kpi"><span>入驻机构</span><b>${o.hospitals}</b><i>家</i></div>
      <div class="kpi"><span>名医档案</span><b>${o.doctors}</b><i>位</i></div><div class="kpi"><span>注册居民</span><b>${o.users}</b><i>人</i></div>
      <div class="kpi"><span>累计预约</span><b>${o.appts}</b><i>人次</i></div><div class="kpi"><span>待处理意见</span><b style="color:var(--acc)">${o.feedbackPending}</b><i>条</i></div></div>
      <div class="row2"><div class="card"><div class="card-t">最近接口调用<a href="#/iface">全部 ›</a></div><table class="t"><tr><th>时间</th><th>方向</th><th>交易</th><th>结果</th></tr>${logs.map(l => `<tr><td class="muted">${esc(l.t.slice(5))}</td><td>${l.dir === '入' ? '<span class="tag blue">调入</span>' : l.dir === '出' ? '<span class="tag">调出</span>' : '<span class="tag gray">内部</span>'}</td><td>${esc(l.code)}<div class="muted">${esc(l.name)}</div></td><td class="${l.ok ? 'ok' : 'err'}">${l.ok ? '成功' : '失败'} · ${l.ms}ms</td></tr>`).join('')}</table></div>
      <div class="card"><div class="card-t">系统实施</div><div style="line-height:2.1;font-size:13px">
        ✅ 系统环境部署：Node 服务 + 持久化存储（演示）<br>✅ 后台账号配置：${'平台 1 个 + 机构若干'}，见“账号配置”<br>✅ 三方接口：健康温州消息平台 / 短信平台 / 统一号源池 / 医院HIS / 公安实名核验<br>✅ 第三方调用接口：号源类别字典、02_01_01_08、停诊通知、名医医生介绍查询<br>
        <span class="muted">数据初始化于 ${esc(o.seededAt)}</span><br><button class="btn red sm" id="rst">重置全部演示数据</button></div></div></div>`;
    $('#rst').onclick = () => modal('重置演示数据', '<p>将清空所有演示操作（预约、留言、消息、日志等）并恢复初始数据，确定吗？</p>', async () => { await api('/api/admin/reset', {}); toast('已重置'); route(); }, '确认重置');
  },

  async region(el) {
    const { regions, settings } = await api('/api/admin/regions');
    el.innerHTML = `<div class="card"><div class="card-t">各地名医汇介绍信息<small>居民端首页“各地名医汇”展示内容</small><button class="btn" id="add">+ 新增地区</button></div>
      <table class="t"><tr><th>编号</th><th>名称</th><th>覆盖区域</th><th>宣传语</th><th style="width:44%">介绍</th><th>操作</th></tr>
      ${regions.map(r => `<tr><td>${r.id}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.area)}</td><td>${esc(r.banner)}</td><td>${esc(r.intro)}</td><td><button class="btn link" data-e="${r.id}">编辑</button></td></tr>`).join('')}</table></div>
      <div class="card"><div class="card-t">平台公告与预约规则<small>居民端首页公告与预约须知</small></div>
        <div class="fld"><label>首页公告</label><textarea class="inp" id="nt" rows="2">${esc(settings.notice)}</textarea></div>
        <div class="fld"><label>预约须知</label><textarea class="inp" id="br" rows="2">${esc(settings.bookRule)}</textarea></div>
        <div style="margin-top:12px"><button class="btn" id="sv">保存</button></div></div>`;
    const edit = r => modal(r ? '编辑名医汇介绍' : '新增名医汇', `<div class="grid2"><div class="fld"><label>名称</label><input class="inp" id="n" value="${esc(r?.name)}"></div><div class="fld"><label>覆盖区域</label><input class="inp" id="a" value="${esc(r?.area)}"></div></div>
      <div class="fld"><label>宣传语</label><input class="inp" id="b" value="${esc(r?.banner)}"></div><div class="fld"><label>介绍</label><textarea class="inp" id="i" rows="4">${esc(r?.intro)}</textarea></div>`, async m => {
      await api('/api/admin/regions', { id: r?.id, name: m.querySelector('#n').value, area: m.querySelector('#a').value, banner: m.querySelector('#b').value, intro: m.querySelector('#i').value });
      toast('已保存，居民端实时生效'); pages.region(el);
    });
    $('#add').onclick = () => edit(null);
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => edit(regions.find(r => r.id === b.dataset.e)));
    $('#sv').onclick = async () => { await api('/api/admin/settings', { notice: $('#nt').value, bookRule: $('#br').value }); toast('已保存'); };
  },

  async hosp(el) {
    const list = await api('/api/admin/hospitals');
    const { regions } = await api('/api/admin/regions');
    el.innerHTML = `<div class="card"><div class="card-t">入驻机构信息<small>共 ${list.length} 家</small></div><table class="t"><tr><th>机构代码</th><th>机构名称</th><th>等级</th><th>所属名医汇</th><th>名医科室</th><th class="n">名医</th><th>状态</th><th>操作</th></tr>
      ${list.map(h => `<tr><td>${esc(h.code)}</td><td><b>${esc(h.name)}</b><div class="muted">${esc(h.addr)}</div></td><td>${esc(h.level)}</td><td>${esc(regions.find(r => r.id === h.region)?.name)}</td><td style="max-width:260px">${h.depts.map(d => `<span class="tag gray" style="margin:1px">${esc(d.name)}</span>`).join('')}</td><td class="n">${h.doctorCount}</td><td>${h.enabled ? '<span class="tag">启用</span>' : '<span class="tag gray">停用</span>'}</td><td><button class="btn link" data-e="${h.id}">编辑</button></td></tr>`).join('')}</table></div>`;
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
      const h = list.find(x => x.id === b.dataset.e);
      modal('编辑机构信息', `<div class="grid2"><div class="fld"><label>机构名称</label><input class="inp" id="n" value="${esc(h.name)}"></div><div class="fld"><label>简称</label><input class="inp" id="s" value="${esc(h.short)}"></div>
        <div class="fld"><label>所属名医汇</label><select class="inp" id="r">${opts(regions.map(r => [r.id, r.name]), h.region)}</select></div><div class="fld"><label>联系电话</label><input class="inp" id="p" value="${esc(h.phone)}"></div></div>
        <div class="fld"><label>地址</label><input class="inp" id="a" value="${esc(h.addr)}"></div><div class="fld"><label>机构介绍</label><textarea class="inp" id="i" rows="3">${esc(h.intro)}</textarea></div>
        <div class="fld"><label><input type="checkbox" id="e" ${h.enabled ? 'checked' : ''}> 在居民端展示</label></div>`, async m => {
        const g = s => m.querySelector(s);
        await api('/api/admin/hospitals', { id: h.id, name: g('#n').value, short: g('#s').value, region: g('#r').value, phone: g('#p').value, addr: g('#a').value, intro: g('#i').value, enabled: g('#e').checked });
        toast('已保存'); pages.hosp(el);
      });
    });
  },

  async doctor(el) {
    const meta = PC.meta; let kw = '', hid = '';
    const run = async () => {
      const list = await api(`/api/admin/doctors?q=${encodeURIComponent(kw)}&hospitalId=${hid}`);
      el.innerHTML = `<div class="card"><div class="filter"><div class="f">机构<select class="inp" id="h">${opts(meta.hospitals.map(h => [h.id, h.name]), hid, '全部机构')}</select></div><div class="f">关键词<input class="inp" id="k" value="${esc(kw)}" placeholder="姓名/科室"></div><button class="btn" id="q">查询</button><span style="flex:1"></span><button class="btn org" id="add">+ 新增名医</button></div></div>
      <div class="card"><div class="card-t">名医档案（${list.length}）<small>保存时经 02_01_01_08 接口同步，含新增“名医类别”字段</small></div><div class="tw"><table class="t"><tr><th>医生代码</th><th>姓名</th><th>机构 / 科室</th><th>职称</th><th>名医类别</th><th>号源类别</th><th>擅长</th><th>坐诊时间</th><th class="n">余号</th><th>状态</th><th>操作</th></tr>
      ${list.map(d => `<tr><td class="muted">${esc(d.code)}</td><td><b>${esc(d.name)}</b></td><td>${esc(d.hospitalShort)}<div class="muted">${esc(d.deptName)}</div></td><td>${esc(d.title)}</td><td>${mylbTag(d.mylb, d.mylbName)}</td><td>${esc(d.hyCategoryName)}</td><td style="max-width:200px" class="muted">${esc(d.specialty.join('、'))}</td><td>${esc(d.scheduleText)}</td><td class="n">${d.remain}</td><td>${d.enabled ? '<span class="tag">上线</span>' : '<span class="tag gray">下线</span>'}</td><td><button class="btn link" data-e="${d.id}">编辑</button></td></tr>`).join('')}</table></div></div>`;
      $('#h').onchange = e => { hid = e.target.value; run(); }; $('#q').onclick = () => { kw = $('#k').value.trim(); run(); };
      $('#add').onclick = () => edit(null);
      el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => edit(list.find(d => d.id === b.dataset.e)));
    };
    const edit = d => {
      const dict = meta.dict;
      const m = modal(d ? '编辑名医档案' : '新增名医', `<div class="grid2">
        <div class="fld"><label>姓名</label><input class="inp" id="n" value="${esc(d?.name)}"></div><div class="fld"><label>性别</label><select class="inp" id="g">${opts([['男', '男'], ['女', '女']], d?.gender)}</select></div>
        <div class="fld"><label>执业机构</label><select class="inp" id="h">${opts(meta.hospitals.map(h => [h.id, h.name]), d?.hospitalId)}</select></div><div class="fld"><label>执业科室</label><select class="inp" id="dp"></select></div>
        <div class="fld"><label>职称</label><select class="inp" id="t">${opts(['主任医师', '副主任医师', '主治医师'].map(x => [x, x]), d?.title)}</select></div><div class="fld"><label>执业证编号</label><input class="inp" id="l" value="${esc(d?.licenseNo)}"></div>
        <div class="fld"><label>名医类别（MYLB）</label><select class="inp" id="my">${opts(dict.mylb.map(x => [x.code, x.code + ' ' + x.name]), d?.mylb)}</select></div><div class="fld"><label>号源类别</label><select class="inp" id="hy">${opts(dict.hyCategory.map(x => [x.code, x.code + ' ' + x.name]), d?.hyCategory)}</select></div>
        <div class="fld"><label>荣誉称号</label><input class="inp" id="ho" value="${esc(d?.honor)}"></div><div class="fld"><label>挂号费(元)</label><input class="inp" id="f" type="number" value="${d?.fee ?? 70}"></div></div>
        <div class="fld"><label>擅长领域（顿号分隔）</label><input class="inp" id="sp" value="${esc(d?.specialty?.join('、'))}"></div>
        <div class="fld"><label>医生介绍</label><textarea class="inp" id="i" rows="3">${esc(d?.intro)}</textarea></div>
        <div class="fld"><label>固定坐诊时间</label><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:12px">${[1, 2, 3, 4, 5, 6, 0].map(w => ['上午', '下午'].map(p => `<label><input type="checkbox" data-w="${w}" data-p="${p}" ${d?.schedule?.some(s => s.weekday === w && s.period === p) ? 'checked' : ''}> ${WDN[w]}${p}</label>`).join('<br>')).map(x => `<div>${x}</div>`).join('')}</div></div>
        <div class="fld"><label><input type="checkbox" id="en" ${!d || d.enabled ? 'checked' : ''}> 在居民端上线展示</label></div>`, async m => {
        const g = s => m.querySelector(s);
        const schedule = [...m.querySelectorAll('[data-w]:checked')].map(c => ({ weekday: +c.dataset.w, period: c.dataset.p }));
        await api('/api/admin/doctors', { id: d?.id, name: g('#n').value, gender: g('#g').value, hospitalId: g('#h').value, deptId: g('#dp').value, title: g('#t').value, licenseNo: g('#l').value, mylb: g('#my').value, hyCategory: g('#hy').value, honor: g('#ho').value, fee: g('#f').value, specialty: g('#sp').value, intro: g('#i').value, schedule, enabled: g('#en').checked });
        toast('已保存并同步（02_01_01_08）'); run();
      }, '保存');
      const fillDept = () => { const h = m.querySelector('#h').value; m.querySelector('#dp').innerHTML = opts(meta.depts.filter(x => x.hospitalId === h).map(x => [x.id, x.name]), d?.deptId); };
      m.querySelector('#h').onchange = fillDept; fillDept();
    };
    await run();
  },

  async pool(el) {
    const meta = PC.meta; const F = { status: '' };
    let tab = 'slot';
    const run = async () => {
      if (tab === 'stop') {
        const stops = await api('/api/org/stops');
        el.innerHTML = tabsHtml() + `<div class="card"><div class="card-t">停诊信息<small>医院 HIS 通过 RADTS_YYGH_TZ_TINGZHEN 推送，或机构端发起</small></div><table class="t"><tr><th>时间</th><th>医生</th><th>停诊日期</th><th>时段</th><th>原因</th><th>来源</th><th>操作人</th><th class="n">退号</th></tr>${stops.map(s => `<tr><td class="muted">${esc(s.t)}</td><td>${esc(s.doctorName)}<div class="muted">${esc(s.hospitalName)}·${esc(s.deptName)}</div></td><td>${s.date}</td><td>${esc(s.period)}</td><td>${esc(s.reason)}</td><td class="muted">${esc(s.source)}</td><td>${esc(s.operator)}</td><td class="n">${s.affected}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">暂无</td></tr>'}</table></div>`;
        return bindTabs();
      }
      if (tab === 'dict') {
        el.innerHTML = tabsHtml() + `<div class="row2"><div class="card"><div class="card-t">新增号源类别字典（4 个）</div><table class="t"><tr><th>代码</th><th>名称</th><th>说明</th><th class="n">基础挂号费</th></tr>${meta.dict.hyCategory.map(c => `<tr><td><b>${c.code}</b></td><td>${esc(c.name)}</td><td class="muted">${esc(c.desc)}</td><td class="n">${c.feeBase}</td></tr>`).join('')}</table>
          <div class="card-t" style="margin-top:18px">名医类别字典（02_01_01_08 新增字段 MYLB）</div><table class="t"><tr><th>代码</th><th>名称</th></tr>${meta.dict.mylb.map(c => `<tr><td>${c.code}</td><td>${esc(c.name)}</td></tr>`).join('')}</table></div>
          <div class="card"><div class="card-t">涉及交易（8 个）</div><table class="t"><tr><th>交易代码</th><th>交易名称</th><th>调整内容</th></tr>${meta.dict.hyTransactions.map(t => `<tr><td style="font-family:monospace;font-size:12px">${t.code}</td><td>${esc(t.name)}</td><td class="muted">${esc(t.note)}</td></tr>`).join('')}</table></div></div>`;
        return bindTabs();
      }
      const list = await api('/api/admin/slots?' + Object.entries(F).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('&'));
      el.innerHTML = tabsHtml() + `<div class="card"><div class="filter">
        <div class="f">机构<select class="inp" data-k="hospitalId">${opts(meta.hospitals.map(h => [h.id, h.name]), F.hospitalId, '全部机构')}</select></div>
        <div class="f">医生<select class="inp" data-k="doctorId">${opts(meta.doctors.filter(d => !F.hospitalId || d.hospitalId === F.hospitalId).map(d => [d.id, d.name + '（' + d.deptName + '）']), F.doctorId, '全部医生')}</select></div>
        <div class="f">号源类别<select class="inp" data-k="category">${opts(meta.dict.hyCategory.map(c => [c.code, c.name]), F.category, '全部')}</select></div>
        <div class="f">状态<select class="inp" data-k="status">${opts([['正常', '正常'], ['停诊', '停诊']], F.status, '全部')}</select></div>
        <span style="flex:1"></span><button class="btn org" id="add">+ 新增号源</button></div></div>
        <div class="card"><div class="card-t">名医号源（未来 14 天，最多显示 400 条）<small>调整保存即同步统一号源池</small></div><div class="tw"><table class="t"><tr><th>日期</th><th>时段</th><th>医生</th><th>机构 / 科室</th><th>号源类别</th><th class="n">挂号费</th><th class="n">已约 / 总数</th><th>状态</th><th>操作</th></tr>
        ${list.map(s => `<tr><td>${s.date} <span class="muted">${WDN[new Date(s.date + 'T00:00:00').getDay()]}</span></td><td>${s.period} ${s.time}</td><td>${esc(s.doctorName)}</td><td>${esc(s.hospitalName)} · ${esc(s.deptName)}</td><td>${esc(s.categoryName)}</td><td class="n">${s.fee}</td><td class="n">${s.used} / ${s.total}</td><td>${s.status === '停诊' ? '<span class="tag red">停诊</span>' : '<span class="tag">正常</span>'}</td><td>${s.status === '正常' ? `<button class="btn link" data-e="${s.id}">调整</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">暂无号源</td></tr>'}</table></div></div>`;
      bindTabs();
      el.querySelectorAll('[data-k]').forEach(i => i.onchange = () => { F[i.dataset.k] = i.value; if (i.dataset.k === 'hospitalId') F.doctorId = ''; run(); });
      el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
        const s = list.find(x => x.id === b.dataset.e);
        modal('调整号源', `<div class="muted">${esc(s.doctorName)} · ${s.date} ${s.period} ${s.time}（已约 ${s.used}）</div><div class="grid2"><div class="fld"><label>号源总数</label><input class="inp" id="t" type="number" min="${s.used}" value="${s.total}"></div><div class="fld"><label>挂号费</label><input class="inp" id="f" type="number" value="${s.fee}"></div></div>
          <div class="fld"><label>号源类别</label><select class="inp" id="c">${opts(meta.dict.hyCategory.map(c => [c.code, c.name]), s.category)}</select></div>`, async m => {
          await api('/api/admin/slots', { id: s.id, total: m.querySelector('#t').value, fee: m.querySelector('#f').value, category: m.querySelector('#c').value }); toast('号源已调整'); run();
        });
      });
      $('#add').onclick = () => modal('新增名医号源（按半天排班）', `<div class="fld"><label>医生</label><select class="inp" id="d">${opts(meta.doctors.map(d => [d.id, d.hospitalShort + ' · ' + d.deptName + ' · ' + d.name]), F.doctorId)}</select></div>
        <div class="grid2"><div class="fld"><label>日期</label><input class="inp" id="dt" type="date" value="${todayISO()}"></div><div class="fld"><label>时段</label><select class="inp" id="p"><option>上午</option><option>下午</option></select></div>
        <div class="fld"><label>每个时间段号源数</label><input class="inp" id="t" type="number" value="3"></div><div class="fld"><label>号源类别</label><select class="inp" id="c">${opts(meta.dict.hyCategory.map(c => [c.code, c.name]))}</select></div></div>
        <div class="muted">将按 4 个时间段生成号源；关注该医生的居民会收到“新增号源”消息。</div>`, async m => {
        const g = s => m.querySelector(s);
        await api('/api/admin/slots', { doctorId: g('#d').value, date: g('#dt').value, period: g('#p').value, total: g('#t').value, category: g('#c').value }); toast('号源已新增'); run();
      });
    };
    const tabsHtml = () => `<div class="tabs">${[['slot', '名医号源'], ['stop', '停诊信息'], ['dict', '号源类别字典']].map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const bindTabs = () => el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; run(); });
    await run();
  },

  async fb(el) {
    const list = await api('/api/admin/feedback');
    el.innerHTML = `<div class="card"><div class="card-t">居民优化意见<small>回复将通过健康温州消息推送给居民</small></div><table class="t"><tr><th>提交时间</th><th>居民</th><th>类型</th><th style="width:36%">内容</th><th>状态</th><th>回复</th><th>操作</th></tr>
      ${list.map(f => `<tr><td class="muted">${esc(f.createdAt)}</td><td>${esc(f.user)}<div class="muted">${esc(f.phone)}</div></td><td><span class="tag">${esc(f.type)}</span></td><td>${esc(f.content)}</td><td>${stTag(f.status)}</td><td class="muted">${esc(f.reply) || '—'}</td><td>${f.status === '待处理' ? `<button class="btn sm" data-r="${f.id}">回复</button>` : ''}</td></tr>`).join('')}</table></div>`;
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => modal('回复意见', `<div class="muted">${esc(list.find(f => f.id === b.dataset.r).content)}</div><div class="fld"><label>回复内容</label><textarea class="inp" id="r" rows="3">感谢您的宝贵意见，我们已记录并将在后续版本中优化。</textarea></div>`, async m => { await api('/api/admin/feedback/' + b.dataset.r, { reply: m.querySelector('#r').value }); toast('已回复'); pages.fb(el); }));
  },

  async acct(el) {
    const list = await api('/api/admin/accounts');
    const meta = PC.meta;
    el.innerHTML = `<div class="card"><div class="card-t">后台账号配置<button class="btn" id="add">+ 新增机构账号</button></div><table class="t"><tr><th>用户名</th><th>名称</th><th>角色</th><th>数据范围</th><th>最近登录</th><th>状态</th><th>操作</th></tr>
      ${list.map(a => `<tr><td><b>${esc(a.username)}</b></td><td>${esc(a.name)}</td><td>${a.role === 'platform' ? '<span class="tag gold">平台管理员</span>' : '<span class="tag">机构管理员</span>'}</td><td>${esc(a.hospitalName)}</td><td class="muted">${esc(a.lastLogin) || '—'}</td><td>${a.disabled ? '<span class="tag gray">停用</span>' : '<span class="tag">正常</span>'}</td><td>${a.role !== 'platform' ? `<button class="btn link" data-e="${a.username}">编辑</button>` : ''}</td></tr>`).join('')}</table></div>`;
    const edit = a => modal(a ? '编辑账号' : '新增机构账号', `<div class="grid2"><div class="fld"><label>用户名</label><input class="inp" id="u" value="${esc(a?.username)}" ${a ? 'disabled' : ''}></div><div class="fld"><label>名称</label><input class="inp" id="n" value="${esc(a?.name)}"></div>
      <div class="fld"><label>数据范围</label><select class="inp" id="h">${opts(meta.hospitals.map(h => [h.id, h.name]), a?.hospitalId || '', '全部坐诊医院（市级）')}</select></div><div class="fld"><label>${a ? '重置密码（留空不改）' : '初始密码'}</label><input class="inp" id="p" type="password"></div></div>
      ${a ? `<div class="fld"><label><input type="checkbox" id="d" ${a.disabled ? 'checked' : ''}> 停用该账号</label></div>` : ''}`, async m => {
      const g = s => m.querySelector(s);
      await api('/api/admin/accounts', { username: g('#u').value, name: g('#n').value, hospitalId: g('#h').value, password: g('#p').value, disabled: a ? g('#d').checked : false }); toast('已保存'); pages.acct(el);
    });
    $('#add').onclick = () => edit(null);
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => edit(list.find(a => a.username === b.dataset.e)));
  },

  async iface(el) {
    const logs = await api('/api/admin/iflogs');
    const T = [['HW_MSG', '健康温州消息平台'], ['SMS', '短信平台'], ['POOL', '统一号源池平台'], ['HIS', '医院HIS预约接口'], ['GA', '公安实名核验服务']];
    el.innerHTML = `<div class="card"><div class="card-t">三方服务联调<small>消息平台、号源池等三方服务连通性测试</small><a class="btn ghost sm" href="/api.html" target="_blank">打开接口文档与在线调试 ↗</a></div>
      <div class="sched">${T.map(([k, n]) => `<button data-p="${k}"><b>${n}</b><br><span class="muted" id="p-${k}">点击测试连通性</span></button>`).join('')}</div></div>
      <div class="card"><div class="card-t">接口调用日志<small>最近 200 条</small></div><div class="tw"><table class="t"><tr><th>时间</th><th>方向</th><th>交易代码</th><th>交易名称</th><th>请求</th><th>响应</th><th>耗时</th></tr>
      ${logs.map(l => `<tr><td class="muted" style="white-space:nowrap">${esc(l.t)}</td><td>${l.dir === '入' ? '<span class="tag blue">调入</span>' : l.dir === '出' ? '<span class="tag">调出</span>' : '<span class="tag gray">内部</span>'}</td><td style="font-family:monospace;font-size:12px">${esc(l.code)}</td><td>${esc(l.name)}</td><td class="muted" style="max-width:240px;word-break:break-all;font-size:11px">${esc(l.req)}</td><td class="${l.ok ? 'ok' : 'err'}" style="max-width:200px;word-break:break-all;font-size:11px">${esc(l.resp)}</td><td>${l.ms}ms</td></tr>`).join('')}</table></div></div>`;
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { const s = $('#p-' + b.dataset.p); s.textContent = '测试中…'; const r = await api('/api/admin/ping', { target: b.dataset.p }); s.innerHTML = `<span class="ok">● 连通正常 ${r.ms}ms</span>`; });
  },
};

startPC({
  key: 'mywz_admin', platformOnly: true, title: '名医温州 · 管理后台', brand: '名医温州', brandSub: '管理后台 · 平台运营',
  desc: '平台运营与系统实施后台：维护各地名医汇介绍信息、入驻机构与名医档案，维护统一号源池（名医号源、停诊信息、号源类别字典），处理居民优化意见，配置后台账号与三方接口联调。',
  loginTitle: '平台管理员登录', loginSub: '仅平台运营人员可访问',
  hint: '演示账号（点击填入）：<br><b data-u="admin" data-p="Admin@123">admin / Admin@123</b>　平台管理员',
  menu: [{ g: '概览' }, { id: 'home', name: '平台概览', icon: '◎' }, { g: '信息维护' }, { id: 'region', name: '名医汇介绍', icon: '✎' }, { id: 'hosp', name: '机构信息', icon: '🏥' }, { id: 'doctor', name: '名医档案', icon: '👨‍⚕️' },
    { g: '接口服务' }, { id: 'pool', name: '号源池维护', icon: '▤' }, { id: 'iface', name: '三方接口联调', icon: '⇄' }, { g: '运营' }, { id: 'fb', name: '优化意见', icon: '💡', badge: 1 }, { id: 'acct', name: '账号配置', icon: '🔑' }],
  pages,
  badges: async () => { try { const l = await api('/api/admin/feedback', null, true); const n = l.filter(f => f.status === '待处理').length; const b = $('#b-fb'); if (b && n) { b.textContent = n; b.style.display = ''; } } catch {} },
});
