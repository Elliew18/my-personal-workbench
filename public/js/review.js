// ============================================================
// 复盘模块
// ============================================================
const review = (() => {
  async function genAIReview() {
    const btn = document.querySelector('#page-review .btn.mini');
    btn.disabled = true;
    btn.textContent = '🤖 生成中...';

    try {
      const result = await api.review.daily();
      if (result.aiSummary) {
        // 更新 AI 摘要到界面
        const el = document.getElementById('dailyReview');
        const aiSection = el.querySelector('.ai-summary');
        if (aiSection) {
          aiSection.innerHTML = `<div class="card" style="background:var(--accent-soft);margin-bottom:10px">
            <div class="row"><span class="ai-badge">AI</span> <span class="text-sm">小王复盘</span></div>
            <div class="text-sm" style="margin-top:6px;white-space:pre-wrap">${esc(result.aiSummary)}</div>
          </div>`;
        }
        toast('AI 复盘已生成 ✓');
      } else {
        toast('AI 未连接，使用本地数据');
      }
    } catch (e) {
      console.log('[Review] AI 生成失败，使用本地数据:', e.message);
      toast('使用本地数据生成');
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 AI 生成';
    }
  }

  function renderReview() {
    const date = todayStr();
    document.getElementById('reviewDate').textContent = date;

    // 计算本周日期范围
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - dow);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    document.getElementById('weeklyDate').textContent = `${mon.toISOString().slice(0, 10)} ~ ${sun.toISOString().slice(0, 10)}`;

    const dr = window.app.state.reviews.daily[date] || {};

    document.getElementById('dailyReview').innerHTML = `
      <div class="ai-summary">${dr.ai_summary ? `<div class="card" style="background:var(--accent-soft);margin-bottom:10px">
        <div class="row"><span class="ai-badge">AI</span> <span class="text-sm">小王复盘</span></div>
        <div class="text-sm" style="margin-top:6px;white-space:pre-wrap">${esc(dr.ai_summary)}</div>
      </div>` : ''}</div>
      <label class="fld">今日完成事项</label>
      <textarea id="rvDone" placeholder="今天做成了什么">${esc((dr.done || []).join('、'))}</textarea>
      <label class="fld">今日习惯完成情况</label>
      <input id="rvHabit" value="${esc((dr.habits || []).join('、'))}" placeholder="如：学习、运动">
      <label class="fld">今日最有价值的收获</label>
      <textarea id="rvGain" placeholder="一个就够了">${esc(dr.gain || '')}</textarea>
      <label class="fld">今日未完成事项</label>
      <textarea id="rvUndo" placeholder="哪些没做">${esc((dr.undone || []).join('、'))}</textarea>
      <label class="fld">明日最重要的三件事</label>
      <textarea id="rvNext" placeholder="明天先打这三只青蛙">${esc(dr.next || '')}</textarea>`;

    renderWeekly();
  }

  function saveDailyReview() {
    const date = todayStr();
    window.app.state.reviews.daily[date] = {
      done: document.getElementById('rvDone').value.split(/[、,\n]/).map(s => s.trim()).filter(Boolean),
      habits: document.getElementById('rvHabit').value.split(/[、,\n]/).map(s => s.trim()).filter(Boolean),
      gain: document.getElementById('rvGain').value.trim(),
      undone: document.getElementById('rvUndo').value.split(/[、,\n]/).map(s => s.trim()).filter(Boolean),
      next: document.getElementById('rvNext').value.split(/[、,\n]/).map(s => s.trim()).filter(Boolean),
      at: Date.now()
    };
    window.app.save();
    toast('今日复盘已保存 ✓');
  }

  function renderWeekly() {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - dow);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const range = [todayStr(mon), todayStr(sun)];
    const inRange = d => d >= range[0] && d <= range[1];

    const weekTasks = window.app.state.tasks.filter(t => t.created_date >= range[0] && t.status === '已完成');
    const totalWeek = window.app.state.tasks.filter(t => t.created_date >= range[0]);
    const rate = totalWeek.length ? Math.round(weekTasks.length / totalWeek.length * 100) : 0;

    const habits = window.app.state.habits;
    const learnDays = Object.keys(habits).filter(d => inRange(d) && habits[d].learning && habits[d].learning._done).length;
    const readDays = Object.keys(habits).filter(d => inRange(d) && habits[d].reading && habits[d].reading._done).length;
    const exDays = Object.keys(habits).filter(d => inRange(d) && habits[d].exercise && habits[d].exercise._done).length;

    const newIdeas = window.app.state.inbox.filter(i => {
      const d = i.created_at ? i.created_at.slice(0, 10) : '';
      return inRange(d);
    }).length;
    const acted = window.app.state.inbox.filter(i => i.status === '已转任务').length;
    const stuck = window.app.state.tasks.filter(t => t.status === '待处理' || t.status === '暂时搁置').length;

    document.getElementById('weeklyReview').innerHTML = `
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat-card"><div class="num">${rate}%</div><div class="label">任务完成率</div></div>
        <div class="stat-card"><div class="num">${learnDays + readDays + exDays}</div><div class="label">习惯天数</div></div>
        <div class="stat-card"><div class="num">${newIdeas}</div><div class="label">新想法</div></div>
      </div>
      <div class="item" style="border:none"><span class="pill g">完成</span><div class="body">${weekTasks.length}/${totalWeek.length} 个任务</div></div>
      <div class="item" style="border:none"><span class="pill">学习/阅读/运动</span><div class="body">学习 ${learnDays} 天 · 阅读 ${readDays} 天 · 运动 ${exDays} 天</div></div>
      <div class="item" style="border:none"><span class="pill">新想法</span><div class="body">本周记录 ${newIdeas} 条灵感，${acted} 条已转为任务</div></div>
      <div class="item" style="border:none"><span class="pill r">待处理</span><div class="body">${stuck} 项任务仍停留在待处理/搁置</div></div>
      <label class="fld">下周最重要的目标</label>
      <textarea id="wkGoal" placeholder="下周最想拿下的 1-3 件事">${esc((window.app.state.reviews.weekly && window.app.state.reviews.weekly[range[0]] && window.app.state.reviews.weekly[range[0]].goal) || '')}</textarea>
      <button class="btn block" style="margin-top:8px" onclick="review.saveWeekly('${range[0]}')">保存本周目标</button>`;
  }

  function saveWeekly(monday) {
    window.app.state.reviews.weekly = window.app.state.reviews.weekly || {};
    window.app.state.reviews.weekly[monday] = { goal: document.getElementById('wkGoal').value.trim(), at: Date.now() };
    window.app.save();
    toast('本周目标已保存 ✓');
  }

  return { genAIReview, renderReview, saveDailyReview, renderWeekly, saveWeekly };
})();