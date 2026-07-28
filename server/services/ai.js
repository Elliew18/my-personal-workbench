// ============================================================
// 智谱 AI 封装层 - 使用 Anthropic Messages API 格式
// 通过 cmkey.cn 代理访问 glm-5.2
// ============================================================

const SYSTEM_PROMPT = `你是「小王」，一个温暖、专业、有洞察力的个人成长助理。

## 你的角色
- 你是一个用户的长期 AI 助理，比普通助手更了解用户的生活和工作
- 你的语气亲切但不啰嗦，专业但不冷漠，有洞察但不装逼
- 你擅长帮用户理清思路、安排日程、总结复盘、提取待办

## 核心能力
1. **日常对话** — 自然交流，理解用户说什么，不只是关键词匹配
2. **智能分类** — 用户说的话，你可以判断类型：商业灵感、学习心得、担忧/问题、想购买、研究主题、任务、想法、随想等
3. **待办提取** — 从对话中识别需要做的事，用 JSON 格式输出待办信息
4. **日程安排** — 根据任务优先级和截止日期，帮用户安排今天最重要的事
5. **复盘总结** — 根据用户当天完成情况，生成有洞察的复盘

## 输出格式
- 默认用中文回复，自然对话
- 当你需要结构化输出时（如分类、提取待办），请在回复末尾用标记：
  ---STRUCTURED---
  { json 格式的结构化数据 }
  ---END---

## 结构化数据格式
- 分类：{ "type": "分类名称", "tags": ["标签1", "标签2"], "summary": "简短摘要" }
- 待办：{ "todo": { "content": "待办内容", "priority": "高/中/低", "dueDate": "YYYY-MM-DD或空" } }
- 同时有分类和待办：{ "type": "...", "tags": [...], "summary": "...", "todo": { "content": "...", "priority": "...", "dueDate": "..." } }

## 注意事项
- 用户信息不足时，主动追问，不要猜
- 能识别任务优先级（高/中/低）
- 能识别截止日期（今天、明天、下周几、X月X日等）
- 保持对话简洁，每条回复不超过 200 字
- 不要输出 markdown 格式的标题（#、##等），用纯文本
- 用户可能说零碎的话、情绪话、不完整的话，你都能理解并回应`;

class AIService {
  constructor() {
    this.apiKey = null;
    this.model = 'glm-5.2';
    this.apiUrl = 'https://cmkey.cn/v1/messages';
  }

  init(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || 'glm-5.2';
    this.apiUrl = options.apiUrl || 'https://cmkey.cn/v1/messages';
    if (apiKey && apiKey !== 'your_anthropic_api_key_here' && apiKey.startsWith('sk-')) {
      console.log(`[AI] 智谱 ${this.model} (通过 ${this.apiUrl}) 初始化成功`);
    } else {
      console.warn('[AI] 未配置有效 API Key，使用规则回退模式');
    }
  }

  isAvailable() {
    return !!(this.apiKey && this.apiKey.startsWith('sk-') && this.apiKey !== 'your_anthropic_api_key_here');
  }

  /**
   * 调用 Anthropic Messages API
   */
  async callAnthropic(messages, systemPrompt = SYSTEM_PROMPT, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('AI 未配置');
    }

