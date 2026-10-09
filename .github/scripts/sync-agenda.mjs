import { readFile, writeFile } from 'node:fs/promises';
import AgendaEngine from '../../agenda/agenda-engine.js';

// Fetch all pages, including legacy answers that did not receive labels.
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'agenda-sync' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const members = JSON.parse(await readFile('agenda/members.json', 'utf8'));
const config = JSON.parse(await readFile('agenda/config.json', 'utf8'));
const issues = [];
for (let page = 1; ; page++) {
  const response = await fetch(`https://api.github.com/repos/foxnove/mesmo-tarde/issues?state=open&per_page=100&page=${page}`, { headers });
  if (!response.ok) throw new Error(`Sincronização interrompida (HTTP ${response.status}); nenhum dado foi alterado.`);
  const batch = await response.json();
  if (!Array.isArray(batch)) throw new Error('Resposta inesperada do GitHub; nenhum dado foi alterado.');
  issues.push(...batch);
  if (batch.length < 100) break;
}
const data = AgendaEngine.buildAgendaData(members, issues, config.expectedMembers);
await writeFile('agenda/data.json', JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Agenda sincronizada: ${data.availability.length}/${config.expectedMembers} integrantes responderam; ${data.confirmedRehearsals.length} ensaios confirmados.`);
