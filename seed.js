// 演示数据生成：所有医生、患者均为虚构，身份证号为校验位合法的测试号
const crypto = require('crypto');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CN_OFFSET = 8 * 3600e3;
function today(offsetDays = 0) {
  return new Date(Date.now() + CN_OFFSET + offsetDays * 86400e3).toISOString().slice(0, 10);
}
function nowStr(d = new Date()) {
  return new Date(d.getTime() + CN_OFFSET).toISOString().replace('T', ' ').slice(0, 19);
}
function weekday(dateStr) { return new Date(dateStr + 'T00:00:00Z').getUTCDay(); }

function hashPwd(pwd, salt = crypto.randomBytes(8).toString('hex')) {
  return salt + ':' + crypto.createHash('sha256').update(salt + pwd).digest('hex');
}

// 18 位身份证校验码
function idCheck(id17) {
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const c = '10X98765432';
  let s = 0;
  for (let i = 0; i < 17; i++) s += +id17[i] * w[i];
  return c[s % 11];
}
function makeId(r, birthYear) {
  const area = ['330302', '330303', '330304', '330381', '330382', '330324', '330327'][Math.floor(r() * 7)];
  const m = String(1 + Math.floor(r() * 12)).padStart(2, '0');
  const d = String(1 + Math.floor(r() * 28)).padStart(2, '0');
  const seq = String(Math.floor(r() * 999)).padStart(3, '0');
  const id17 = area + birthYear + m + d + seq;
  return id17 + idCheck(id17);
}

const REGIONS = [
  { id: 'R01', name: '市区名医汇', area: '鹿城·龙湾·瓯海', intro: '汇聚市级三甲医院学科带头人与省市级名医，覆盖心血管、肿瘤、神经、儿科、中医等重点学科，市区居民可就近预约、一号直达。', banner: '市级名医 · 一号直达' },
  { id: 'R02', name: '瑞安名医汇', area: '瑞安市', intro: '依托瑞安市人民医院与温医大附一医院紧密型医联体，市级名医定期下沉坐诊，让瑞安居民在家门口看名医。', banner: '名医下沉 · 家门口看病' },
  { id: 'R03', name: '乐清名医汇', area: '乐清市', intro: '乐清市人民医院联合市区名医工作室，开设名医联合门诊，重点服务慢病管理与疑难病会诊需求。', banner: '名医工作室 · 联合门诊' },
  { id: 'R04', name: '永嘉名医汇', area: '永嘉县', intro: '山区县名医共享计划，市级名医按周轮驻永嘉县人民医院，配合远程会诊，减少群众往返市区奔波。', banner: '山区共享 · 名医轮驻' },
  { id: 'R05', name: '苍南名医汇', area: '苍南县', intro: '浙南名医共享平台，聚焦心脑血管与肿瘤专科，名医定点坐诊与线上复诊相结合。', banner: '浙南共享 · 线上线下' },
];

