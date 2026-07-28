// ============================================================
// API: 智能文本处理 - 分类/摘要/提取待办
// ============================================================
const express = require('express');
const router = express.Router();
const aiService = require('../services/ai');
const supabaseService = require('../services/supabase');

// POST /api/process - 处理一段文本
router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: '文本不能为空' });
    }

    const result = await aiService.processText(text.trim());

    // 保存到收件箱
    const item = await supabaseService.createInboxItem(userId, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      raw: text.trim(),
      summary: result.summary || text.trim().slice(0, 40),
      type: result.type || '随想',
      tags: result.tags || [],
      has_todo: !!result.todo,
      status: result.todo ? '已转任务' : '待整理',
      todo_content: result.todo?.content || '',
      todo_priority: result.todo?.priority || '中',
      todo_due_date: result.todo?.dueDate || null
    });

    // 如果有待办，也创建任务
    if (result.todo) {
      const today = new Date().toISOString().slice(0, 10);
      await supabaseService.createTask(userId, {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: result.todo.content,
        category: result.type === '商业灵感' ? '商业' :
                  result.type === '学习心得' ? '学习' :
                  result.type === '想购买' ? '生活' : '其他',
        priority: result.todo.priority || '中',
        status: '待处理',
        due_date: result.todo.dueDate || null,
        notes: text.trim(),
        created_date: today
      });
    }

    res.json({
      item,
      processed: result,
      aiAvailable: aiService.isAvailable()
    });

  } catch (e) {
    console.error('[Process] 错误:', e);
    res.status(500).json({ error: '处理失败', detail: e.message });
  }
});

module.exports = router;