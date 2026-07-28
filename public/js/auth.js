// ============================================================
// 认证模块 - 登录/注册/登出
// ============================================================
const auth = (() => {
  let sbClient = null;

  function init(supabaseClient) {
    sbClient = supabaseClient;
    window._sbClient = sbClient;
  }

  function setLoginMsg(msg) {
    const el = document.getElementById('loginMsg');
    if (el) el.textContent = msg;
  }

  function showLogin() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
  }

  function showConfigError() {
    document.getElementById('login').style.display = 'flex';
    document.getElementById('loginSub').innerHTML = '<span class="danger">尚未配置 Supabase（缺少 URL / Key）</span>';
  }

  async function doGoogleLogin() {
    if (!sbClient) { setLoginMsg('Supabase 未配置'); return; }
    setLoginMsg('正在跳转 Google 登录...');
    const { error } = await sbClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      setLoginMsg('❌ Google 登录失败：' + (error.message || '未知错误'));
    }
  }

  async function doLogin() {
    const email = document.getElementById('email').value.trim();
    const pwd = document.getElementById('pwd').value;
    if (!email) { setLoginMsg('请填写邮箱'); return; }
    if (!pwd) { setLoginMsg('请填写密码'); return; }
    if (!sbClient) { setLoginMsg('Supabase 未配置'); return; }

    setLoginMsg('正在登录...');
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('Invalid login credentials')) {
        setLoginMsg('❌ 邮箱或密码不正确。\n\n可能的原因：\n① 密码确实错了\n② 该邮箱尚未确认\n\n💡 去 Supabase 后台 → Authentication → Users → 手动确认用户。\n💡 也可以点「忘记密码」重置密码。');
      } else if (msg.includes('Email not confirmed')) {
        setLoginMsg('❌ 邮箱尚未确认。请去邮箱点击确认链接，或在 Supabase 后台手动确认用户。');
      } else if (msg.includes('rate limit')) {
        setLoginMsg('⚠️ 操作太频繁，请等几分钟再试。');
      } else {
        setLoginMsg('❌ 登录失败：' + msg);
      }
    } else {
      if (data?.user) {
        window.app.enterApp(data.user);
      }
    }
  }

  async function doRegister() {
    const email = document.getElementById('email').value.trim();
    const pwd = document.getElementById('pwd').value;
    if (!email) { setLoginMsg('请填写邮箱'); return; }
    if (!pwd) { setLoginMsg('请填写密码'); return; }
    if (pwd.length < 6) { setLoginMsg('❌ 密码至少需要 6 个字符。'); return; }
    if (!sbClient) { setLoginMsg('Supabase 未配置'); return; }

    setLoginMsg('正在注册...');
    const { data, error } = await sbClient.auth.signUp({ email, password: pwd });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('User already registered')) {
        setLoginMsg('❌ 该邮箱已经注册过了。请用密码登录，或点「忘记密码」重置密码。');
      } else if (msg.includes('Password should be at least')) {
        setLoginMsg('❌ 密码太弱：至少 6 个字符。');
      } else {
        setLoginMsg('❌ 注册失败：' + msg);
      }
    } else {
      if (data?.session?.user) {
        window.app.enterApp(data.session.user);
      } else {
        setLoginMsg('✅ 注册成功！请用刚才的邮箱和密码点击「登录」按钮进入工作台。');
      }
    }
  }

  async function doResetPwd() {
    const email = document.getElementById('email').value.trim();
    if (!email) { setLoginMsg('请先填写邮箱，再点「忘记密码」。'); return; }
    if (!sbClient) { setLoginMsg('Supabase 未配置'); return; }
    setLoginMsg('正在发送重置邮件...');
    const { error } = await sbClient.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    if (error) {
      setLoginMsg('❌ 发送失败：' + (error.message || '未知错误'));
    } else {
      setLoginMsg('✅ 重置邮件已发送！请去邮箱（留意垃圾邮件）点击链接重置密码。');
    }
  }

  async function logout() {
    if (sbClient) await sbClient.auth.signOut();
    window.app.currentUser = null;
    showLogin();
  }

  return {
    init, showLogin, showConfigError,
    doLogin, doRegister, doResetPwd, doGoogleLogin, logout,
    setLoginMsg
  };
})();