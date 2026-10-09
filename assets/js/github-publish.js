// Cifra Fox — Git Data API Atomic Publisher
(function (global) {
  'use strict';

  const REPO_OWNER = 'foxnove';
  const REPO_NAME = 'mesmo-tarde';
  const GITHUB_API_URL = 'https://api.github.com';

  const REQUIRED_FIELDS = [
    'id', 'title', 'artist', 'album', 'tom', 'tom_ext', 'bpm', 'mp3', 'chordpro'
  ];

  const DANGEROUS_PATTERNS = [
    /<script/i,
    /<\/script>/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /onclick\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  function validateSongData(songList) {
    if (!Array.isArray(songList)) {
      throw new Error('Formato inválido: os dados das músicas devem ser uma lista.');
    }

    if (songList.length !== 13) {
      throw new Error(`O álbum deve conter exatamente 13 músicas. Atualmente há ${songList.length}.`);
    }

    for (let i = 0; i < songList.length; i++) {
      const song = songList[i];
      if (!song || typeof song !== 'object') {
        throw new Error(`Faixa ${i + 1} possui formato inválido.`);
      }

      for (const field of REQUIRED_FIELDS) {
        if (typeof song[field] !== 'string' || song[field].trim() === '') {
          throw new Error(`Faixa ${i + 1} ("${song.title || 'Sem título'}") está com o campo "${field}" vazio ou ausente.`);
        }
      }

      // Check for dangerous injection patterns across all fields
      for (const field of REQUIRED_FIELDS) {
        const val = song[field];
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(val)) {
            throw new Error(`Conteúdo não permitido detectado na faixa ${i + 1} ("${song.title}"), campo "${field}".`);
          }
        }
      }
    }

    return true;
  }

  async function githubRequest(endpoint, options = {}, token) {
    const url = `${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}${endpoint}`;
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const msg = errorBody.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function publishAtomic(songsArray, progressCallback) {
    const token = global.GithubAuth ? global.GithubAuth.getSessionToken() : null;
    if (!token) {
      throw new Error('Você precisa estar autenticado no Modo Artista com seu Token GitHub.');
    }

    // 1. Validate data
    if (progressCallback) progressCallback('Validando dados das 13 músicas...');
    validateSongData(songsArray);

    const jsonContent = JSON.stringify(songsArray, null, 2);
    const jsContent = '// Caderno de Cifras Diego Fox — Base Oficial de Dados\nwindow.SONGS_DATABASE = ' + jsonContent + ';\n';

    // 2. Get HEAD ref of main
    if (progressCallback) progressCallback('Consultando estado atual da branch main...');
    let headRef;
    try {
      headRef = await githubRequest('/git/ref/heads/main', { method: 'GET' }, token);
    } catch (e) {
      throw new Error('Falha ao obter branch main: ' + e.message);
    }

    const currentCommitSha = headRef.object.sha;

    // 3. Get current tree SHA
    if (progressCallback) progressCallback('Obtendo árvore de arquivos...');
    const currentCommit = await githubRequest(`/git/commits/${currentCommitSha}`, { method: 'GET' }, token);
    const baseTreeSha = currentCommit.tree.sha;

    // 4. Create blobs
    if (progressCallback) progressCallback('Criando blob de songs_data.json...');
    const blobJson = await githubRequest('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: jsonContent, encoding: 'utf-8' })
    }, token);

    if (progressCallback) progressCallback('Criando blob de songs_data.js...');
    const blobJs = await githubRequest('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: jsContent, encoding: 'utf-8' })
    }, token);

    // 5. Create new tree
    if (progressCallback) progressCallback('Criando árvore atômica com ambos os arquivos...');
    const newTree = await githubRequest('/git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          {
            path: 'songs_data.json',
            mode: '100644',
            type: 'blob',
            sha: blobJson.sha
          },
          {
            path: 'songs_data.js',
            mode: '100644',
            type: 'blob',
            sha: blobJs.sha
          }
        ]
      })
    }, token);

    // 6. Create commit
    if (progressCallback) progressCallback('Criando commit assinado no GitHub...');
    const newCommit = await githubRequest('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Atualiza cifras e posições das músicas (Cifra Fox)',
        tree: newTree.sha,
        parents: [currentCommitSha]
      })
    }, token);

    // 7. Update refs/heads/main
    if (progressCallback) progressCallback('Atualizando ponteiro da branch main...');
    try {
      await githubRequest('/git/refs/heads/main', {
        method: 'PATCH',
        body: JSON.stringify({
          sha: newCommit.sha,
          force: false
        })
      }, token);
    } catch (err) {
      if (err.status === 422) {
        throw new Error('⚠️ O repositório mudou desde que você carregou os dados. Por favor, recarregue a página ou tente novamente.');
      }
      throw err;
    }

    const shortSha = newCommit.sha.substring(0, 7);
    return {
      success: true,
      commitSha: newCommit.sha,
      shortSha: shortSha
    };
  }

  // Modal UI handler
  function openPublishModal() {
    const modal = document.getElementById('publishModal');
    const status = document.getElementById('publishStatusMsg');
    const btn = document.getElementById('btnDoPublish');
    if (status) {
      status.style.display = 'none';
      status.innerHTML = '';
    }
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Publicar Agora no GitHub Pages';
    }
    if (modal) modal.showModal();
  }

  async function handlePublishClick() {
    const btn = document.getElementById('btnDoPublish');
    const status = document.getElementById('publishStatusMsg');

    if (!global.GithubAuth || !global.GithubAuth.isAuthenticated()) {
      if (status) {
        status.style.display = 'block';
        status.style.background = '#fee2e2';
        status.style.color = '#dc2626';
        status.innerText = '❌ Você precisa entrar no Modo Artista primeiro.';
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = '⏳ Publicando no GitHub...';
    }
    if (status) {
      status.style.display = 'block';
      status.style.background = '#e0f2fe';
      status.style.color = '#0369a1';
    }

    const updateStatus = (msg) => {
      if (status) status.innerText = msg;
    };

    try {
      const result = await publishAtomic(global.songs, updateStatus);
      if (status) {
        status.style.background = '#dcfce7';
        status.style.color = '#15803d';
        status.innerHTML = `🎉 <strong>Publicado com sucesso no GitHub!</strong><br>Commit: <code>${result.shortSha}</code><br>O <code>songs_data.json</code> e <code>songs_data.js</code> foram atualizados atomicamente. Em cerca de 30 a 60 segundos o GitHub Pages atualizará o site para todos!`;
      }
      if (typeof showToast === 'function') {
        showToast(`✅ Publicado! Commit: ${result.shortSha}`, 'success');
      }
    } catch (err) {
      if (status) {
        status.style.background = '#fee2e2';
        status.style.color = '#dc2626';
        status.innerText = '❌ Erro na publicação: ' + (err.message || 'Erro desconhecido');
      }
      if (typeof showToast === 'function') {
        showToast('Falha na publicação: ' + err.message, 'error');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '🚀 Publicar Agora no GitHub Pages';
      }
    }
  }

  function downloadSongsDataJson() {
    if (!global.songs) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(global.songs, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "songs_data.json");
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
  }

  // Global exposure
  global.GithubPublish = {
    validateSongData,
    publishAtomic,
    openPublishModal,
    handlePublishClick,
    downloadSongsDataJson
  };

  global.openPublishModal = openPublishModal;
  global.publishToGithub = handlePublishClick;
  global.downloadSongsDataJson = downloadSongsDataJson;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      validateSongData,
      publishAtomic
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
