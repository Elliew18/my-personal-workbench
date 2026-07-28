// ============================================================
// API: 复盘生成
// ============================================================
const express = require('express');
const router = express.Router();
const aiService = require('../services/ai');
const supabaseService = require('../services/supabase');

// POST /api/review/daily - 生成每日复盘
router.post('/daily', async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().slice(0, 10);

    // 获取今天任务
    const tasks = await supabaseService.getTasks(userId, { date: today });
    // 获取今天习惯
    const habits = await supabaseService.getHabits(userId, today);

    // 生成 AI 复盘
    const aiSummary = await aiService.generateDailyReview(tasks, habits, today);

    // 保存到数据库
    await supabaseService.upsertDailyReview(userId, today, {
      done: tasks.filter(t => t.status === '已完成').map(t => t.name),
      undone: tasks.filter(t => t.status !== '已完成').map(t => t.name),
      habits: habits.filter(h => h.done).map(h => h.category),
      ai_summary: aiSummary
    });

    // 获取保存后的完整复盘
    const review = await supabaseService.getDailyReview(userId, today);

    res.json({
      review,
      aiSummary,
      aiAvailable: aiService.isAvailable()
    });

  } catch (e) {
    console.error('[Review Daily] 错误:', e);
    res.status(500).json({ error: '生成复盘失败', detail: e.message });
  }
});

// POST /api/review/weekly - 生成本周复盘
router.post('/weekly', async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - dow);
    const weekStart = mon.toISOString().slice(0, 10);

    // 获取本周任务和习惯
    const tasks = await supabaseService.getTasks(userId);
    const weekTasks = tasks.filter(t => t.created_date >= weekStart);
    const doneTasks = weekTasks.filter(t => t.status === '已完成');

    const habits = await supabaseService.getHabits(userId);
    const weekHabits = habits.filter(h => h.date >= weekStart);

    // 计算统计
    const stats = {
      total: weekTasks.length,
      done: doneTasks.length,
      rate: weekTasks.length ? Math.round(doneTasks.length / weekTasks.length * 100) : 0,
      habitDays: {
        learning: weekHabits.filter(h => h.category === 'learning' && h.done).length,
        reading: weekHabits.filter(h => h.category === 'reading' && h.done).length,
        exercise: weekHabits.filter(h => h.category === 'exercise' && h.done).length
      }
    };

    // 生成 AI 周复盘
    let aiSummary = '';
    if (aiService.isAvailable()) {
      // 简化的 AI 周复盘
      aiSummary = `本周完成 ${stats.done}/${stats.total} 个任务（${stats.rate}%）。`;
      if (stats.habitDays.learning) aiSummary += ` 学习 ${stats.habitDays.learning} 天，`;
      if (stats.habitDays.reading) aiSummary += ` 阅读 ${stats.habitDays.reading} 天，`;
      if (stats.habitDays.exercise) aiSummary += ` 运动 ${stats.habitDays.exercise} 天。`;
      aiSummary += ' 继续加油！';
    }

    // 保存
    await supabaseService.upsertWeeklyReview(userId, weekStart, {
      ai_summary: aiSummary
    });

    const review = await supabaseService.getWeeklyReview(userId, weekStart);

    res.json({
      review,
      stats,
      aiSummary,
      aiAvailable: aiService.isAvailable()
    });

  } catch (e) {
    console.error('[Review Weekly] 错误:', e);
    res.status(500).json({ error: '生成周复盘失败', detail: e.message });
  }
});

// GET /api/review/daily/:date - 获取指定日期的复盘
router.get('/daily/:date', async (req, res) => {
  try {
    const review = await supabaseService.getDailyReview(req.userId, req.params.date);
    res.json({ review });
  } catch (e) {
    res.status(500).json({ error: '获取复盘失败' });
  }
});

module.exports = router;