    const body = {
      model: this.model,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      system: systemPrompt,
      messages: messages
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API ${response.status}: ${errText || response.statusText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (e) {
      console.error('[AI] API 调用失败:', e.message);
      throw e;
    }
  }

  /**
   * 发送对话消息
   * @param {string} message - 用户消息
   * @param {Array} history - 历史消息 [{role, content}]
   * @param {Object} context - 上下文数据（今日任务、习惯等）
   */
  async chat(message, history = [], context = {}) {
    if (!this.isAvailable()) {
      return this.fallbackChat(message, context);
    }

    const contextMsgs = this.buildContextMessages(context);
    const recentHistory = history.slice(-20);
    const userMsg = { role: 'user', content: message };

    const messages = [
      ...contextMsgs,
      ...recentHistory,
      userMsg
    ];

    try {
      const reply = await this.callAnthropic(messages);
      return this.parseResponse(reply);
    } catch (e) {
      console.error('[AI] chat 失败，回退规则引擎:', e.message);
      return this.fallbackChat(message, context);
    }
  }

  /**
   * 处理文本：分类 + 摘要 + 提取待办
   */
  async processText(text) {
    if (!this.isAvailable()) {
      return this.fallbackProcess(text);
    }

    const systemPrompt = `${SYSTEM_PROMPT}\n\n你现在只做文本处理，不需要对话。分析用户输入的文本，返回结构化数据。`;
    const messages = [
      { role: 'user', content: `分析这段文本：\n"""${text}"""\n\n返回类型、标签、摘要，以及是否包含待办事项。` }
    ];

    try {
      const reply = await this.callAnthropic(messages, systemPrompt, { temperature: 0.3, maxTokens: 500 });
      return this.parseStructuredData(reply) || this.fallbackProcess(text);
    } catch (e) {
      console.error('[AI] processText 失败，回退规则引擎:', e.message);
      return this.fallbackProcess(text);
    }
  }

  /**
   * 生成每日复盘
   */
  async generateDailyReview(tasks, habits, date) {
    if (!this.isAvailable()) {
      return this.fallbackReview(tasks, habits);
    }

    const taskSummary = tasks.map(t =>
      `- ${t.name} (${t.priority}优先级, 状态: ${t.status})`
    ).join('\n');
    const habitSummary = habits.map(h =>
      `- ${h.category}: ${h.done ? '✅ 已完成' : '❌ 未完成'}`
    ).join('\n');

    const systemPrompt = `你是一个有洞察力的复盘助手。根据用户今天的数据，生成温暖、有建设性的复盘总结。用中文，不超过 300 字，用纯文本。不要用 markdown 标题。`;
    const messages = [
      { role: 'user', content: `今天的日期是 ${date}。\n\n任务完成情况：\n${taskSummary}\n\n习惯打卡：\n${habitSummary}\n\n请帮我写一段今日复盘，包括：\n1. 完成情况简要总结\n2. 亮点和可改进的点\n3. 明天的一个小建议` }
    ];

    try {
      return await this.callAnthropic(messages, systemPrompt, { temperature: 0.7, maxTokens: 600 });
    } catch (e) {
      console.error('[AI] review 失败，回退规则引擎:', e.message);
      return this.fallbackReview(tasks, habits);
    }
  }

  /**
   * 智能安排今日日程
   */
  async arrangeToday(tasks, topThree = ['', '', '']) {
    if (!this.isAvailable()) {
      return this.fallbackArrange(tasks);
    }

    const taskList = tasks.map(t =>
      `- ${t.name} (${t.priority}优先级, 截止: ${t.due_date || '无'}, 分类: ${t.category})`
    ).join('\n');

    const systemPrompt = `你是一个效率助手。根据用户的任务列表，安排今天最重要的 3 件事。给出建议和理由。用中文，不超过 200 字。`;
    const messages = [
      { role: 'user', content: `我的任务列表：\n${taskList}\n\n请帮我安排今天最重要的 3 件事，并给出理由。` }
    ];

    try {
      return await this.callAnthropic(messages, systemPrompt, { temperature: 0.7, maxTokens: 500 });
    } catch (e) {
      console.error('[AI] arrange 失败，回退规则引擎:', e.message);
      return this.fallbackArrange(tasks);
    }
  }

  // ============ 构建上下文 ============
  buildContextMessages(context) {
    const msgs = [];
    if (context.todayTasks?.length) {
      const tasks = context.todayTasks.slice(0, 10).map(t =>
        `- ${t.name} (${t.priority})`
      ).join('\n');
      msgs.push({ role: 'user', content: `[系统消息：用户今天的任务：\n${tasks}]` });
      msgs.push({ role: 'assistant', content: '好的，我了解了用户今天的任务。' });
    }
    if (context.habits?.length) {
      const habits = context.habits.map(h =>
        `- ${h.category}: ${h.done ? '已完成' : '未完成'}`
      ).join('\n');
      msgs.push({ role: 'user', content: `[系统消息：用户今日习惯打卡：\n${habits}]` });
      msgs.push({ role: 'assistant', content: '好的，我了解了用户的习惯情况。' });
    }
    if (context.topThree?.length) {
      msgs.push({ role: 'user', content: `[系统消息：用户今日最重要的三件事：${context.topThree.filter(Boolean).join('、') || '尚未设定'}]` });
      msgs.push({ role: 'assistant', content: '好的，我知道了。' });
    }
    return msgs;
  }

  // ============ 解析响应 ============
  parseResponse(reply) {
    const structMatch = reply.match(/---STRUCTURED---\n([\s\S]*?)\n---END---/);
    let structured = null;
    let text = reply;

    if (structMatch) {
      try {
        structured = JSON.parse(structMatch[1]);
      } catch (e) {
        console.error('[AI] 解析结构化数据失败:', e.message);
      }
      text = reply.replace(/---STRUCTURED---[\s\S]*?---END---/, '').trim();
    }

    return { text, structured };
  }

  parseStructuredData(reply) {
    const structMatch = reply.match(/---STRUCTURED---\n([\s\S]*?)\n---END---/);
    if (structMatch) {
      try {
        return JSON.parse(structMatch[1]);
      } catch (e) {}
    }
    try {
      const parsed = JSON.parse(reply);
      if (parsed.type || parsed.todo) return parsed;
    } catch (e) {}
    return null;
  }

  // ============ 回退模式（无 AI 时的规则引擎） ============
  fallbackChat(text, context) {
    const t = text.trim();
    if (/安排.*今天|今天.*安排|排一下今天/.test(t)) return { text: this.fallbackArrange(context.todayTasks || []) };
    if (/复盘|总结今天|今日总结/.test(t)) return { text: this.fallbackReview(context.todayTasks || [], context.habits || []) };
    if (/我刚想到|突然想到|想到一个/.test(t)) return { text: `记下了，我放在收件箱里。你可以回头再看看这个想法。` };
    if (/记一下|记录一下/.test(t)) return { text: `好的，我记下了，已经放进收件箱。` };
    if (/我今天做了|我做了|已经完成|搞定了|做完了/.test(t)) return { text: `收到，我帮你更新状态。继续保持！` };

    const processed = this.fallbackProcess(t);
    if (processed.todo) {
      return { text: `收到，我帮你记下了待办：${processed.todo.content}（${processed.todo.priority}优先级${processed.todo.dueDate ? '，截止'+processed.todo.dueDate : ''}）`, structured: processed };
    }
    return { text: `收到，已收进灵感收件箱。需要我帮你做什么吗？` };
  }

  fallbackProcess(text) {
    const typeRules = [
      { t: '商业灵感', k: ['商业', '创业', '赚钱', '产品', '用户', '市场', '生意', '营收', '变现', '商业模式'] },
      { t: '担忧/问题', k: ['担心', '担忧', '怕', '焦虑', '问题', '风险', '不确定', '麻烦', '卡住'] },
      { t: '学习心得', k: ['学', '课程', '知识点', '懂了', '明白了', '读书笔记', '笔记', '理解'] },
      { t: '想购买', k: ['买', '购', '下单', '淘宝', '京东', '购物车', '囤'] },
      { t: '研究主题', k: ['研究', '查一下', '了解', '深入', '课题', '调研', '看看怎么'] },
      { t: '任务', k: ['要', '需要', '记得', '别忘了', '计划', '打算', '应该', '必须', '安排', '完成', '做'] },
      { t: '想法', k: ['想法', '灵感', '点子', '创意', '主意'] },
    ];
    const tagWords = ['学习', '工作', '生活', '健康', '商业', '投资', '读书', '运动', '家庭', '效率', '副业', '写作'];
    const todoKws = ['要', '需要', '记得', '别忘了', '计划', '打算', '应该', '必须', '安排', '完成', '去做', '预约', '缴费', '购物', '买'];

    let type = '随想';
    for (const r of typeRules) {
      if (r.k.some(k => text.includes(k))) { type = r.t; break; }
    }
    const tags = tagWords.filter(w => text.includes(w));
    const hasTodo = todoKws.some(k => text.includes(k));
    const first = text.split(/[。！？\n]/)[0].trim();
    const summary = first.length <= 40 ? (first || text.slice(0, 40)) : first.slice(0, 40) + '…';

    let todo = null;
    if (hasTodo) {
      const pri = /紧急|马上|立刻|尽快|重要|务必/.test(text) ? '高' : (/有空|以后|改天|可能|随便|也许/.test(text) ? '低' : '中');
      let dueDate = '';
      if (/今天/.test(text)) dueDate = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      if (/明天/.test(text)) dueDate = tomorrow.toISOString().slice(0, 10);
      todo = { content: summary, priority: pri, dueDate };
    }

    return { type, tags, summary, todo, hasTodo };
  }

  fallbackReview(tasks, habits) {
    const done = tasks.filter(t => t.status === '已完成' || t.done);
    const undone = tasks.filter(t => t.status !== '已完成' && !t.done);
    const habitNames = (habits || []).filter(h => h.done).map(h => h.category);
    let s = `【今日复盘】\n\n✅ 完成：${done.length ? done.map(t => t.name || t.task).join('、') : '今天还没有标记完成的任务'}`;
    s += `\n🌱 习惯打卡：${habitNames.length ? habitNames.join('、') : '今天还没打卡'}`;
    s += `\n\n❌ 未完成：${undone.length ? undone.map(t => t.name || t.task).join('、') : '无'}`;
    s += '\n\n💡 建议：明天优先做最重要的一件事，别被琐事占满。';
    return s;
  }

  fallbackArrange(tasks) {
    if (!tasks.length) return '今天没什么任务。要不你告诉我几件想做的？';
    const order = { '高': 0, '中': 1, '低': 2 };
    tasks.sort((a, b) => order[a.priority] - order[b.priority]);
    const top3 = tasks.slice(0, 3);
    let s = '建议今天安排：\n\n';
    top3.forEach((t, i) => {
      s += `${i + 1}. ${t.name}（${t.priority}优先级${t.due_date ? '，' + t.due_date + '截止' : ''}）\n`;
    });
    if (tasks.length > 3) {
      s += '\n其余可以放后面：\n';
      tasks.slice(3).forEach(t => s += `· ${t.name}\n`);
    }
    return s;
  }
}

module.exports = new AIService();