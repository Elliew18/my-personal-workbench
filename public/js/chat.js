// ============================================================
// 小王对话模块 - 智谱 AI 驱动
// ============================================================
const chat = (() => {
  const QUICK = ['安排一下今天', '记一下…', '我刚想到…', '我今天做了…', '帮我复盘今天', '整理一下最近的想法'];

  function renderChat() {
    const box = document.getElementById('chatbox');
    if (!window.app.state.chat.length) {
      box.innerHTML = `<div class="msg xw"><div class="av">王</div><div class="bubble">我是小王，你的长期助理。把今天想做的、想到的、担心的都告诉我，我帮你理顺。\n\n现在有 AI 加持，我能更聪明地帮你分类、提取待办、安排日程！</div></div>`;
    } else {
      box.innerHTML = window.app.state.chat.map(m =>
        `<div class="msg ${m.role}"><div class="av">${m.role === 'me' ? '我' : '王'}</div><div class="bubble">${esc(m.text)}</div></div>`
      ).join('');
    }
    box.scrollTop = box.scrollHeight;
    document.getElementById('quickCmds').innerHTML = QUICK.map(q =>
      `<button onclick="chat.quickCmd('${q}')">${q}</button>`
    ).join('');
  }

  function pushMsg(role, text) {
    window.app.state.chat.push({ role, text });
    if (window.app.state.chat.length > 200) window.app.state.chat = window.app.state.chat.slice(-200);
    window.app.save();
  }

  function sendChat() {
    const v = document.getElementById('chatInput').value.trim();
    if (!v) return;

    pushMsg('me', v);
    document.getElementById('chatInput').value = '';

    // 显示加载状态
    const box = document.getElementById('chatbox');
    box.innerHTML += `<div class="msg xw" id="typingIndicator"><div class="av">王</div><div class="typing"><span></span><span></span><span></span></div></div>`;
    box.scrollTop = box.scrollHeight;

    // 尝试 API 调用
    callAI(v).then(reply => {
      // 移除加载指示器
      const indicator = document.getElementById('typingIndicator');
      if (indicator) indicator.remove();

      pushMsg('xw', reply);
      renderChat();
    }).catch(() => {
      // API 失败，使用本地规则回退
      const indicator = document.getElementById('typingIndicator');
      if (indicator) indicator.remove();
      const reply = xiaowangFallback(v);
      pushMsg('xw', reply);
      renderChat();
    });
  }

  async function callAI(message) {
    try {
      // 获取最近的历史
      const history = window.app.state.chat.slice(-10).map(m => ({
        role: m.role === 'me' ? 'user' : 'assistant',
        content: m.text
      }));

      const result = await api.chat.send(message, history);
      return result.reply;
    } catch (e) {
      console.log('[Chat] API 调用失败，使用规则回退:', e.message);
      throw e;
    }
  }

  function quickCmd(q) {
    document.getElementById('chatInput').value = q;
    sendChat();
  }

  // ============ 规则回退（无后端时使用） ============
  function xiaowangFallback(text) {
    const t = text.trim();
    if (/安排.*今天|今天.*安排|排一下今天/.test(t)) return cmdArrange();
    if (/^记一下|^帮我记|记录一下/.test(t)) return cmdNote(t);
    if (/我刚想到|突然想到|刚想到|想到一个/.test(t)) return cmdIdea(t);
    if (/我今天做了|我做了|已经(完成|做完)|搞定了|做完了/.test(t)) return cmdDone(t);
    if (/复盘|总结今天|今日总结/.test(t)) return cmdReview();
    if (/整理.*想法|整理想法|梳理.*想法/.test(t)) return cmdOrganize();

    const result = inbox.processVoice(t);
    if (result.question) return `收到，我先存好原文。\n\n❓ ${result.question}`;
    if (result.hasTodo) return `收到，我留了原文，并帮你提取了待办：\n· ${result.item.todo_content}\n· 优先级：${result.item.todo_priority}${result.item.todo_due_date ? ' · 截止：' + result.item.todo_due_date : ''}\n\n已经放进任务了。`;
    return `收到，已收进灵感收件箱（类型：${result.item.type}）。需要我帮你变成待办吗？`;
  }

  function cmdArrange() {
    const date = todayStr();
    const pool = window.app.state.tasks.filter(t =>
      (t.status === '今天' || t.due_date === date || t.status === '待处理') && t.status !== '已完成'
    );
    if (!pool.length) return '今天没什么任务。要不你告诉我几件想做的？';
    const order = { '高': 0, '中': 1, '低': 2 };
    pool.sort((a, b) => order[a.priority] - order[b.priority]);
    const top3 = pool.slice(0, 3);
    if (!window.app.state.topThree[date]) window.app.state.topThree[date] = ['', '', ''];
    top3.forEach((t, i) => { window.app.state.topThree[date][i] = t.name; });
    window.app.save();

    let s = '我看了你的待办，建议今天这样排：\n\n';
    top3.forEach((t, i) => { s += `${i + 1}. ${t.name}（${t.priority}优先级${t.due_date ? '，' + t.due_date + '截止' : ''}）\n`; });
    if (pool.length > 3) {
      s += '\n其余可以放后面：\n';
      pool.slice(3).forEach(t => s += `· ${t.name}\n`);
    }
    s += '\n已经写进「今日最重要的三件事」了。';
    return s;
  }

  function cmdNote(t) {
    const raw = t.replace(/^记一下[:：]?|^帮我记[:：]?|记录一下[:：]?/, '').trim();
    if (!raw) return '记一下什么？把内容发我就行。';
    const result = inbox.processVoice(raw);
    if (result.hasTodo) return `已记下，并识别成待办：\n· ${result.item.todo_content}（${result.item.todo_priority}优先级${result.item.todo_due_date ? '，' + result.item.todo_due_date : ''}）\n已进任务。`;
    return `已记下原文（类型：${result.item.type}）。收进了灵感收件箱，回头看看要不要用。`;
  }

  function cmdIdea(t) {
    const raw = t.replace(/我刚想到[:：]?|突然想到[:：]?|刚想到[:：]?|想到一个[:：]?/, '').trim();
    if (!raw) return '想到什么了？说来听听。';
    const result = inbox.processVoice(raw);
    const dirs = ideaDirections(result.item.type);
    let s = `记下了（类型：${result.item.type}）。核心：${result.item.summary}\n\n可以往这几个方向想：`;
    dirs.forEach((d, i) => s += `\n${i + 1}. ${d}`);
    s += '\n\n先不急，想清楚再用。';
    return s;
  }

  function ideaDirections(type) {
    if (type === '商业灵感') return ['这个需求是不是真有人愿意付钱？', '最小的验证方式是什么？', '和你现有的资源怎么结合？'];
    if (type === '学习心得') return ['这个知识点能用一句话教给别人吗？', '哪里还能再深入？', '本周能不能用它解决一个实际问题？'];
    if (type === '担忧/问题') return ['最坏的情况是什么，概率多大？', '现在能做的一小步预防是什么？', '哪些是你能控制的？'];
    if (type === '想购买') return ['不买会影响什么？', '有没有更便宜的替代？', '放一周再决定还想要吗？'];
    if (type === '研究主题') return ['先列 3 个最想搞清楚的问题', '去哪里能最快找到靠谱资料？', '研究完能产出什么？'];
    return ['它解决的是什么问题？', '如果只能做一步，先做哪一步？', '一周后回头看，它还重要吗？'];
  }

  function cmdDone(t) {
    let did = [];
    const map = [['学', 'learning'], ['读', 'reading'], ['运动', 'exercise'], ['健身', 'exercise'], ['工作', 'work'], ['生活', 'life']];
    const date = todayStr();
    const h = habits.getHabit(date);
    map.forEach(([k, cat]) => {
      if (t.includes(k)) {
        h[cat] = h[cat] || {};
        h[cat]._done = true;
        did.push(habits.HABIT_CATS.find(c => c.key === cat)?.name + '打卡' || cat);
      }
    });
    const matched = window.app.state.tasks.filter(x => x.status !== '已完成' && t.includes(x.name.slice(0, Math.max(2, x.name.length))));
    if (matched.length) {
      matched.forEach(x => { x.status = '已完成'; did.push('完成任务：' + x.name); });
    }
    window.app.save();
    if (!did.length) return '没对应上具体的任务或习惯，你可以在任务页手动确认。';
    return '已更新 ✅\n' + did.map(d => '· ' + d).join('\n') + '\n\n保持节奏。';
  }

  function cmdReview() {
    const date = todayStr();
    const done = window.app.state.tasks.filter(t => (t.status === '今天' || t.due_date === date) && t.status === '已完成');
    const undone = window.app.state.tasks.filter(t => (t.status === '今天' || t.due_date === date) && t.status !== '已完成');
    const doneHabits = habits.HABIT_CATS.filter(c => {
      const h = habits.getHabit(date);
      return h[c.key] && h[c.key]._done;
    }).map(c => c.name);

    let s = '【今日复盘】\n\n✅ 完成：' + (done.length ? done.map(t => t.name).join('、') : '今天还没标记完成的任务');
    s += '\n🌱 习惯打卡：' + (doneHabits.length ? doneHabits.join('、') : '今天还没打卡');
    s += '\n\n❌ 未完成：' + (undone.length ? undone.map(t => t.name).join('、') : '无');
    s += '\n\n💡 建议：明天优先做最重要的一件事。';
    return s;
  }

  function cmdOrganize() {
    const pend = window.app.state.inbox.filter(i => i.status === '待整理' || i.status === '已归档');
    if (!pend.length) return '最近没有待整理的想法，收件箱很干净。';
    const cats = { 学习: [], 工作: [], 生活: [], 商业想法: [], 健康: [], 其他: [] };
    pend.forEach(i => {
      let c = '其他';
      if (i.type === '学习心得' || i.type === '研究主题') c = '学习';
      else if (i.type === '商业灵感') c = '商业想法';
      else if (i.type === '想购买' || i.type === '随想') c = '生活';
      else if ((i.tags || []).includes('健康')) c = '健康';
      else if (i.type === '担忧/问题' || i.has_todo) c = '工作';
      (cats[c] = cats[c] || []).push(i);
    });
    let s = '【最近的想法汇总】\n';
    Object.keys(cats).forEach(c => {
      if (cats[c] && cats[c].length) {
        s += `\n▸ ${c}（${cats[c].length}）\n`;
        cats[c].forEach(i => s += `  - ${i.summary}\n`);
      }
    });
    s += '\n挑一条最想这周推进的，直接说「记一下」转成任务。';
    return s;
  }

  return { renderChat, sendChat, quickCmd };
})();