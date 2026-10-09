import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AgendaEngine from '../../agenda/agenda-engine.js';

const REPO_OWNER = 'foxnove';
const REPO_NAME = 'mesmo-tarde';

async function main() {
  console.log('--- Iniciando sincronização da Agenda da Banda ---');

  const rootDir = process.cwd();
  const membersPath = resolve(rootDir, 'agenda/members.json');
  const dataPath = resolve(rootDir, 'agenda/data.json');

  const membersRaw = await readFile(membersPath, 'utf8');
  const members = JSON.parse(membersRaw);
  console.log(`Carregados ${members.length} membros oficiais de members.json.`);

  const token = process.env.GITHUB_TOKEN;
  let issues = [];

  if (token) {
    console.log('Conectando à GitHub REST API para buscar Issues com label "agenda"...');
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=open&labels=agenda&per_page=100`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'agenda-sync-action'
      }
    });

    if (res.ok) {
      issues = await res.json();
      console.log(`Encontradas ${issues.length} issues abertas com label "agenda".`);
    } else {
      console.warn(`Aviso: Falha ao buscar issues (HTTP ${res.status}). Mantendo dados locais existentes.`);
      return;
    }
  } else {
    console.log('Aviso: GITHUB_TOKEN não configurado. Modo offline / simulação.');
  }

  // Active member map
  const activeMembersMap = new Map();
  members.forEach(m => {
    if (m.active !== false) {
      activeMembersMap.set(m.github.toLowerCase(), m);
    }
  });

  const availabilityList = [];
  const confirmedList = [];

  // Group latest issue per user for availability
  const userLatestIssueMap = new Map();

  for (const issue of issues) {
    const author = (issue.user && issue.user.login) ? issue.user.login.toLowerCase() : '';
    const labels = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name).toLowerCase());

    // 1. Confirmed Rehearsal Check: ONLY foxnove can create official confirmed rehearsals
    if (labels.includes('ensaio-confirmado')) {
      if (author === 'foxnove') {
        const rehearsal = AgendaEngine.parseConfirmedRehearsalBody(
          issue.body || '',
          issue.user.login,
          issue.number,
          issue.html_url
        );
        if (rehearsal) {
          confirmedList.push(rehearsal);
          console.log(`Ensaio confirmado identificado: Issue #${issue.number} por @${issue.user.login} (${rehearsal.date})`);
        }
      } else {
        console.warn(`Ignorando ensaio confirmado da Issue #${issue.number}: autor @${issue.user.login} não é o administrador "foxnove".`);
      }
      continue;
    }

    // 2. Musician Availability Check
    if (labels.includes('disponibilidade')) {
      if (!activeMembersMap.has(author)) {
        console.warn(`Ignorando disponibilidade da Issue #${issue.number}: autor @${issue.user.login} não consta em members.json.`);
        continue;
      }

      // If user opened multiple issues, keep the most recent updated one
      if (!userLatestIssueMap.has(author) || new Date(issue.updated_at) > new Date(userLatestIssueMap.get(author).updated_at)) {
        userLatestIssueMap.set(author, issue);
      }
    }
  }

  // Process selected availability issues
  for (const [author, issue] of userLatestIssueMap.entries()) {
    const member = activeMembersMap.get(author);
    const slots = AgendaEngine.parseAvailabilityIssueBody(issue.body || '');

    if (slots.length > 0) {
      availabilityList.push({
        github: member.github,
        name: member.name,
        instrument: member.instrument,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        updatedAt: issue.updated_at,
        slots
      });
      console.log(`Disponibilidade consolidada: @${member.github} com ${slots.length} intervalos.`);
    }
  }

  // If running in CI with real issues or updating existing
  let finalData;
  if (issues.length > 0) {
    finalData = {
      generatedAt: new Date().toISOString(),
      members,
      availability: availabilityList,
      confirmedRehearsals: confirmedList
    };
    await writeFile(dataPath, JSON.stringify(finalData, null, 2), 'utf8');
    console.log(`agenda/data.json atualizado com sucesso (${availabilityList.length} músicos disponíveis, ${confirmedList.length} ensaios confirmados).`);
  } else {
    console.log('Nenhuma issue nova encontrada na API. Preservando data.json existente.');
  }

  console.log('--- Sincronização concluída com sucesso ---');
}

main().catch(err => {
  console.error('Erro fatal na sincronização da agenda:', err);
  process.exit(1);
});