const HOSPITALS = [
  { id: 'H01', code: '47000001-3', name: '温州医科大学附属第一医院', short: '温医大附一', region: 'R01', level: '三级甲等', addr: '温州市瓯海区南白象街道上蔡村', phone: '0577-5557xxxx', depts: ['心血管内科', '神经内科', '肿瘤内科', '消化内科', '内分泌科', '骨科', '泌尿外科'] },
  { id: 'H02', code: '47000002-1', name: '温州医科大学附属第二医院', short: '温医大附二', region: 'R01', level: '三级甲等', addr: '温州市鹿城区学院西路', phone: '0577-8800xxxx', depts: ['小儿内科', '小儿外科', '妇科', '产科', '骨科', '眼科'] },
  { id: 'H03', code: '47000003-X', name: '温州市人民医院', short: '市人民医院', region: 'R01', level: '三级甲等', addr: '温州市鹿城区仓后街', phone: '0577-8805xxxx', depts: ['妇产科', '儿科', '呼吸内科', '皮肤科', '耳鼻咽喉科'] },
  { id: 'H04', code: '47000004-8', name: '温州市中医院', short: '市中医院', region: 'R01', level: '三级甲等', addr: '温州市鹿城区公园路', phone: '0577-8807xxxx', depts: ['中医内科', '针灸推拿科', '中医妇科', '脾胃病科', '中医骨伤科'] },
  { id: 'H05', code: '47000005-6', name: '温州市中心医院', short: '市中心医院', region: 'R01', level: '三级甲等', addr: '温州市鹿城区大简巷', phone: '0577-8807xxxx', depts: ['感染科', '肾内科', '普外科', '血液内科', '风湿免疫科'] },
  { id: 'H06', code: '47000006-4', name: '瑞安市人民医院', short: '瑞安人医', region: 'R02', level: '三级乙等', addr: '瑞安市万松东路', phone: '0577-6586xxxx', depts: ['心血管内科', '神经内科', '骨科', '消化内科', '儿科'] },
  { id: 'H07', code: '47000007-2', name: '乐清市人民医院', short: '乐清人医', region: 'R03', level: '三级乙等', addr: '乐清市城南街道清远路', phone: '0577-6255xxxx', depts: ['内分泌科', '心血管内科', '肿瘤内科', '呼吸内科', '中医科'] },
  { id: 'H08', code: '47000008-0', name: '永嘉县人民医院', short: '永嘉人医', region: 'R04', level: '二级甲等', addr: '永嘉县上塘镇', phone: '0577-6722xxxx', depts: ['心血管内科', '骨科', '神经内科', '中医科'] },
  { id: 'H09', code: '47000009-9', name: '苍南县人民医院', short: '苍南人医', region: 'R05', level: '二级甲等', addr: '苍南县灵溪镇', phone: '0577-6476xxxx', depts: ['心血管内科', '肿瘤内科', '神经内科', '消化内科'] },
];

const SPECIALTY = {
  '心血管内科': ['冠心病介入治疗', '高血压规范化管理', '心律失常射频消融', '心力衰竭综合诊治', '结构性心脏病'],
  '神经内科': ['脑血管病急性期诊治', '帕金森病与运动障碍', '癫痫', '头痛与眩晕', '认知障碍'],
  '肿瘤内科': ['肺癌靶向与免疫治疗', '消化道肿瘤综合治疗', '乳腺癌全程管理', '肿瘤姑息治疗'],
  '消化内科': ['消化内镜诊疗', '炎症性肠病', '幽门螺杆菌根除', '胃肠早癌筛查', '肝硬化并发症'],
  '内分泌科': ['糖尿病及并发症', '甲状腺疾病', '骨质疏松', '肥胖与代谢综合征'],
  '骨科': ['关节置换', '脊柱微创', '运动医学与关节镜', '创伤骨科', '骨质疏松性骨折'],
  '泌尿外科': ['泌尿系结石微创治疗', '前列腺疾病', '泌尿系肿瘤腹腔镜手术'],
  '小儿内科': ['儿童哮喘', '儿童生长发育', '新生儿疾病', '小儿消化疾病'],
  '小儿外科': ['小儿腹腔镜手术', '先天性畸形矫治', '小儿泌尿外科'],
  '妇科': ['妇科肿瘤', '宫腔镜腹腔镜微创', '子宫内膜异位症'],
  '产科': ['高危妊娠管理', '产前诊断', '妊娠期糖尿病'],
  '眼科': ['白内障超声乳化', '青光眼', '眼底病', '儿童近视防控'],
  '妇产科': ['高危妊娠', '妇科内分泌', '不孕不育'],
  '儿科': ['儿童呼吸系统疾病', '儿童过敏性疾病', '小儿发热诊治'],
  '呼吸内科': ['慢阻肺', '肺结节诊治', '支气管镜介入', '哮喘规范化治疗'],
  '皮肤科': ['银屑病', '湿疹与特应性皮炎', '痤疮', '皮肤美容'],
  '耳鼻咽喉科': ['鼻内镜手术', '慢性鼻窦炎', '听力障碍', '睡眠呼吸暂停'],
  '中医内科': ['失眠中医调理', '慢性咳嗽', '亚健康调理', '膏方调治'],
  '针灸推拿科': ['颈肩腰腿痛', '面瘫', '中风后康复'],
  '中医妇科': ['月经病', '不孕症中医调治', '围绝经期综合征'],
  '脾胃病科': ['慢性胃炎', '功能性消化不良', '肠易激综合征'],
  '中医骨伤科': ['骨折手法复位', '腰椎间盘突出症', '膝骨关节炎'],
  '感染科': ['病毒性肝炎', '发热待查', '肝病综合治疗'],
  '肾内科': ['慢性肾脏病', '血液透析', 'IgA肾病', '糖尿病肾病'],
  '普外科': ['甲状腺乳腺外科', '胃肠外科', '肝胆胰外科', '疝与腹壁外科'],
  '血液内科': ['白血病', '淋巴瘤', '贫血诊治'],
  '风湿免疫科': ['类风湿关节炎', '系统性红斑狼疮', '痛风'],
  '中医科': ['慢病中医调理', '体质辨识', '针灸'],
};

