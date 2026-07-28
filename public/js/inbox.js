// ============================================================
// 灵感收件箱模块
// ============================================================
const inbox = (() => {
  let inboxFilter = 'all';

  const TYPE_RULES = [
    { t: '商业灵感', k: ['商业', '创业', '赚钱', '产品', '用户', '市场', '生意', '营收', '变现', '商业模式'] },
    { t: '担忧/问题', k: ['担心', '担忧', '怕', '焦虑', '问题', '风险', '不确定', '麻烦', '卡住'] },
    { t: '学习心得', k: ['学', '课程', '知识点', '懂了', '明白了', '读书笔记', '笔记', '理解'] },
    { t: '想购买', k: ['买', '购', '下单', '淘宝', '京东', '购物车', '囤'] },
    { t: '研究主题', k: ['研究', '查一下', '了解', '深入', '课题', '调研', '看看怎么'] },
    { t: '任务', k: ['要', '需要', '记得', '别忘了', '计划', '打算', '应该', '必须', '安排', '完成', '做'] },
    { t: '想法', k: ['想法', '灵感', '点子', '创意', '主意'] },
  ];

  function classifyType(text) {
    for (const r of TYPE_RULES) {
      if (r.k.some(k => text.includes(k))) return r.t;
    }
    return '随想';
  }

  function pickTags(text) {
    const TAG_WORDS = ['学习', '工作', '生活', '健康', '商业', '投资', '读书', '运动', '家庭', '效率', '副业', '写作'];
    return TAG_WORDS.filter(w => text.includes(w));
  }

  function detectTodo(text) {
    const todoK = ['要', '需要', '记得', '别忘了', '计划', '打算', '应该', '必须', '安排', '完成', '去做', '预约', '缴费', '购物', '买'];
    return todoK.some(k => text.includes(k));
  }

  function detectPriority(text) {
    if (/紧急|马上|立刻|尽快|重要|务必/.test(text)) return '高';
    if (/有空|以后|改天|可能|随便|也许|不急|到时候/.test(text)) return '低';
    return '中';
  }

  function parseDue(text) {
    const today = new Date();
    if (/今天/.test(text)) return todayStr(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (/明天/.test(text)) return todayStr(tomorrow);
    return '';
  }

  function makeSummary(text) {
    const first = text.split(/[。！？\n]/)[0].trim();
    if (first.length <= 40) return first || text.slice(0, 40);
    return first.slice(0, 40) + '…';
  }

  function processVoice(raw) {
    raw = raw.trim();
    if (!raw) return null;

    const type = classifyType(raw);
    const tags = pickTags(raw);
    const hasTodo = detectTodo(raw);
    const pri = detectPriority(raw);
    const due = parseDue(raw);
    const summary = makeSummary(raw);

    let status = '已归档';
    let todo = null;
    let question = '';

    if (hasTodo) {
      todo = { content: summary, priority: pri, dueDate: due };
      status = '已转任务';
    } else if (type === '随想' && raw.length < 8) {
      status = '待整理';
      question = '这条想记的是什么类型？需要我帮你设成待办吗？';
    }

    const item = {
      id: uid(),
      raw, summary, type, tags,
      has_todo: hasTodo,
      todo_content: todo?.content || '',
      todo_priority: todo?.priority || '中',
      todo_due_date: todo?.dueDate || null,
      status,
      question,
      created_at: new Date().toISOString()
    };

    window.app.state.inbox.unshift(item);

    if (hasTodo) {
      window.app.state.tasks.push({
        id: uid(),
        name: summary,
        category: type === '商业灵感' ? '商业' : type === '学习心得' ? '学习' : type === '想购买' ? '生活' : '其他',
        created_date: todayStr(),
        due_date: due || null,
        priority: pri,
        status: '待处理',
        notes: raw
      });
    }

    window.app.save();
    return { item, question, hasTodo };
  }

  function submitVoice() {
    const v = document.getElementById('voiceInput').value.trim();
    if (!v) { toast('先说点什么'); return; }

    // 尝试 AI 处理
    const result = processVoice(v);
    document.getElementById('voiceInput').value = '';

    if (result.question) {
      toast('小王：' + result.question);
    } else if (result.hasTodo) {
      toast('已整理并转为任务 ✓');
    } else {
      toast('已收进灵感收件箱 ✓');
    }

    renderInbox();
  }

  function renderInbox() {
    const list = window.app.state.inbox.filter(i => inboxFilter === 'all' || i.status === inboxFilter);
    document.getElementById('inboxCount').textContent = window.app.state.inbox.length ? window.app.state.inbox.length + ' 条' : '';

    if (!list.length) {
      document.getElementById('inboxList').innerHTML = '<div class="empty">收件箱是空的，去说点什么吧。</div>';
      return;
    }

    document.getElementById('inboxList').innerHTML = list.map(i => {
      const st = i.status === '待整理' ? '<span class="pill w">待整理</span>' :
                 i.status === '已转任务' ? '<span class="pill r">已转任务</span>' :
                 '<span class="pill g">已归档</span>';
      const tags = (i.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
      const todo = i.has_todo ? `<div class="meta" style="margin-top:4px">📌 待办：${esc(i.todo_content)} · <span class="pill ${i.todo_priority === '高' ? 'r' : i.todo_priority === '低' ? 'gray' : 'w'}">${i.todo_priority}</span>${i.todo_due_date ? ' · 📅' + i.todo_due_date : ''}</div>` : '';
      const q = i.question ? `<div class="meta" style="margin-top:4px;color:var(--warn)">❓ 小王：${esc(i.question)}</div>` : '';

      return `<div class="card" style="margin-bottom:10px;padding:13px">
        <div class="row between"><span class="pill">${i.type}</span>${st}</div>
        <div class="title" style="margin:6px 0;font-size:14px">${esc(i.summary)}</div>
        <div class="muted" style="font-size:12px;white-space:pre-wrap">原文：${esc(i.raw)}</div>
        ${tags ? '<div style="margin-top:6px">' + tags + '</div>' : ''}${todo}${q}
        <div class="row" style="margin-top:8px;gap:8px">
          ${i.status !== '已转任务' ? `<button class="btn mini ghost" onclick="inbox.inboxToTask('${i.id}')">转为任务</button>` : ''}
          <button class="btn mini soft" onclick="inbox.markInbox('${i.id}','已归档')">标记已处理</button>
          <button class="icon-btn" onclick="inbox.delInbox('${i.id}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  }

  function inboxToTask(id) {
    const i = window.app.state.inbox.find(x => x.id === id);
    if (!i) return;
    window.app.state.tasks.push({
      id: uid(),
      name: i.summary,
      category: i.type === '商业灵感' ? '商业' : i.type === '学习心得' ? '学习' : '其他',
      created_date: todayStr(),
      due_date: i.todo_due_date || null,
      priority: i.todo_priority || '中',
      status: '待处理',
      notes: i.raw
    });
    i.status = '已转任务';
    i.has_todo = true;
    window.app.save();
    window.app.render(window.app.curPage);
    toast('已转为任务 ✓');
  }

  function markInbox(id, s) {
    const i = window.app.state.inbox.find(x => x.id === id);
    if (i) { i.status = s; window.app.save(); window.app.render(window.app.curPage); }
  }

  function delInbox(id) {
    window.app.state.inbox = window.app.state.inbox.filter(x => x.id !== id);
    window.app.save();
    window.app.render(window.app.curPage);
  }

  function initFilters() {
    document.querySelectorAll('#inboxFilter button').forEach(b => {
      b.onclick = () => {
        inboxFilter = b.dataset.f;
        document.querySelectorAll('#inboxFilter button').forEach(x => x.classList.toggle('on', x === b));
        renderInbox();
      };
    });
  }

  return { processVoice, submitVoice, renderInbox, inboxToTask, markInbox, delInbox, initFilters };
})();