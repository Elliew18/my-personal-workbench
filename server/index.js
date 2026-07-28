// ============================================================
// 我的个人工作台 v2 - Express 服务器入口
// 兼容 Vercel Serverless 部署
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const aiService = require('./services/ai');
const supabaseService = require('./services/supabase');

const chatRoutes = require('./routes/chat');
const processRoutes = require('./routes/process');
const arrangeRoutes = require('./routes/arrange');
const reviewRoutes = require('./routes/review');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 静态文件 - 前端
app.use(express.static(path.join(__dirname, '..', 'public')));

// 初始化服务
aiService.init(process.env.AI_API_KEY, {
  model: process.env.AI_MODEL || 'glm-5.2',
  apiUrl: process.env.AI_API_URL || 'https://cmkey.cn/v1/messages'
});
supabaseService.init(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 认证中间件
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }
  const token = authHeader.split(' ')[1];
  const user = await supabaseService.getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
  req.user = user;
  req.userId = user.id;
  next();
}

// API 路由
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/process', authMiddleware, processRoutes);
app.use('/api/arrange', authMiddleware, arrangeRoutes);
app.use('/api/review', authMiddleware, reviewRoutes);
app.use('/api/data', authMiddleware, dataRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ai: aiService.isAvailable() ? 'connected' : 'fallback',
    db: supabaseService.isReady() ? 'connected' : 'disconnected',
    time: new Date().toISOString()
  });
});

// 前端 SPA 路由回退 - 所有非 API 请求返回 index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API 不存在' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Server] 未捕获错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 只在非 Vercel 环境（本地开发）启动监听
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  我的个人工作台 v2 已启动`);
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`  AI 模式: ${aiService.isAvailable() ? '智谱 ' + (process.env.AI_MODEL || 'glm-5.2') : '规则回退'}`);
    console.log(`  数据库: ${supabaseService.isReady() ? '已连接' : '未连接'}`);
    console.log(`========================================\n`);
  });
}

// 导出给 Vercel 使用
module.exports = app;