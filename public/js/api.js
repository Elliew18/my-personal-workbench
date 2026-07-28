// ============================================================
// API 调用层 - 封装所有后端请求
// ============================================================
const api = (() => {
  const BASE = '/api';

  async function getToken() {
    const session = window._sbClient?.auth?.getSession();
    if (session) {
      const { data } = await session;
      return data?.session?.access_token || '';
    }
    return '';
  }

  async function request(method, path, body = null) {
    const token = await getToken();
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    if (body) options.body = JSON.stringify(body);

    try {
      const res = await fetch(`${BASE}${path}`, options);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      console.error(`[API] ${method} ${path} 失败:`, e);
      throw e;
    }
  }

  return {
    // 对话
    chat: {
      send(message, history = []) {
        return request('POST', '/chat', { message, history });
      },
      getHistory() {
        return request('GET', '/chat/history');
      }
    },

    // 文本处理
    process: {
      process(text) {
        return request('POST', '/process', { text });
      }
    },

    // 日程安排
    arrange: {
      arrange() {
        return request('POST', '/arrange');
      }
    },

    // 复盘
    review: {
      daily() {
        return request('POST', '/review/daily');
      },
      weekly() {
        return request('POST', '/review/weekly');
      },
      getDaily(date) {
        return request('GET', `/review/daily/${date}`);
      }
    },

    // 数据 CRUD
    data: {
      get(table, params = {}) {
        const qs = new URLSearchParams(params).toString();
        return request('GET', `/data/${table}${qs ? '?' + qs : ''}`);
      },
      create(table, body) {
        return request('POST', `/data/${table}`, body);
      },
      update(table, id, body) {
        return request('PUT', `/data/${table}/${id}`, body);
      },
      delete(table, id) {
        return request('DELETE', `/data/${table}/${id}`);
      }
    },

    // 健康检查
    health() {
      return request('GET', '/health');
    }
  };
})();