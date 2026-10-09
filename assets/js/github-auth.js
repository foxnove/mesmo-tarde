// Cifra Fox — Secure In-Memory GitHub Admin Authentication
(function (global) {
  'use strict';

  // CRITICAL SECURITY RULE:
  // The token MUST exist ONLY in this in-memory variable during the current page lifetime.
  // It is NEVER written to localStorage, sessionStorage, cookies, IndexedDB, or logs.
  let sessionGithubToken = null;
  let authenticatedUser = null;

  // Cleanup legacy persisted tokens from previous insecure versions
  function purgeLegacyTokens() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('cifra_fox_github_token');
        localStorage.removeItem('cifra_fox_auth');
        localStorage.removeItem('github_token');
        localStorage.removeItem('gh_token');
        localStorage.removeItem('artist_password');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('cifra_fox_github_token');
        sessionStorage.removeItem('cifra_fox_auth');
      }
    } catch (e) {
      // Ignore private browsing storage errors
    }
  }

  // Execute purge immediately on script load
  purgeLegacyTokens();

  function getSessionToken() {
    return sessionGithubToken;
  }

  function isAuthenticated() {
    return !!sessionGithubToken && authenticatedUser === 'foxnove';
  }

  function getAuthenticatedUser() {
    return authenticatedUser;
  }

  function clearSession() {
    sessionGithubToken = null;
    authenticatedUser = null;
  }

  async function validateAndAuthenticate(tokenInput) {
    if (!tokenInput || typeof tokenInput !== 'string') {
      throw new Error('Token não fornecido.');
    }
    const token = tokenInput.trim();
    if (!token) {
      throw new Error('Token vazio.');
    }

    // Step 1: Validate token and user identity
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!userRes.ok) {
      if (userRes.status === 401) {
        throw new Error('Token inválido ou expirado no GitHub.');
      }
      throw new Error(`Erro na validação do GitHub (HTTP ${userRes.status}).`);
    }

    const userData = await userRes.json();
    const login = (userData.login || '').toLowerCase();

    // Verify authorized user
    if (login !== 'foxnove') {
      throw new Error(`Acesso negado: o token pertence ao usuário "${userData.login}". Apenas o administrador "foxnove" pode acessar o Modo Artista.`);
    }

    // Step 2: Validate write access to foxnove/mesmo-tarde
    const repoRes = await fetch('https://api.github.com/repos/foxnove/mesmo-tarde', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        throw new Error('Repositório "foxnove/mesmo-tarde" não encontrado ou o token não possui acesso a ele.');
      }
      throw new Error(`Erro ao verificar repositório no GitHub (HTTP ${repoRes.status}).`);
    }

    const repoData = await repoRes.json();
    const hasWritePermission = repoData.permissions && (repoData.permissions.push === true || repoData.permissions.admin === true);

    if (!hasWritePermission) {
      throw new Error('O token não possui permissão de escrita ("Contents: Read and write") no repositório foxnove/mesmo-tarde.');
    }

    // Store in-memory ONLY
    sessionGithubToken = token;
    authenticatedUser = 'foxnove';

    return {
      success: true,
      user: userData.login,
      repo: repoData.full_name
    };
  }

  // UI Bridge functions
  function openLoginModal() {
    const modal = document.getElementById('loginModal');
    const errEl = document.getElementById('loginErrorMsg');
    const input = document.getElementById('githubTokenInput');
    if (errEl) errEl.style.display = 'none';
    if (input) input.value = '';
    if (modal) modal.showModal();
  }

  async function handleLoginSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    const input = document.getElementById('githubTokenInput');
    const btn = document.getElementById('btnLoginSubmit');
    const errEl = document.getElementById('loginErrorMsg');

    if (!input) return;
    const rawToken = input.value;

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Validando no GitHub...';
    }
    if (errEl) errEl.style.display = 'none';

    try {
      await validateAndAuthenticate(rawToken);

      // Instantly wipe raw value from DOM input
      input.value = '';

      if (typeof isEditModeActive !== 'undefined') {
        global.isEditModeActive = true;
      }

      const modal = document.getElementById('loginModal');
      if (modal) modal.close();

      if (typeof updateAuthUI === 'function') updateAuthUI();
      if (typeof updateSongView === 'function') updateSongView();
      if (typeof showToast === 'function') {
        showToast('Modo Artista liberado com sucesso!', 'success');
      }
    } catch (err) {
      // Do NOT log token or headers
      if (errEl) {
        errEl.innerText = '❌ ' + (err.message || 'Erro na autenticação.');
        errEl.style.display = 'block';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Validar e Entrar';
      }
      // Guarantee input is wiped
      input.value = '';
    }
  }

  function handleLogout() {
    clearSession();
    if (typeof isEditModeActive !== 'undefined') {
      global.isEditModeActive = false;
    }
    if (typeof updateAuthUI === 'function') updateAuthUI();
    if (typeof updateSongView === 'function') updateSongView();
    if (typeof showToast === 'function') {
      showToast('Sessão encerrada. Token removido da memória.', 'info');
    }
  }

  // Global exposure
  global.GithubAuth = {
    getSessionToken,
    isAuthenticated,
    getAuthenticatedUser,
    validateAndAuthenticate,
    clearSession,
    purgeLegacyTokens,
    openLoginModal,
    handleLoginSubmit,
    handleLogout
  };

  // Aliases for HTML event handlers
  global.openLoginModal = openLoginModal;
  global.handleLoginSubmit = handleLoginSubmit;
  global.handleLogout = handleLogout;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      validateAndAuthenticate,
      getSessionToken,
      isAuthenticated,
      clearSession,
      purgeLegacyTokens
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