const SURN = '陈林黄王张李吴郑周徐叶朱潘金胡蔡章余池董戴谢杨孙应季项邵'.split('');
const GIVEN = '建国 立新 海峰 晓东 文华 志强 雪梅 丽君 国平 建华 一鸣 晓燕 春晖 振宇 慧敏 永康 海燕 宏伟 秋云 伟明 静怡 光辉 明远 爱华 碧霞 少华 卫东 锦程 晨曦 子轩'.split(' ');
const PGIVEN = '小明 秀英 志华 美玲 建军 婷婷 浩然 雨萱 国强 佳怡 俊杰 欣怡 宇航 梓涵 家豪 思琪 晓峰 文静 天宇 丽华'.split(' ');

const MYLB = [ // 名医类别（02_01_01_08 新增字段）
  { code: '1', name: '国家级名医' },
  { code: '2', name: '省级名医' },
  { code: '3', name: '市级名医' },
  { code: '4', name: '名中医' },
];

const HY_CATEGORY = [ // 新增 4 个号源类别字典
  { code: 'MYH01', name: '名医专家号', desc: '省、市级名医常规专家门诊号源', feeBase: 50 },
  { code: 'MYH02', name: '名中医专家号', desc: '名中医（含国医馆）门诊号源，含中医辨证施治', feeBase: 50 },
  { code: 'MYH03', name: '名医特需号', desc: '国家级/省级名医特需门诊，限量预约', feeBase: 200 },
  { code: 'MYH04', name: '名医团队联合门诊号', desc: '名医领衔的多学科团队（MDT）联合门诊号源', feeBase: 150 },
];

const HY_TRANSACTIONS = [ // 涉及的 8 个交易
  { code: 'RADTS_YYGH_HYCX', name: '号源查询', note: '号源类别入参新增 MYH01~MYH04' },
  { code: 'RADTS_YYGH_PBCX', name: '排班查询', note: '出参返回号源类别名称' },
  { code: 'RADTS_YYGH_HYSD', name: '号源锁定', note: '校验名医号源类别限约规则' },
  { code: 'RADTS_YYGH_YYGH', name: '预约挂号', note: '按号源类别计费' },
  { code: 'RADTS_YYGH_QXYY', name: '取消预约', note: '特需号退号规则区分' },
  { code: 'RADTS_YYGH_GY', name: '改约', note: '同号源类别内改约' },
  { code: 'RADTS_YYGH_YYJL', name: '预约记录查询', note: '出参返回号源类别' },
  { code: 'RADTS_YYGH_TZ_TINGZHEN', name: '停诊通知', note: '新增交易，按号源类别批量退号' },
];

const SEGMENTS = {
  '上午': ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-11:30'],
  '下午': ['13:30-14:30', '14:30-15:30', '15:30-16:30', '16:30-17:00'],
};

