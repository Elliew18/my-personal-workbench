// ============================================================
// API: 小王对话 - 智谱 AI 驱动
// ============================================================
const express = require('express');
const router = express.Router();
const aiService = require('../services/ai');
const supabaseService = require('../services/supabase');

// POST /api/chat - 发送消息，AI 回复
router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.userId;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    // 保存用户消息
    await supabaseService.saveChatMessage(userId, 'user', message.trim());

    // 获取今日上下文
    const today = new Date().toISOString().slice(0, 10);
    const [tasks, habits] = await Promise.all([
      supabaseService.getTasks(userId, { date: today }),
      supabaseService.getHabits(userId, today)
    ]);

    // 调用 AI
    const result = await aiService.chat(message.trim(), history || [], {
      todayTasks: tasks,
      habits: habits
    });

    // 保存 AI 回复
    await supabaseService.saveChatMessage(userId, 'assistant', result.text);

    // 处理结构化数据
    if (result.structured) {
      const s = result.structured;

      // 创建收件箱条目
      if (s.type || s.summary) {
        await supabaseService.createInboxItem(userId, {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          raw: message.trim(),
          summary: s.summary || message.trim().slice(0, 40),
          type: s.type || '随想',
          tags: s.tags || [],
          has_todo: !!s.todo,
          status: s.todo ? '已转任务' : '已归档',
          todo_content: s.todo?.content || '',
          todo_priority: s.todo?.priority || '中',
          todo_due_date: s.todo?.dueDate || null
        });
      }

      // 创建任务
      if (s.todo) {
        await supabaseService.createTask(userId, {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: s.todo.content,
          category: '其他',
          priority: s.todo.priority || '中',
          status: '待处理',
          due_date: s.todo.dueDate || null,
          notes: message.trim(),
          created_date: today
        });
      }
    }

    res.json({
      reply: result.text,
      structured: result.structured,
      aiAvailable: aiService.isAvailable()
    });

  } catch (e) {
    console.error('[Chat] 错误:', e);
    res.status(500).json({ error: '对话处理失败', detail: e.message });
  }
});

// GET /api/chat/history - 获取最近对话
router.get('/history', async (req, res) => {
  try {
    const history = await supabaseService.getChatHistory(req.userId, 30);
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: '获取历史失败' });
  }
});

module.exports = router;