// ============================================================
// Supabase 数据操作封装
// ============================================================
const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    this.client = null;
  }

  init(url, anonKey) {
    if (!url || !anonKey) {
      console.error('[DB] Supabase 配置缺失');
      return;
    }
    this.client = createClient(url, anonKey);
    console.log('[DB] Supabase 客户端初始化成功');
  }

  isReady() {
    return !!this.client;
  }

  // ============ 任务 ============
  async getTasks(userId, filters = {}) {
    if (!this.isReady()) return [];
    let query = this.client.from('tasks').select('*').eq('user_id', userId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.date) query = query.eq('created_date', filters.date);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) { console.error('[DB] getTasks error:', error); return []; }
    return data || [];
  }

  async createTask(userId, task) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('tasks').insert({
      user_id: userId,
      ...task,
      updated_at: new Date().toISOString()
    }).select().single();
    if (error) { console.error('[DB] createTask error:', error); return null; }
    return data;
  }

  async updateTask(userId, taskId, updates) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId).eq('user_id', userId)
      .select().single();
    if (error) { console.error('[DB] updateTask error:', error); return null; }
    return data;
  }

  async deleteTask(userId, taskId) {
    if (!this.isReady()) return false;
    const { error } = await this.client.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
    if (error) { console.error('[DB] deleteTask error:', error); return false; }
    return true;
  }

  // ============ 习惯 ============
  async getHabits(userId, date) {
    if (!this.isReady()) return [];
    let query = this.client.from('habits').select('*').eq('user_id', userId);
    if (date) query = query.eq('date', date);
    const { data, error } = await query;
    if (error) { console.error('[DB] getHabits error:', error); return []; }
    return data || [];
  }

  async upsertHabit(userId, date, category, data) {
    if (!this.isReady()) return null;
    const { data: result, error } = await this.client.from('habits').upsert({
      user_id: userId, date, category,
      ...data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date,category' }).select().single();
    if (error) { console.error('[DB] upsertHabit error:', error); return null; }
    return result;
  }

  // ============ 收件箱 ============
  async getInboxItems(userId, status) {
    if (!this.isReady()) return [];
    let query = this.client.from('inbox_items').select('*').eq('user_id', userId);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) { console.error('[DB] getInbox error:', error); return []; }
    return data || [];
  }

  async createInboxItem(userId, item) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('inbox_items').insert({
      user_id: userId,
      ...item
    }).select().single();
    if (error) { console.error('[DB] createInbox error:', error); return null; }
    return data;
  }

  async updateInboxItem(userId, itemId, updates) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('inbox_items')
      .update(updates).eq('id', itemId).eq('user_id', userId)
      .select().single();
    if (error) { console.error('[DB] updateInbox error:', error); return null; }
    return data;
  }

  async deleteInboxItem(userId, itemId) {
    if (!this.isReady()) return false;
    const { error } = await this.client.from('inbox_items').delete().eq('id', itemId).eq('user_id', userId);
    if (error) { console.error('[DB] deleteInbox error:', error); return false; }
    return true;
  }

  // ============ 对话历史 ============
  async getChatHistory(userId, limit = 20) {
    if (!this.isReady()) return [];
    const { data, error } = await this.client.from('chat_messages')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(limit);
    if (error) { console.error('[DB] getChat error:', error); return []; }
    return (data || []).reverse();
  }

  async saveChatMessage(userId, role, content) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('chat_messages').insert({
      user_id: userId, role, content
    }).select().single();
    if (error) { console.error('[DB] saveChat error:', error); return null; }
    return data;
  }

  // ============ 复盘 ============
  async getDailyReview(userId, date) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('daily_reviews')
      .select('*').eq('user_id', userId).eq('date', date).maybeSingle();
    if (error) { console.error('[DB] getDailyReview error:', error); return null; }
    return data;
  }

  async upsertDailyReview(userId, date, review) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('daily_reviews').upsert({
      user_id: userId, date, ...review,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' }).select().single();
    if (error) { console.error('[DB] upsertDailyReview error:', error); return null; }
    return data;
  }

  async getWeeklyReview(userId, weekStart) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('weekly_reviews')
      .select('*').eq('user_id', userId).eq('week_start', weekStart).maybeSingle();
    if (error) { console.error('[DB] getWeeklyReview error:', error); return null; }
    return data;
  }

  async upsertWeeklyReview(userId, weekStart, review) {
    if (!this.isReady()) return null;
    const { data, error } = await this.client.from('weekly_reviews').upsert({
      user_id: userId, week_start: weekStart, ...review,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,week_start' }).select().single();
    if (error) { console.error('[DB] upsertWeeklyReview error:', error); return null; }
    return data;
  }

  // ============ 用户认证辅助 ============
  async getUserFromToken(token) {
    if (!this.isReady() || !token) return null;
    try {
      const { data: { user }, error } = await this.client.auth.getUser(token);
      if (error) return null;
      return user;
    } catch (e) {
      return null;
    }
  }
}

module.exports = new SupabaseService();