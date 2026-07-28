// ============================================================
// API: 智能日程安排
// ============================================================
const express = require('express');
const router = express.Router();
const aiService = require('../services/ai');
const supabaseService = require('../services/supabase');

// POST /api/arrange - 智能安排今日日程
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().slice(0, 10);

    // 获取今天和待处理的任务
    const [todayTasks, pendingTasks] = await Promise.all([
      supabaseService.getTasks(userId, { date: today }),
      supabaseService.getTasks(userId, { status: '待处理' })
    ]);

    const allTasks = [...todayTasks, ...pendingTasks];
    // 去重
    const seen = new Set();
    const uniqueTasks = allTasks.filter(t => {
      const key = t.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 获取当前的 topThree
    // 从 daily_reviews 或状态判断
    const currentTopThree = todayTasks
      .filter(t => t.status === '今天')
      .slice(0, 3)
      .map(t => t.name);

    const suggestion = await aiService.arrangeToday(uniqueTasks, currentTopThree);

    res.json({
      suggestion,
      tasks: uniqueTasks,
      aiAvailable: aiService.isAvailable()
    });

  } catch (e) {
    console.error('[Arrange] 错误:', e);
    res.status(500).json({ error: '安排失败', detail: e.message });
  }
});

module.exports = router;