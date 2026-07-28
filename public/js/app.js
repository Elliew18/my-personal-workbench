// ============================================================
// 主应用模块 - 工作台核心
// ============================================================
const app = (() => {
  let sbClient = null;
  let currentUser = null;
  let curPage = 'home';
  let state = defaults();

  function defaults() {
    return {
      topThree: {},
      tasks: [],
      habits: {},
      inbox: [],
      chat: [],
      reviews: { daily: {}, weekly: {} }
    };
  }

  // ============ 工具函数 ============
  function todayStr(d) {
    d = d || new Date();
    const y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, '0'),
      day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ============ 数据持久化 ============
  async function save() {
    if (!sbClient || !currentUser) return;
    try {
      await sbClient.from('workbench_state').upsert({
        user_id: currentUser.id,
        data: state,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('[Save] 失败:', e);
    }
  }

  async function loadData() {
    const { data, error } = await sbClient.from('workbench_state')
      .select('data').eq('user_id', currentUser.id).maybeSingle();
    if (data && data.data) {
      state = Object.assign(defaults(), data.data);
    } else {
      state = defaults();
    }
    await save(); // 确保用户行存在
  }

  // ============ 初始化 ============
  async function initSupabase() {
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY;
    if (!url || !key) { auth.showConfigError(); return; }

    try {
      const sbFactory = window.supabase;
      if (!sbFactory || typeof sbFactory.createClient !== 'function') {
        auth.setLoginMsg('❌ Supabase JS SDK 未加载，请检查网络');
        auth.showLogin();
        return;
      }

      sbClient = sbFactory.createClient(url, key);
      window._sbClient = sbClient;
      auth.init(sbClient);

      const { data: sessData } = await sbClient.auth.getSession();
      const session = sessData && sessData.session;
      if (session && session.user) {
        await enterApp(session.user);
      } else {
        auth.showLogin();
      }

      sbClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          await enterApp(session.user);
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          auth.showLogin();
        }
      });

      // 调试信息
      const di = document.getElementById('debugInfo');
      if (di) {
        di.textContent = `版本: 20260728b-v2\nSUPABASE_URL: ${url}\nAI: ${api ? '已连接' : '未连接'}\nSession: ${session ? '有(' + session.user.email + ')' : '无'}\nTime: ${new Date().toISOString()}`;
      }

      // 检查后端 AI 状态
      checkAIStatus();

    } catch (e) {
      console.error('[Init] 失败:', e);
      auth.setLoginMsg('❌ 初始化失败：' + (e.message || e));
      auth.showLogin();
    }
  }

  async function checkAIStatus() {
    try {
      const health = await api.health();
      if (health.ai === 'connected') {
        const badge = document.getElementById('aiBadge');
        if (badge) badge.textContent = 'v2 · AI 智谱';
        const chatBadge = document.getElementById('chatAiBadge');
        if (chatBadge) chatBadge.style.display = 'inline-flex';
      }
    } catch (e) {
      console.log('[AI] 后端未连接，使用规则模式');
    }
  }

  // ============ 进入应用 ============
  let _enterLock = false;

  async function enterApp(user) {
    if (_enterLock) return;
    _enterLock = true;
    try {
      currentUser = user;
      await loadData();
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      renderTop();
      render('home');
      toast('已同步云端 ✓');
    } catch (e) {
      console.error('[enterApp] 错误:', e);
      currentUser = user;
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      renderTop();
      render('home');
    } finally {
      _enterLock = false;
    }
  }

  // ============ 导航 ============
  function goto(p) {
    document.querySelectorAll('.tabbar button').forEach(b =>
      b.classList.toggle('active', b.dataset.p === p)
    );
    document.querySelectorAll('section.page').forEach(s =>
      s.classList.toggle('active', s.id === 'page-' + p)
    );
    render(p);
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tabbar button').forEach(b => {
    b.onclick = () => goto(b.dataset.p);
  });

  // ============ 渲染调度 ============
  function render(p) {
    curPage = p;
    switch (p) {
      case 'home': renderHome(); break;
      case 'habit': habits.renderHabit(); break;
      case 'task': tasks.renderTasks(); break;
      case 'inbox': inbox.renderInbox(); break;
      case 'chat': chat.renderChat(); break;
      case 'review': review.renderReview(); break;
    }
  }

  // ============ 日期/问候 ============
  function renderTop() {
    const d = new Date();
    const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    $('topDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${w}`;
    const h = d.getHours();
    let g = h < 5 ? '夜深了，注意休息' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : h < 22 ? '晚上好' : '夜深了，早点休息';
    $('greet').textContent = g + '，今天也稳稳推进 👋';
  }

  // ============ 首页 ============
  function renderHome() {
    const date = todayStr();
    if (!state.topThree[date]) state.topThree[date] = ['', '', ''];
    const t3 = state.topThree[date];

    $('topThree').innerHTML = t3.map((v, i) =>
      `<div class="item" style="border:none;padding:4px 0">
        <span class="muted" style="font-size:13px;width:18px">${i + 1}</span>
        <input value="${esc(v)}" data-i="${i}" onchange="app.updTop3(${i},this.value)" placeholder="第${i + 1}件重要的事">
      </div>`
    ).join('');

    const todays = state.tasks.filter(t =>
      (t.status === '今天' || t.due_date === date) && t.status !== '已完成'
    );
    $('todoCount').textContent = todays.length ? `${todays.length} 项` : '暂无';
    $('homeTodos').innerHTML = todays.length ?
      todays.map(t => tasks.taskItem(t)).join('') :
      '<div class="empty">今天还没有排进待办，下面添加一件吧。</div>';

    const done = habits.habitDone(date);
    const total = habits.HABIT_CATS.length;
    $('habitProgressText').textContent = `${done}/${total} 已完成`;
    $('homeHabits').innerHTML = habits.HABIT_CATS.map(c => {
      const h = habits.getHabit(date)[c.key] || {};
      const on = h._done;
      let mini = '';
      if (c.key === 'learning') mini = h.duration ? ('学 ' + h.duration) : '';
      if (c.key === 'reading') mini = h.book ? ('读《' + h.book + '》') : '';
      if (c.key === 'exercise') mini = h.type ? ('练 ' + h.type) : '';
      if (c.key === 'work') mini = h.top ? ('重点:' + h.top.slice(0, 12)) : '';
      if (c.key === 'life') mini = h.temp ? ('临时 ' + h.temp.slice(0, 12)) : '';
      return `<div class="item" style="border:none;padding:8px 0;cursor:pointer" onclick="app.goto('habit')">
        <div class="chk ${on ? 'on' : ''}" onclick="event.stopPropagation();habits.toggleHabit('${c.key}')">${on ? '✓' : ''}</div>
        <div class="body"><div class="title">${c.name}</div><div class="meta">${on ? '今日已打卡' : (mini || '点击去记录')}</div></div>
      </div>`;
    }).join('');

    const allToday = state.tasks.filter(t => t.status === '今天' || t.due_date === date);
    const doneTodo = state.tasks.filter(t => (t.status === '今天' || t.due_date === date) && t.status === '已完成').length;
    const tot = allToday.length + total;
    const fin = doneTodo + done;
    const pct = tot ? Math.round(fin / tot * 100) : 0;
    $('homeProgress').style.width = pct + '%';
    $('homeProgressNum').textContent = pct + '%';

    const pend = state.inbox.filter(i => i.status === '待整理').slice(0, 5)
      .concat(state.tasks.filter(t => t.status === '收件箱' || t.status === '待处理').slice(0, 5).map(t => ({ _task: true, ...t })));
    $('homePending').innerHTML = pend.length ?
      pend.map(x => {
        if (x._task) return `<div class="item" style="border:none;padding:8px 0;cursor:pointer" onclick="app.goto('task')">
          <span class="pill gray">任务</span><div class="body"><div class="title">${esc(x.name)}</div><div class="meta">${x.category} · ${x.status}</div></div></div>`;
        return `<div class="item" style="border:none;padding:8px 0;cursor:pointer" onclick="app.goto('inbox')">
          <span class="pill">${x.type}</span><div class="body"><div class="title">${esc(x.summary)}</div><div class="meta">${x.status}</div></div></div>`;
      }).join('') :
      '<div class="empty">收件箱和待处理都清空啦，干净 ✨</div>';
  }

  function updTop3(i, v) {
    state.topThree[todayStr()][i] = v;
    save();
  }

  // ============ 键盘事件 ============
  document.addEventListener('keydown', e => {
    if (e.target.id === 'quickTodo' && e.key === 'Enter') {
      const v = e.target.value.trim();
      if (v) {
        state.tasks.push({
          id: uid(),
          name: v,
          category: '其他',
          created_date: todayStr(),
          due_date: null,
          priority: '中',
          status: '今天',
          notes: ''
        });
        save();
        e.target.value = '';
        renderHome();
      }
    }
    if (e.target.id === 'chatInput' && e.key === 'Enter') {
      chat.sendChat();
    }
  });

  // ============ 公开接口 ============
  return {
    state, currentUser, curPage, sbClient,
    defaults, save, loadData,
    initSupabase, enterApp,
    goto, render, renderTop, renderHome, updTop3,
    todayStr, uid, esc, toast
  };
})();

// ============ 启动 ============
window.app = app;
window.auth = auth;
window.tasks = tasks;
window.habits = habits;
window.inbox = inbox;
window.chat = chat;
window.review = review;
window.api = api;
window.esc = app.esc;
window.toast = app.toast;
window.todayStr = app.todayStr;
window.uid = app.uid;

// 初始化并启动
app.initSupabase();

// 延迟初始化收件箱过滤器
setTimeout(() => inbox.initFilters(), 500);