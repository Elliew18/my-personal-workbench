// ============================================================
// 习惯模块
// ============================================================
const habits = (() => {
  const HABIT_CATS = [
    { key: 'learning', name: '学习', fields: [
      { k: 'content', label: '今日学习内容' }, { k: 'duration', label: '学习时长' },
      { k: 'courseDone', label: '是否完成课程/视频', type: 'bool' }, { k: 'keyLearning', label: '今日关键收获' }
    ]},
    { key: 'reading', name: '阅读', fields: [
      { k: 'book', label: '书名' }, { k: 'pages', label: '页数/时长' },
      { k: 'progress', label: '阅读进度' }, { k: 'excerpt', label: '摘录/感想' }
    ]},
    { key: 'exercise', name: '运动与健身', fields: [
      { k: 'type', label: '运动类型' }, { k: 'duration', label: '运动时长' },
      { k: 'part', label: '训练部位' }, { k: 'weight', label: '今日体重(选填)' }, { k: 'feeling', label: '身体状态/感受' }
    ]},
    { key: 'work', name: '工作', fields: [
      { k: 'top', label: '今日最重要的工作' }, { k: 'normal', label: '普通工作任务' },
      { k: 'done', label: '已完成事项' }, { k: 'problem', label: '遇到的问题' }, { k: 'next', label: '明日继续的工作' }
    ]},
    { key: 'life', name: '生活', fields: [
      { k: 'temp', label: '临时待办' }, { k: 'appt', label: '预约/购物/缴费/重要日期' }, { k: 'later', label: '可延后处理' }
    ]}
  ];

  function getHabit(date) {
    if (!window.app.state.habits[date]) window.app.state.habits[date] = {};
    return window.app.state.habits[date];
  }

  function habitDone(date) {
    const h = getHabit(date);
    return HABIT_CATS.filter(c => h[c.key] && h[c.key]._done).length;
  }

  function toggleHabit(key) {
    const date = todayStr();
    const h = getHabit(date);
    if (!h[key]) h[key] = {};
    h[key]._done = !h[key]._done;
    window.app.save();
    window.app.renderHome();
  }

  function renderHabit() {
    const date = todayStr();
    const h = getHabit(date);

    let html = `<div class="card">
      <h2>今日习惯 · ${date}</h2>
      <div class="hint" style="margin-bottom:6px">首页只显示是否打卡；这里记录细节。今天完成 <b>${habitDone(date)}/${HABIT_CATS.length}</b> 项。</div>
    </div>`;

    HABIT_CATS.forEach(c => {
      const data = h[c.key] || {};
      const on = data._done;
      const fields = c.fields.map(f => {
        const v = data[f.k] || '';
        if (f.type === 'bool') {
          return `<label class="fld">${f.label}</label><div class="seg" data-bool="${c.key}.${f.k}">
            <button class="${v === '是' ? 'on' : ''}" data-v="是">是</button>
            <button class="${v === '否' ? 'on' : ''}" data-v="否">否</button></div>`;
        }
        return `<label class="fld">${f.label}</label><input data-f="${c.key}.${f.k}" value="${esc(v)}">`;
      }).join('');

      html += `<div class="card">
        <div class="row between" style="margin-bottom:6px">
          <h2 style="margin:0">${c.name}</h2>
          <div class="chk ${on ? 'on' : ''}" onclick="habits.toggleHabit('${c.key}');habits.renderHabit()" style="cursor:pointer">${on ? '✓' : ''}</div>
        </div>
        ${fields}
      </div>`;
    });

    document.getElementById('habitEditor').innerHTML = html;

    // 绑定字段变化
    document.querySelectorAll('#habitEditor [data-f]').forEach(el => {
      el.onchange = () => {
        const [k, f] = el.dataset.f.split('.');
        const date = todayStr();
        const h = getHabit(date);
        if (!h[k]) h[k] = {};
        h[k][f] = el.value;
        if (!h[k]._done) h[k]._done = false;
        window.app.save();
      };
    });

    document.querySelectorAll('#habitEditor [data-bool]').forEach(el => {
      el.querySelectorAll('button').forEach(b => {
        b.onclick = () => {
          const [k, f] = el.dataset.bool.split('.');
          const date = todayStr();
          const h = getHabit(date);
          if (!h[k]) h[k] = {};
          h[k][f] = b.dataset.v;
          el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
          window.app.save();
        };
      });
    });
  }

  return { HABIT_CATS, getHabit, habitDone, toggleHabit, renderHabit };
})();