function buildSeed() {
  const r = rng(20261013);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const db = {
    meta: { seededAt: nowStr(), version: 1 },
    settings: {
      platformName: '名医温州',
      notice: '本平台为“温州名医汇”演示系统，所有医生、患者均为虚构的脱敏测试数据。',
      bookRule: '可预约未来 14 天号源；就诊日前一天 17:00 前可在线取消或改约；同一就诊人同一医生同一天限约 1 个号。',
    },
    regions: REGIONS.map(x => ({ ...x })),
    hospitals: [], depts: [], doctors: [], slots: [], users: [], appointments: [], intents: [],
    follows: [], feedback: [], messages: [], sms: [], iflogs: [], stops: [], sessions: {},
    dict: { mylb: MYLB, hyCategory: HY_CATEGORY, hyTransactions: HY_TRANSACTIONS },
    accounts: [],
  };

  let deptSeq = 1, docSeq = 1;
  const usedNames = new Set();
  for (const h of HOSPITALS) {
    const hosp = { id: h.id, code: h.code, name: h.name, short: h.short, region: h.region, level: h.level, addr: h.addr, phone: h.phone,
      intro: `${h.name}是${h.level}${h.id === 'H04' ? '中医医院' : '综合性医院'}，${h.region === 'R01' ? '承担温州市区及浙南地区疑难重症诊治任务' : '是县域医疗中心，与市级医院建立紧密型医联体'}。本院入驻“名医温州”平台的名医均通过机构遴选与平台审核。`,
      enabled: true };
    db.hospitals.push(hosp);
    for (const dn of h.depts) {
      const dept = { id: 'D' + String(deptSeq++).padStart(3, '0'), hospitalId: h.id, name: dn, code: 'KS' + String(deptSeq).padStart(4, '0') };
      db.depts.push(dept);
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        let name;
        do { name = pick(SURN) + pick(GIVEN); } while (usedNames.has(name));
        usedNames.add(name);
        const isTcm = /中医|针灸|脾胃/.test(dn) || h.id === 'H04';
        const lvlRoll = r();
        const mylb = isTcm ? '4' : lvlRoll < 0.12 ? '1' : lvlRoll < 0.45 ? '2' : '3';
        const hyCat = mylb === '4' ? 'MYH02' : mylb === '1' ? 'MYH03' : r() < 0.18 ? 'MYH04' : 'MYH01';
        const title = pick(['主任医师', '主任医师', '主任医师', '副主任医师']);
        const age = 42 + Math.floor(r() * 20);
        const spec = SPECIALTY[dn] || ['常见病多发病诊治'];
        const sp = [...spec].sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 2));
        const sched = [];
        const days = [1, 2, 3, 4, 5, 6].sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * 3));
        for (const d of days) sched.push({ weekday: d, period: r() < 0.6 ? '上午' : '下午' });
        sched.sort((a, b) => a.weekday - b.weekday);
        const cat = HY_CATEGORY.find(c => c.code === hyCat);
        const doc = {
          id: 'Y' + String(docSeq).padStart(4, '0'), code: 'YS' + String(100000 + docSeq), hospitalId: h.id, deptId: dept.id,
          name, gender: r() < 0.68 ? '男' : '女', title, mylb, hyCategory: hyCat,
          honor: mylb === '1' ? pick(['享受国务院政府特殊津贴专家', '国家临床重点专科学科带头人']) : mylb === '2' ? pick(['浙江省医坛新秀', '省级重点学科带头人', '浙江省名医']) : mylb === '4' ? pick(['浙江省名中医', '温州市名中医', '全国老中医药专家学术经验继承指导老师']) : pick(['温州市名医', '温州市“551人才”第一层次', '市级重点学科带头人']),
          licenseNo: '1103303' + String(10000000 + Math.floor(r() * 89999999)).slice(0, 8),
          practiceYears: age - 24, specialty: sp,
          intro: `${name}，${title}，${['医学博士', '医学硕士', '医学博士，硕士生导师', '教授，博士生导师'][Math.floor(r() * 4)]}，从事${dn}临床工作${age - 24}年。擅长${sp.join('、')}。曾赴${pick(['上海', '北京', '美国', '德国', '香港'])}进修学习，主持省市级科研课题多项。`,
          schedule: sched, fee: cat.feeBase + (title === '主任医师' ? 20 : 0), avatarColor: pick(['#0e7c86', '#2f6fde', '#c0663a', '#7b5bd6', '#2c8a4b', '#b8456b']),
          services: ['预约挂号', '名医预约需求', isTcm ? '膏方门诊' : '复诊续方'],
          enabled: true, updatedAt: nowStr(),
        };
        docSeq++;
        db.doctors.push(doc);
      }
    }
  }

  // 生成 -60 ~ +14 天号源
  let slotSeq = 1;
  for (let off = -60; off <= 14; off++) {
    const date = today(off);
    const wd = weekday(date);
    for (const doc of db.doctors) {
      for (const s of doc.schedule) {
        if (s.weekday !== wd) continue;
        SEGMENTS[s.period].forEach((seg, i) => {
          const total = doc.hyCategory === 'MYH03' ? 2 : 3 + (i < 2 ? 2 : 0);
          db.slots.push({ id: 'S' + slotSeq++, doctorId: doc.id, hospitalId: doc.hospitalId, deptId: doc.deptId, date, period: s.period, time: seg,
            category: doc.hyCategory, fee: doc.fee, total, used: 0, status: '正常' });
        });
      }
    }
  }

  // 演示居民账号 + 历史患者
  const demoId = makeId(r, '1978');
  db.users.push({ id: 'U0001', phone: '13800000001', name: '演示用户', idCard: demoId, verified: true, password: hashPwd('Demo@123'), createdAt: nowStr(new Date(Date.now() - 40 * 86400e3)) });
  for (let i = 2; i <= 140; i++) {
    db.users.push({ id: 'U' + String(i).padStart(4, '0'), phone: '139' + String(10000000 + Math.floor(r() * 89999999)), name: pick(SURN) + pick(PGIVEN),
      idCard: makeId(r, String(1950 + Math.floor(r() * 55))), verified: true, password: hashPwd('Test@123'), createdAt: nowStr(new Date(Date.now() - (40 + i) * 86400e3)) });
  }

  const GEN = ['带外院检查报告，请医生帮忙看一下。', '老人行动不便，希望能安排靠前的时段。', '术后复查，需要开具复查单。', '复诊，想调整用药方案。', '外地过来，希望当天能完成检查。'];
  const BYDEPT = [
    [/心血管/, ['近两周反复胸闷，活动后加重，想看看是否需要做造影。', '血压波动大，想调整降压方案。', '心悸、早搏一个月，动态心电图已做。']],
    [/神经/, ['反复头晕两周，外院CT未见异常。', '手抖半年，怀疑帕金森病。', '偏头痛反复发作，想规范治疗。']],
    [/肿瘤|血液/, ['体检发现肺结节8mm，复查略有增大，想咨询处理方案。', '术后化疗方案咨询。', '靶向药服用中，复查评估。']],
    [/消化|脾胃|普外/, ['胃镜提示萎缩性胃炎，想复查。', '反复腹胀便秘，想做肠镜。', '幽门螺杆菌阳性，想咨询根除方案。']],
    [/内分泌/, ['血糖控制不好，空腹在9左右，想调整用药。', '外院诊断甲状腺结节4a类，想再确认。']],
    [/骨|伤/, ['膝关节疼痛三年，上下楼加重，想咨询是否需要手术。', '腰痛伴腿麻，MRI提示腰椎间盘突出。']],
    [/儿|小儿/, ['孩子反复咳嗽一个多月，用药效果不明显。', '孩子身高偏矮，想做生长发育评估。']],
    [/妇|产/, ['月经不规律半年，想调理。', '孕24周，糖耐量偏高。']],
    [/中医|针灸|内科$/, ['失眠半年，想中医调理。', '慢性咳嗽，想开膏方调理。', '颈肩痛反复，想做针灸。']],
    [/呼吸/, ['慢阻肺，近期气喘加重。', '体检发现肺结节，想咨询随访方案。']],
    [/皮肤/, ['湿疹反复发作，想规范治疗。']],
    [/肾/, ['体检尿蛋白阳性，肌酐偏高。']],
  ];
  const diseaseFor = dn => { const m = BYDEPT.find(([re]) => re.test(dn)); return m ? pick(m[1]) : '症状反复，想请名医进一步明确诊断和治疗方案。'; };
  const msgFor = dn => { const m = BYDEPT.find(([re]) => re.test(dn)); return r() < 0.7 && m ? pick(m[1]) : pick(GEN); };

  let apSeq = 1;
  const todayStr = today(0);
  const pastSlots = db.slots.filter(s => s.date < todayStr);
  const futureSlots = db.slots.filter(s => s.date >= todayStr);
  const mkAppt = (slot, user, status, msgP) => {
    if (slot.used >= slot.total) return;
    slot.used++;
    const created = new Date(Math.min(Date.now() - 3600e3 * (1 + Math.floor(r() * 30)), new Date(slot.date + 'T09:00:00+08:00').getTime() - (1 + Math.floor(r() * 6)) * 86400e3 + Math.floor(r() * 36000e3)));
    const ap = { id: 'A' + String(apSeq++).padStart(6, '0'), no: 'MY' + slot.date.replace(/-/g, '') + String(1000 + apSeq), userId: user.id, slotId: slot.id,
      doctorId: slot.doctorId, hospitalId: slot.hospitalId, deptId: slot.deptId, date: slot.date, period: slot.period, time: slot.time, category: slot.category,
      fee: slot.fee, status, message: r() < msgP ? msgFor(db.depts.find(x => x.id === slot.deptId).name) : '', channel: pick(['健康温州公众号', '健康温州小程序', '健康温州小程序']), createdAt: nowStr(created),
      logs: [{ t: nowStr(created), a: '预约成功', by: '居民' }] };
    if (status === '已取消') ap.logs.push({ t: nowStr(new Date(created.getTime() + 86400e3)), a: '居民取消预约', by: '居民' });
    if (status === '已完成') ap.logs.push({ t: slot.date + ' ' + slot.time.slice(0, 5) + ':00', a: '已签到就诊', by: '医院' });
    if (status === '爽约') ap.logs.push({ t: slot.date + ' 18:00:00', a: '未按时就诊，记爽约一次', by: '系统' });
    if (status === '已取消') slot.used--;
    db.appointments.push(ap);
  };
  for (let i = 0; i < 420; i++) {
    const s = pick(pastSlots); const u = db.users[1 + Math.floor(r() * 139)];
    const roll = r();
    mkAppt(s, u, roll < 0.82 ? '已完成' : roll < 0.93 ? '已取消' : '爽约', 0.35);
  }
  for (let i = 0; i < 90; i++) {
    const s = pick(futureSlots); const u = db.users[1 + Math.floor(r() * 139)];
    mkAppt(s, u, r() < 0.9 ? '待就诊' : '已取消', 0.4);
  }
  // 演示用户自带两条记录
  const demo = db.users[0];
  const f1 = futureSlots.find(s => s.date > todayStr && s.category === 'MYH01' && s.used < s.total);
  if (f1) mkAppt(f1, demo, '待就诊', 0), (db.appointments[db.appointments.length - 1].message = '近期血压波动较大，想调整降压方案。');
  const p1 = pastSlots.find(s => s.used < s.total);
  if (p1) mkAppt(p1, demo, '已完成', 0);

  db.follows.push({ userId: 'U0001', doctorId: db.doctors[0].id, t: nowStr() }, { userId: 'U0001', doctorId: db.doctors[5].id, t: nowStr() });

  // 预约意向（安排医生）
  for (let i = 0; i < 18; i++) {
    const d = pick(db.doctors); const u = db.users[1 + Math.floor(r() * 139)]; const dn = db.depts.find(x => x.id === d.deptId).name;
    const st = pick(['待受理', '待受理', '已受理', '已安排', '已安排']);
    db.intents.push({ id: 'I' + String(i + 1).padStart(5, '0'), userId: u.id, doctorId: d.id, hospitalId: d.hospitalId, deptId: d.deptId, disease: diseaseFor(dn),
      expect: pick(['本周内', '两周内', '工作日上午', '周末', '尽快']), acceptOther: r() < 0.5, message: r() < 0.5 ? '最近号源已约满，希望能加号。' : pick(GEN), status: st,
      reply: st === '已安排' ? '已为您安排名医号源，请留意预约记录。' : st === '已受理' ? '医院已受理，正在协调名医排班。' : '',
      createdAt: nowStr(new Date(Date.now() - Math.floor(r() * 20) * 86400e3)) });
  }
  db.intents.push({ id: 'I00019', userId: 'U0001', doctorId: db.doctors[3].id, hospitalId: db.doctors[3].hospitalId, deptId: db.doctors[3].deptId,
    disease: '体检发现颈动脉斑块，想咨询是否需要用药。', expect: '两周内', acceptOther: true, message: '最近号源已约满，希望能加号。', status: '已受理',
    reply: '医院已受理，正在协调名医排班，安排后将通过健康温州消息通知您。', createdAt: nowStr(new Date(Date.now() - 2 * 86400e3)) });

  db.feedback.push(
    { id: 'F0001', userId: 'U0001', type: '功能建议', content: '希望在医生页面能看到大概的候诊时间。', contact: '13800000001', status: '已回复', reply: '感谢建议，候诊时间预估功能已列入下一版本计划。', createdAt: nowStr(new Date(Date.now() - 5 * 86400e3)) },
    { id: 'F0002', userId: 'U0012', type: '预约体验', content: '名医号太难约，能否增加候补功能？', contact: '', status: '待处理', reply: '', createdAt: nowStr(new Date(Date.now() - 1 * 86400e3)) },
    { id: 'F0003', userId: 'U0033', type: '平台使用', content: '字体有点小，老年人看不清，建议增加长辈模式。', contact: '', status: '待处理', reply: '', createdAt: nowStr(new Date(Date.now() - 3 * 86400e3)) },
  );

  db.messages.push(
    { id: 'M0001', userId: 'U0001', channel: '健康温州消息', type: '预约成功', title: '名医预约成功通知', content: '您已成功预约名医号源，请按时就诊。', read: true, t: nowStr(new Date(Date.now() - 3 * 86400e3)) },
    { id: 'M0002', userId: 'U0001', channel: '健康温州消息', type: '意向受理', title: '名医预约需求已受理', content: '您提交的名医预约需求医院已受理，正在协调名医排班。', read: false, t: nowStr(new Date(Date.now() - 2 * 86400e3)) },
  );

  // 机构/平台账号
  db.accounts.push({ username: 'admin', password: hashPwd('Admin@123'), role: 'platform', name: '温州市卫健委信息中心（平台管理员）', hospitalId: null });
  db.accounts.push({ username: 'wzyy', password: hashPwd('Org@123'), role: 'org', name: '市级（全部坐诊医院）统计员', hospitalId: null });
  for (const h of db.hospitals) db.accounts.push({ username: h.id.toLowerCase(), password: hashPwd('Org@123'), role: 'org', name: h.name + ' 管理员', hospitalId: h.id });

  // 历史停诊
  const stopSlot = futureSlots.find(s => s.date > today(2));
  db._pendingStop = stopSlot ? { doctorId: stopSlot.doctorId, date: stopSlot.date, period: stopSlot.period } : null;
  return db;
}

module.exports = { buildSeed, hashPwd, idCheck, today, nowStr, weekday, SEGMENTS };
