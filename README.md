# Diego Fox — Mesmo Tarde 🎵
### Caderno Oficial de Cifras e Letras Interativo (Cifra Fox) & Agenda da Banda

Aplicação web estática moderna, gratuita e segura, hospedada exclusivamente no ecossistema **GitHub Pages**, contendo o caderno de cifras completo das 13 faixas do álbum **Mesmo Tarde** do artista **Diego Fox**, reprodutor de áudio oficial, **editor interativo de cifras em formato ChordPro**, publicação atômica via **GitHub REST API**, e **agenda compartilhada de ensaios** integrada via **GitHub Issues** e **GitHub Actions**.

---

## 🌐 Endereços Oficiais

- **Cifra Fox (Caderno de Cifras):** [https://foxnove.github.io/mesmo-tarde/](https://foxnove.github.io/mesmo-tarde/)
- **Player Oficial do Álbum:** [https://foxnove.github.io/mesmo-tarde/home/](https://foxnove.github.io/mesmo-tarde/home/)
- **Agenda de Ensaios da Banda:** [https://foxnove.github.io/mesmo-tarde/agenda/](https://foxnove.github.io/mesmo-tarde/agenda/)

---

## 📱 Recursos do Cifra Fox (Desktop & Mobile)

- 🎸 **Transposição de Tom em Tempo Real** (♭ -1 / ♯ +1) preservando acordes complexos (`G7M`, `Bb7M`, `C#m7`, `D/F#`, `sus4`, `dim`, etc.).
- 📜 **Auto-Rolagem Automática Fluida** via `requestAnimationFrame` (1x, 2x, 3x) com pausa automática ao fim da página e suporte a toque em smartphones (iOS e Android).
- 📑 **Alternância de Layout**: 1 Coluna corrida ou 2 Colunas de palco.
- 🔠 **Ajuste de Tamanho da Fonte** (A- / A+).
- 🌙 **Modo Escuro / Claro** (Dark Mode).
- 🎧 **Player de Áudio Oficial**: controle de faixas, scrubber de reprodução, volume e mudo.
- 🔗 **Deep-linking e Compartilhamento**: links diretos por hashtag (ex: `#08_mesmo_tarde`).
- 📋 **Copiar Cifra Formatada** e **Impressão Otimizada** (A4).

---

## 🛡️ Segurança & Novo Modo Artista (Somente GitHub)

O sistema **não utiliza bancos de dados externos nem serviços terceiros** (sem Firebase, Supabase, Cloudflare ou senhas fixas em código). O acesso administrativo de edição é protegido diretamente pelo ecossistema GitHub.

### Princípio do Token Zero-Persistence
O Fine-grained Personal Access Token (PAT) do administrador:
- **NUNCA** é gravado no disco, `localStorage`, `sessionStorage`, `cookies` ou `IndexedDB`.
- Permanece **estritamente em memória volátil (variável JavaScript)** durante a sessão.
- É destruído automaticamente ao fechar a aba ou recarregar a página.
- É enviado exclusivamente no header `Authorization: Bearer <token>` para o domínio oficial `https://api.github.com`.
- Nenhuma rotina de log (`console.log`, `console.error`) ou mensagem de erro expõe o token.

### Como Gerar o Fine-grained PAT no GitHub (Passo a Passo)

1. No GitHub, clique na sua foto de perfil no topo direito e acesse **Settings**.
2. No menu esquerdo, role até o final e clique em **Developer Settings**.
3. Clique em **Personal access tokens** > **Fine-grained tokens**.
4. Clique em **Generate new token**.
5. Preencha os campos com as **permissões mínimas estritas**:
   - **Token name:** `Cifra Fox Mesmo Tarde`
   - **Expiration:** Escolha o prazo desejado (ex: 30 ou 90 dias).
   - **Repository access:** Selecione **"Only select repositories"** e escolha exclusivamente:
     - `foxnove/mesmo-tarde`
   - **Permissions:**
     - **Repository permissions** > **Contents**: selecione **Read and write** (permite atualizar `songs_data.json` e `songs_data.js`).
     - **Repository permissions** > **Metadata**: **Read-only** (obrigatório pelo GitHub para leitura de metadados).
     - *Nenhuma outra permissão é necessária.*
6. Clique em **Generate token** e copie o token gerado (`github_pat_...`).

> [!CAUTION]
> **Credenciais Antigas Comprometidas:** Qualquer senha fixa ou token antigo utilizado em versões anteriores deve ser considerado comprometido. Revogue imediatamente tokens antigos no painel do GitHub (**Developer Settings > Personal access tokens**) e nunca reutilize senhas.

---

## 🚀 Como Publicar Alterações para Todos os Visitantes

1. No Cifra Fox, clique em **"🔑 Entrar no Modo Artista"**.
2. Cole o seu Fine-grained PAT. O sistema valida se o usuário autenticado é `foxnove` e se possui permissão de escrita no repositório.
3. Edite as cifras, posições e seções (arraste cifras, clique nas palavras ou edite blocos ChordPro).
4. Clique em **"💾 Salvar Local"** (para salvar rascunho no navegador) e, quando estiver pronto, clique em **"🚀 Publicar para Todos"**.
5. O sistema executa um **commit atômico** via **Git Data API** atualizando simultaneamente:
   - `songs_data.json`
   - `songs_data.js`
6. Em cerca de 30 a 60 segundos, o GitHub Pages atualiza o site para todo o público com as novas cifras!

---

## 📅 Agenda Compartilhada da Banda (`/agenda/`)

A agenda de ensaios permite que os músicos registrem seus dias e horários de disponibilidade de forma 100% gratuita, sem necessidade de contas Google ou bancos de dados externos.

### Como Funciona:
1. **Pública para Leitura:** Qualquer integrante ou visitante pode visualizar a agenda completa, sem login.
2. **Cadastro dos Membros:** A lista de integrantes oficiais fica no arquivo `agenda/members.json`.
3. **Registro de Disponibilidade:**
   - O músico entra em `/agenda/`.
   - Escolhe as datas, intervalos de horários e status (🟢 Disponível, 🟡 Talvez, 🔴 Indisponível).
   - Clica em **"Registrar Disponibilidade no GitHub"**.
   - Uma Issue é aberta no repositório oficial através do template `.github/ISSUE_TEMPLATE/disponibilidade.yml`.
   - O músico apenas clica em "Submit new issue" logado em sua conta GitHub.
4. **Atualização Automática via GitHub Actions:**
   - O workflow `.github/workflows/agenda.yml` é disparado automaticamente.
   - O Action verifica se o autor da Issue (`issue.user.login`) está cadastrado em `agenda/members.json`.
   - Issues de usuários não cadastrados são ignoradas.
   - Os dados são consolidados e salvos em `agenda/data.json`, atualizando o GitHub Pages imediatamente.
5. **Algoritmo de Interseção de Horários:**
   - A página calcula os períodos comuns de sobreposição entre os músicos.
   - Destaca o **"⭐ Melhor Horário"** e **"✅ HORÁRIO IDEAL PARA ENSAIO"** quando todos os membros ativos estiverem disponíveis.
6. **Ensaios Confirmados:**
   - Apenas o administrador `foxnove` pode registrar ensaios confirmados (via Issue com template `ensaio_confirmado.yml`).
   - Ensaios oficiais aparecem destacados no topo da agenda com data, horário e local.

---

## 🎶 Faixas do Álbum Mesmo Tarde

| # | Faixa | Tom Original | BPM | Arquivo MP3 |
|---|---|---|---|---|
| **01** | **Do Azul** | **G** | 86 | `01 Do Azul.mp3` |
| **02** | **Tão Fácil Assim** | **Em** | 79 | `02 Tão Fácil Assim.mp3` |
| **03** | **Aí de Mim** | **D** | 108 | `03 Aí de mim.mp3` |
| **04** | **Um Lugar Só** | **D** | 130 | `04 Um Lugar Só.mp3` |
| **05** | **Estou Aqui** | **A** | 72 | `05 Estou Aqui.mp3` |
| **06** | **Vamos** | **D** | 92 | `06 Vamos.mp3` |
| **07** | **Entre** | **G** | 124 | `07 Entre.mp3` |
| **08** | **Mesmo Tarde** *(Melodia Para Você)* | **Dm** | 149 | `08 Melodia para Você.mp3` |
| **09** | **Beijo na Boca** | **G** | 108 | `09 Beijo na Boca.mp3` |
| **10** | **Todo Domingo** | **B** | 127 | `10 Todo Domingo.mp3` |
| **11** | **Para Dançar com Deus** | **Am** | 100 | `11 Para Dançar com Deus.mp3` |
| **12** | **Feito Cheiro de Café** | **Am** | 85 | `12 Feito Cheiro de Café.mp3` |
| **13** | **Sweet Mystery** | **C** | 98 | `13 Sweet Mystery.mp3` |
