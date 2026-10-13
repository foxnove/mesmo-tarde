// GitHub identity and writes. Credentials exist only in this page's memory.
(function (global) {
  'use strict';
  const Engine = typeof module !== 'undefined' && module.exports ? require('./agenda-engine.js') : global.AgendaEngine;
  const base = 'https://api.github.com/repos/foxnove/mesmo-tarde/issues';
  class AgendaGithub {
    #token = null;
    #login = null;
    #memberLogins = new Set();
    #fetch;
    constructor(fetcher = global.fetch.bind(global)) { this.#fetch = fetcher; }
    get user() { return this.#login; }
    logout() { this.#token = null; this.#login = null; this.#memberLogins.clear(); }
    async login(token, members) {
      this.logout();
      if (!token.trim()) throw new Error('Informe seu token do GitHub.');
      const response = await this.#fetch('https://api.github.com/user', {
        headers: { Authorization: 'Bearer ' + token.trim(), Accept: 'application/vnd.github+json' }, cache: 'no-store'
      });
      if (!response.ok) throw new Error('Token inválido, expirado ou GitHub indisponível.');
      const user = await response.json();
      const login = (user.login || '').toLowerCase();
      if (!members.some(m => m.active !== false && m.github.toLowerCase() === login))
        throw new Error('Esta conta não está cadastrada como integrante da banda.');
      this.#token = token.trim(); this.#login = login;
      this.#memberLogins = new Set(members.filter(m => m.active !== false).map(m => m.github.toLowerCase()));
      return login;
    }
    async request(url, options = {}) {
      if (!this.#token) throw new Error('Entre com sua conta do GitHub para alterar a agenda.');
      const response = await this.#fetch(url, { ...options, cache: 'no-store', headers: {
        Authorization: 'Bearer ' + this.#token, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', ...(options.body ? { 'Content-Type': 'application/json' } : {})
      } });
      if (!response.ok) {
        if (response.status === 401) this.logout();
        throw new Error(response.status === 403 || response.status === 404 ?
          'Sem permissão para alterar este registro. Confira o acesso do token às Issues.' :
          'Não foi possível salvar no GitHub. Entre novamente ou tente mais tarde.');
      }
      return response.json();
    }
    async freshIssue(issue) {
      if (!Number.isInteger(issue.number) || issue.number < 1) throw new Error('Registro inválido. Atualize a agenda.');
      const fresh = await this.request(base + '/' + issue.number);
      if (fresh.state !== 'open' || fresh.body !== issue.body || fresh.updated_at !== issue.updated_at)
        throw new Error('Este registro foi alterado. Atualize a agenda antes de tentar novamente.');
      return fresh;
    }
    static isAvailability(issue) {
      const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
      return !issue.pull_request && !labels.includes('ensaio-confirmado') &&
        (labels.includes('disponibilidade') || /^(?:\[Disponibilidade\]:|Disponibilidade\s*-)/i.test(issue.title || ''));
    }
    static body(slots) {
      const lines = slots.map(s => `- Data: ${s.date} | Horário: ${s.startTime} - ${s.endTime} | Status: ${
        s.status === 'unavailable' ? 'INDISPONÍVEL' : s.status === 'maybe' ? 'TALVEZ' : 'DISPONÍVEL'}${s.note ? ' | Obs: ' + s.note : ''}`);
      return '### Minha Disponibilidade de Ensaios\n\n' + lines.join('\n') + '\n\n```json\n' + JSON.stringify(slots, null, 2) + '\n```\n';
    }
    async updateSlot(issue, index, replacement) {
      if (replacement && !Engine.validateSlot(replacement)) throw new Error('Confira a data e os horários. 00:00 indica meia-noite no fim do dia.');
      if (replacement && !Engine.isRehearsalSlot(replacement)) throw new Error('O mínimo é 2 horas de ensaio. Confira a data e os horários.');
      const fresh = await this.freshIssue(issue);
      const author = (fresh.user?.login || '').toLowerCase();
      const adminEdit = this.user === 'foxnove' && replacement && this.#memberLogins.has(author);
      if (!AgendaGithub.isAvailability(fresh) || (author !== this.user && !adminEdit))
        throw new Error('Você só pode editar ou apagar seus próprios horários.');
      const slots = Engine.parseAvailabilityIssueBody(fresh.body);
      if (!Number.isInteger(index) || index < 0 || index >= slots.length) throw new Error('Horário não encontrado. Atualize a agenda.');
      if (replacement) slots[index] = replacement; else slots.splice(index, 1);
      return this.request(base + '/' + fresh.number, { method: 'PATCH', body: JSON.stringify(
        slots.length ? { body: AgendaGithub.body(slots) } : { state: 'closed' }) });
    }
    async deleteRehearsal(issue) {
      if (this.user !== 'foxnove') throw new Error('Somente o administrador foxnove pode excluir ensaios confirmados.');
      const fresh = await this.freshIssue(issue);
      if (fresh.user?.login.toLowerCase() !== 'foxnove' ||
        !(fresh.labels || []).some(l => (typeof l === 'string' ? l : l.name) === 'ensaio-confirmado'))
        throw new Error('Este registro não é um ensaio confirmado pelo administrador.');
      return this.request(base + '/' + fresh.number, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = AgendaGithub;
  else global.AgendaGithub = AgendaGithub;
})(typeof window !== 'undefined' ? window : globalThis);
