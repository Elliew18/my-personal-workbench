// ============================================================
// API: 数据 CRUD 操作
// 前端直接读写数据库的通用接口
// ============================================================
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');

// 通用 CRUD - 按表名操作
// 支持: tasks, habits, inbox_items, daily_reviews, weekly_reviews

// GET /api/data/:table - 读取数据
router.get('/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { status, date, limit } = req.query;
    const userId = req.userId;

    let data;
    switch (table) {
      case 'tasks':
        data = await supabaseService.getTasks(userId, { status, date });
        break;
      case 'habits':
        data = await supabaseService.getHabits(userId, date);
        break;
      case 'inbox':
        data = await supabaseService.getInboxItems(userId, status);
        break;
      case 'reviews:daily':
        data = await supabaseService.getDailyReview(userId, date || new Date().toISOString().slice(0, 10));
        break;
      case 'reviews:weekly': {
        const now = new Date();
        const dow = (now.getDay() + 6) % 7;
        const mon = new Date(now);
        mon.setDate(now.getDate() - dow);
        data = await supabaseService.getWeeklyReview(userId, mon.toISOString().slice(0, 10));
        break;
      }
      case 'chat':
        data = await supabaseService.getChatHistory(userId, parseInt(limit) || 30);
        break;
      default:
        return res.status(400).json({ error: '无效的表名' });
    }

    res.json({ data });

  } catch (e) {
    console.error('[Data GET] 错误:', e);
    res.status(500).json({ error: '读取数据失败' });
  }
});

// POST /api/data/:table - 创建数据
router.post('/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const userId = req.userId;
    const body = req.body;
    const today = new Date().toISOString().slice(0, 10);

    let result;
    switch (table) {
      case 'tasks':
        result = await supabaseService.createTask(userId, {
          id: body.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: body.name,
          category: body.category || '其他',
          priority: body.priority || '中',
          status: body.status || '待处理',
          due_date: body.due_date || null,
          notes: body.notes || '',
          created_date: body.created_date || today
        });
        break;
      case 'inbox':
        result = await supabaseService.createInboxItem(userId, {
          id: body.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          raw: body.raw,
          summary: body.summary || body.raw?.slice(0, 40) || '',
          type: body.type || '随想',
          tags: body.tags || [],
          has_todo: body.has_todo || false,
          status: body.status || '待整理',
          question: body.question || '',
          todo_content: body.todo_content || '',
          todo_priority: body.todo_priority || '中',
          todo_due_date: body.todo_due_date || null
        });
        break;
      default:
        return res.status(400).json({ error: '不支持的表' });
    }

    res.json({ data: result });

  } catch (e) {
    console.error('[Data POST] 错误:', e);
    res.status(500).json({ error: '创建失败' });
  }
});

// PUT /api/data/:table/:id - 更新数据
router.put('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const userId = req.userId;
    const updates = req.body;

    let result;
    switch (table) {
      case 'tasks':
        result = await supabaseService.updateTask(userId, id, updates);
        break;
      case 'inbox':
        result = await supabaseService.updateInboxItem(userId, id, updates);
        break;
      default:
        return res.status(400).json({ error: '不支持的表' });
    }

    res.json({ data: result });

  } catch (e) {
    console.error('[Data PUT] 错误:', e);
    res.status(500).json({ error: '更新失败' });
  }
});

// DELETE /api/data/:table/:id - 删除数据
router.delete('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const userId = req.userId;

    let ok;
    switch (table) {
      case 'tasks':
        ok = await supabaseService.deleteTask(userId, id);
        break;
      case 'inbox':
        ok = await supabaseService.deleteInboxItem(userId, id);
        break;
      default:
        return res.status(400).json({ error: '不支持的表' });
    }

    res.json({ success: ok });

  } catch (e) {
    console.error('[Data DELETE] 错误:', e);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;