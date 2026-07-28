// ============================================================
// 任务模块
// ============================================================
const tasks = (() => {
  const TASK_STATUS = ['收件箱', '待处理', '今天', '进行中', '等待中', '已完成', '暂时搁置'];

  function taskItem(t) {
    const pri = t.priority === '高' ? '<span class="pill r">高</span>' :
                t.priority === '低' ? '<span class="pill gray">低</span>' :
                '<span class="pill w">中</span>';
    const done = t.status === '已完成';
    return `<div class="item">
      <div class="chk ${done ? 'on' : ''}" onclick="tasks.toggleTask('${t.id}')">${done ? '✓' : ''}</div>
      <div class="body">
        <div class="title" style="${done ? 'text-decoration:line-through;color:var(--text-secondary)' : ''}">${esc(t.name)}</div>
        <div class="meta">${pri}<span class="pill gray">${t.category}</span>${t.due_date ? ' 📅 ' + t.due_date : ''} · ${t.status}</div>
      </div>
      <button class="icon-btn" onclick="tasks.deleteTask('${t.id}')">✕</button>
    </div>`;
  }

  function renderTasks() {
    const el = document.getElementById('taskBoard');
    const total = window.app.state.tasks.length;
    document.getElementById('taskTotal').textContent = total ? total + ' 项' : '';

    if (!total) {
      el.innerHTML = '<div class="empty">还没有任务，去「收件箱」或「小王」里记一件？</div>';
      return;
    }

    const groups = TASK_STATUS.map(s => ({ s, items: window.app.state.tasks.filter(t => t.status === s) }))
      .filter(g => g.items.length);

    el.innerHTML = groups.map(g => {
      const color = g.s === '已完成' ? 'g' : g.s === '今天' ? 'w' : '';
      return `<div style="margin:8px 0 4px"><span class="pill ${color}">${g.s}</span> <span class="text-xs muted">${g.items.length}</span></div>
        ${g.items.map(t => taskItem(t)).join('')}`;
    }).join('');
  }

  function addTask() {
    const name = document.getElementById('taskName').value.trim();
    if (!name) { toast('先写任务名称'); return; }

    const task = {
      id: uid(),
      name,
      category: document.getElementById('taskCat').value,
      priority: document.getElementById('taskPri').value,
      created_date: todayStr(),
      due_date: document.getElementById('taskDue').value || null,
      status: document.getElementById('taskStatus').value,
      notes: document.getElementById('taskNote').value || ''
    };

    window.app.state.tasks.push(task);
    window.app.save();
    document.getElementById('taskName').value = '';
    document.getElementById('taskDue').value = '';
    document.getElementById('taskNote').value = '';
    toast('已添加 ✓');
    renderTasks();
  }

  function toggleTask(id) {
    const t = window.app.state.tasks.find(x => x.id === id);
    if (!t) return;
    t.status = t.status === '已完成' ? '待处理' : '已完成';
    window.app.save();
    window.app.render(window.app.curPage);
  }

  function deleteTask(id) {
    window.app.state.tasks = window.app.state.tasks.filter(x => x.id !== id);
    window.app.save();
    window.app.render(window.app.curPage);
  }

  return { taskItem, renderTasks, addTask, toggleTask, deleteTask };
})();