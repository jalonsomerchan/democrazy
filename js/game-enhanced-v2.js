const api = new window.GameAPI();
const GAME_ID = 12;
const SOCKET_RECONNECT_MS = 1800;
const SOCKET_MAX_RETRIES = 6;
const SESSION_KEY = 'democrazy_active_room';
const POLL_MS = 1500;

const state = {
  user: null,
  room: null,
  isHost: false,
  hostId: null,
  players: [],
  settings: {
    rounds: 5,
    infiniteMode: true,
    points: true,
    privateVote: false,
    adminCountsForVotes: true,
    showAllResults: true,
    redGreenMode: false,
    showVoteCounts: true,
    hideTies: false,
    useQuestions: true,
    questionVisible: true,
    roundTimeLimit: 30,
    questionCategories: [],
  },
  currentRound: 0,
  currentQuestion: null,
  currentInventorId: null,
  votes: {},
  scores: {},
  roundWinnerIds: [],
  hasVoted: false,
  socket: null,
  socketReady: false,
  socketRoomCode: null,
  socketReconnectAttempts: 0,
  socketReconnectTimer: null,
  socketManualClose: false,
  pollingTimer: null,
  pendingMessages: [],
  timerInterval: null,
  timerEndsAt: null,
  timerRemaining: 0,
  timerExpired: false,
  lastEventId: '',
  revealAnimationTimers: [],
};

const sid = () => String(state.user?.id ?? '');
const SCREEN_ROUTES = { login: '#/', lobby: '#/lobby', waiting: '#/sala', game: '#/juego', reveal: '#/resultados', final: '#/final' };
const byId = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function initials(username = '?') {
  return escapeHTML(String(username || '?').trim()[0]?.toUpperCase() || '?');
}

function showScreen(id, replace = false) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  byId(`screen-${id}`)?.classList.add('active');
  const hash = SCREEN_ROUTES[id] ?? '#/';
  if (replace) history.replaceState({ screen: id }, '', hash);
  else history.pushState({ screen: id }, '', hash);
}

window.addEventListener('popstate', e => {
  const screen = e.state?.screen;
  if (!screen || !byId(`screen-${screen}`)) return;
  if (screen === 'lobby' && !state.user) return showScreen('login', true);
  if (['waiting', 'game', 'reveal', 'final'].includes(screen) && !state.room) return showScreen(state.user ? 'lobby' : 'login', true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  byId(`screen-${screen}`)?.classList.add('active');
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') App.closeShareModal?.();
});

function toast(msg, icon = '') {
  const el = byId('toast');
  if (!el) return;
  el.replaceChildren();
  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    el.appendChild(iconEl);
  }
  const textEl = document.createElement('span');
  textEl.textContent = msg;
  el.appendChild(textEl);
  el.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { el.style.opacity = '0'; }, 2800);
}

function renderQR(url) {
  const targets = [byId('qr-container'), byId('share-modal-qr')].filter(Boolean);
  targets.forEach(c => {
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    img.className = 'rounded-2xl w-48 h-48 sm:w-56 sm:h-56';
    img.width = img.height = 220;
    img.alt = 'QR para unirse a la sala';
    c.innerHTML = '';
    c.appendChild(img);
  });
}

function launchConfetti() {
  const colors = ['#7C3AED', '#A78BFA', '#F59E0B', '#34D399', '#F87171', '#60A5FA', '#FB923C'];
  const container = byId('confetti-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    const isCircle = Math.random() > .5;
    p.className = 'confetti-piece';
    p.style.cssText = `left:${Math.random() * 100}vw;width:${5 + Math.random() * 9}px;height:${5 + Math.random() * 9}px;background:${colors[i % colors.length]};border-radius:${isCircle ? '50%' : '2px'};animation-duration:${2.2 + Math.random() * 2.8}s;animation-delay:${Math.random() * 1.2}s;`;
    container.appendChild(p);
  }
  setTimeout(() => { container.innerHTML = ''; }, 6000);
}

function avatarGradient(username) {
  const palettes = ['from-violet-500 to-purple-700', 'from-blue-500 to-indigo-700', 'from-emerald-500 to-teal-700', 'from-rose-500 to-pink-700', 'from-amber-500 to-orange-600', 'from-cyan-500 to-sky-700', 'from-fuchsia-500 to-violet-700'];
  const hash = (username || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function normPlayer(p = {}) {
  const username = String(p.username ?? p.name ?? p.display_name ?? p.user_name ?? '?');
  const id = String(p.id ?? p.user_id ?? p.userId ?? p.uuid ?? username);
  return { id, username };
}

function currentPlayer() {
  return state.user ? { id: sid(), username: state.user.username } : null;
}

function upsertPlayer(player) {
  if (!player) return null;
  const p = normPlayer(player);
  const existing = state.players.findIndex(x => x.id === p.id);
  if (existing >= 0) state.players[existing] = { ...state.players[existing], ...p };
  else state.players.push(p);
  return p;
}

function getQuestionCategories() {
  const categories = Array.isArray(window.questionCategories) ? window.questionCategories : [];
  return categories.filter(category => category?.id && Array.isArray(category.questions));
}

function getAllQuestionCategoryIds() {
  return getQuestionCategories().map(category => String(category.id));
}

function normalizeQuestionCategories(value) {
  const all = getAllQuestionCategoryIds();
  if (!all.length) return [];
  const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  const selected = [...new Set(raw.map(String).filter(id => all.includes(id)))];
  return selected.length ? selected : all;
}

function normalizeSettings(settings = {}) {
  const privateVote = Boolean(settings.privateVote ?? false);
  const showAllResults = Boolean(settings.showAllResults ?? settings.viewAllResults ?? true);
  return {
    rounds: Number(settings.rounds ?? 5),
    infiniteMode: settings.infiniteMode ?? true,
    points: settings.points ?? true,
    privateVote,
    adminCountsForVotes: settings.adminCountsForVotes ?? settings.adminParticipates ?? true,
    showAllResults,
    redGreenMode: !showAllResults && Boolean(settings.redGreenMode ?? settings.redGreen ?? false),
    showVoteCounts: privateVote ? Boolean(settings.showVoteCounts ?? settings.viewVoteCount ?? true) : true,
    hideTies: Boolean(settings.hideTies ?? settings.hideTieBreaks ?? false),
    useQuestions: settings.useQuestions ?? true,
    questionVisible: settings.questionVisible ?? true,
    roundTimeLimit: Number(settings.roundTimeLimit ?? 30),
    questionCategories: normalizeQuestionCategories(settings.questionCategories ?? settings.categories ?? settings.questionCategoryIds),
  };
}

function extractGameState(roomData = {}) {
  const raw = roomData.game_state ?? roomData.gameState ?? roomData.state ?? {};
  return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
}

function roomHostId(roomData = {}, fallback = '') {
  return String(roomData.host_id ?? roomData.hostId ?? roomData.host?.id ?? fallback ?? '');
}

function getGameState(extra = {}) {
  return {
    status: extra.status ?? 'playing',
    hostId: state.hostId,
    players: state.players,
    settings: state.settings,
    currentRound: state.currentRound,
    currentQuestion: state.currentQuestion,
    currentInventorId: state.currentInventorId,
    votes: state.votes,
    scores: state.scores,
    timerExpired: state.timerExpired,
    roundWinnerIds: state.roundWinnerIds,
    screen: currentScreen(),
    latestEvent: extra.latestEvent ?? null,
  };
}

function currentScreen() {
  return document.querySelector('.screen.active')?.id?.replace('screen-', '') ?? 'waiting';
}

function playerLabel(player) {
  return String(player?.id ?? '') === sid() ? 'Tú' : String(player?.username ?? '?');
}

function shouldShowVoteCounts(settings = state.settings) {
  return !settings.privateVote || settings.showVoteCounts !== false;
}

function hideTies(settings = state.settings) {
  return settings.hideTies === true;
}

function adminCountsForVotes(settings = state.settings) {
  return settings.adminCountsForVotes !== false;
}

function votingPlayers(players = state.players, settings = state.settings) {
  const all = (players || []).map(normPlayer);
  if (adminCountsForVotes(settings)) return all;
  const host = String(state.hostId || '');
  return all.filter(player => String(player.id) !== host);
}

function votingPlayerIds(players = state.players, settings = state.settings) {
  return new Set(votingPlayers(players, settings).map(player => String(player.id)));
}

function currentUserCanVote() {
  return votingPlayerIds().has(sid());
}

function validVoteEntries(votes = state.votes, players = state.players, settings = state.settings) {
  const ids = votingPlayerIds(players, settings);
  return Object.entries(votes || {}).filter(([voterId, votedId]) => ids.has(String(voterId)) && ids.has(String(votedId)) && String(voterId) !== String(votedId));
}

function getAdminCountsSettingFromUI() {
  return byId('cfg-admin-counts')?.checked ?? adminCountsForVotes();
}

function getShareUrl() {
  return `${location.origin}${location.pathname}?sala=${encodeURIComponent(state.room?.code ?? '')}`;
}

function roomCodeFromHash(hash = location.hash) {
  const match = String(hash || '').match(/^#\/(?:sala|juego|resultados|final)(?:\/([A-Z0-9_-]+))?/i);
  return match?.[1] ? match[1].toUpperCase() : '';
}

function routeCanRestoreRoom(hash = location.hash) {
  return /^#\/(sala|juego|resultados|final)(\/|$)/.test(String(hash || ''));
}

function applyGameState(gameState = {}) {
  state.hostId = String(gameState.hostId ?? state.hostId ?? '');
  state.isHost = state.hostId ? sid() === state.hostId : state.isHost;
  state.players = (gameState.players ?? state.players).map(normPlayer);
  state.settings = normalizeSettings(gameState.settings ?? state.settings);
  state.currentRound = Number(gameState.currentRound ?? state.currentRound ?? 0);
  state.currentQuestion = gameState.currentQuestion ?? state.currentQuestion;
  state.currentInventorId = gameState.currentInventorId ? String(gameState.currentInventorId) : state.currentInventorId;
  state.votes = gameState.votes ?? state.votes ?? {};
  state.scores = gameState.scores ?? state.scores ?? {};
  state.timerExpired = Boolean(gameState.timerExpired ?? state.timerExpired);
  state.roundWinnerIds = Array.isArray(gameState.roundWinnerIds) ? gameState.roundWinnerIds.map(String) : (gameState.roundWinnerId ? [String(gameState.roundWinnerId)] : (state.roundWinnerIds || []));
}

function persistGameState(extra = {}) {
  if (!state.room?.code) return;
  api.updateRoomState(state.room.code, { gameState: getGameState(extra), status: extra.status, roomSettings: state.settings }).catch(error => {
    console.warn('No se pudo persistir el estado', error);
  });
}

function saveActiveSession() {
  if (!state.user || !state.room) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: state.room.code, roomId: state.room.id, isHost: state.isHost, hostId: state.hostId, userId: sid(), savedAt: Date.now() }));
}
function clearActiveSession() { localStorage.removeItem(SESSION_KEY); }
function getSavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!saved?.roomCode || saved.userId !== sid()) return null;
    return saved;
  } catch { clearActiveSession(); return null; }
}


function renderHomeShell() {
  const login = byId('screen-login');
  if (!login || login.dataset.infiltradoHome === '1') return;
  login.dataset.infiltradoHome = '1';
  login.className = 'screen active flex-col items-center justify-center min-h-screen px-5 py-6 gap-7 relative overflow-hidden';
  login.innerHTML = `
    <div class="orb w-80 h-80 bg-violet-700/40 -top-16 -left-16" style="animation:orbFloat 7s ease-in-out infinite"></div>
    <div class="orb w-96 h-96 bg-purple-900/50 -bottom-20 -right-20" style="animation:orbFloat 9s ease-in-out infinite reverse"></div>
    <div class="orb w-48 h-48 bg-indigo-600/30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style="animation:orbFloat 5s ease-in-out infinite 1.5s"></div>

    <div class="relative z-10 text-center pop">
      <h1 class="text-6xl sm:text-7xl font-black italic tracking-tighter text-gradient drop-shadow-[0_0_18px_rgba(124,58,237,.45)]">DEMOCRAZY</h1>
      <p class="text-zinc-500 mt-2 font-medium tracking-wide">El juego donde todos votan</p>
    </div>

    <div id="login-form" class="relative z-10 w-full max-w-sm space-y-4 pop" style="animation-delay:.08s">
      <input id="input-username" type="text" placeholder="Tu nombre..." maxlength="20" autocomplete="off"
        class="w-full bg-zinc-900/90 border-2 border-zinc-800 rounded-2xl p-4 text-center text-xl font-black outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 placeholder-zinc-600 transition"
        onkeydown="if(event.key==='Enter')App.createHomeRoom()" />
      <p id="login-error" class="text-red-400 text-xs text-center hidden"></p>

      <div id="login-actions" class="grid grid-cols-2 gap-4">
        <button id="btn-create-init" data-create-room-button type="button" onclick="App.createHomeRoom()" class="btn-brand rounded-2xl p-4 font-black uppercase tracking-widest shadow-xl shadow-brand/20">
          Crear sala
        </button>
        <button id="btn-join-init" type="button" onclick="App.showJoinForm()" class="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 font-black uppercase tracking-widest transition-all">
          Unirse
        </button>
      </div>

      <div id="join-container" class="hidden space-y-4 pt-4 border-t border-zinc-800">
        <input id="input-room-code" type="text" placeholder="CÓDIGO" maxlength="6" autocomplete="off"
          class="w-full bg-zinc-900/90 border-2 border-zinc-800 rounded-2xl p-4 text-center text-2xl font-black tracking-[0.45em] uppercase outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 placeholder-zinc-700 placeholder:tracking-widest transition"
          oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')App.joinHomeRoom()" />
        <p id="join-error" class="text-red-400 text-xs text-center hidden"></p>
        <button id="btn-join-confirm" type="button" onclick="App.joinHomeRoom()" class="btn-brand w-full rounded-2xl p-4 font-black uppercase tracking-widest shadow-xl shadow-brand/20">
          Entrar a la sala
        </button>
        <button id="btn-back-home" type="button" onclick="App.hideJoinForm()" class="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 rounded-2xl p-3 text-xs font-black uppercase tracking-widest transition-all">
          Volver
        </button>
      </div>

      <div id="existing-user-card" class="hidden"></div>
      <div id="new-user-toggle" class="hidden"></div>
      <div id="new-user-form" class="hidden"></div>

      <button id="home-switch-user" type="button" onclick="App.switchUser()" class="hidden w-full text-xs text-zinc-600 hover:text-zinc-400 transition underline underline-offset-2">
        Cambiar jugador
      </button>
    </div>
  `;
}

function setHomeUsername(username = '') {
  const input = byId('input-username');
  if (input) input.value = username;
  byId('home-switch-user')?.classList.toggle('hidden', !username);
}

function showHomeJoin(roomCode = '') {
  byId('join-container')?.classList.remove('hidden');
  byId('login-actions')?.classList.add('hidden');
  const codeInput = byId('input-room-code');
  if (codeInput && roomCode) codeInput.value = roomCode.toUpperCase();
  setTimeout(() => (codeInput || byId('input-username'))?.focus?.(), 40);
}

function hideHomeJoin() {
  byId('join-container')?.classList.add('hidden');
  byId('login-actions')?.classList.remove('hidden');
  byId('join-error')?.classList.add('hidden');
  byId('input-room-code') && (byId('input-room-code').value = '');
}

function showHome({ join = false, roomCode = '', replace = true } = {}) {
  renderHomeShell();
  if (state.user?.username) setHomeUsername(state.user.username);
  if (join) showHomeJoin(roomCode);
  else hideHomeJoin();
  if (replace) history.replaceState({ screen: 'login' }, '', join && roomCode ? `?sala=${encodeURIComponent(roomCode)}` : '#/');
  showScreen('login', true);
}

function injectDynamicUI() {
  renderHomeShell();
  if (!byId('share-modal')) {
    document.body.insertAdjacentHTML('beforeend', `<div id="share-modal" class="hidden fixed inset-0 z-[80] px-4 py-6 flex items-center justify-center"><button type="button" class="absolute inset-0 bg-black/75 backdrop-blur-sm" onclick="App.closeShareModal()" aria-label="Cerrar compartir"></button><div class="relative w-full max-w-sm glass rounded-[2rem] border border-white/10 shadow-2xl p-5 pop"><div class="flex items-start justify-between gap-3 mb-4"><div><p class="text-xs text-zinc-500 font-bold uppercase tracking-widest">Compartir sala</p><h2 class="text-2xl font-black text-gradient tracking-tight">Código <span id="share-room-code">—</span></h2></div><button type="button" onclick="App.closeShareModal()" class="w-10 h-10 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition flex items-center justify-center text-zinc-300 text-xl" aria-label="Cerrar">×</button></div><div class="bg-white p-3 rounded-[1.5rem] w-fit mx-auto shadow-xl" id="share-modal-qr"></div><p class="text-center text-xs text-zinc-500 mt-3 mb-4">Escanea el QR o comparte el enlace con el móvil.</p><label class="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2" for="share-link-input">Enlace de invitación</label><div class="flex gap-2"><input id="share-link-input" readonly class="min-w-0 flex-1 bg-zinc-900/80 border border-zinc-700/70 rounded-2xl px-3 py-3 text-xs text-zinc-300 outline-none" value="" /><button type="button" onclick="App.copyShareLink()" class="bg-zinc-800 hover:bg-zinc-700 px-4 rounded-2xl font-bold text-sm transition">Copiar</button></div><button type="button" id="native-share-button" onclick="App.shareViaWebShare()" class="btn-brand mt-3 w-full py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-brand/20">Compartir con el móvil</button></div></div>`);
  }
  const roundsCard = byId('cfg-rounds')?.closest('.glass');
  if (roundsCard && !roundsCard.dataset.infiniteModeNotice) {
    roundsCard.dataset.infiniteModeNotice = '1';
    roundsCard.innerHTML = `<div class="px-4 py-3.5"><div class="flex items-center justify-between gap-3"><div><p class="text-sm font-semibold">Preguntas infinitas</p><p class="text-xs text-zinc-500 mt-0.5">La partida sigue hasta que el admin pulse Fin del juego</p></div><span class="text-2xl font-black text-gradient">∞</span></div></div>`;
  }
  if (!byId('cfg-round-time')) {
    roundsCard?.insertAdjacentHTML('afterend', `<div id="round-time-card" class="mx-4 mb-2 glass rounded-2xl"><div class="flex items-center justify-between gap-3 px-4 py-3.5"><div><p class="text-sm font-semibold">Tiempo por ronda</p><p class="text-xs text-zinc-500 mt-0.5">Evita que la partida se quede bloqueada</p></div><select id="cfg-round-time" class="bg-zinc-800/70 border border-zinc-700/60 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/70"><option value="0">Sin límite</option><option value="15">15 s</option><option value="30" selected>30 s</option><option value="45">45 s</option><option value="60">60 s</option></select></div></div>`);
  }
  if (!byId('result-options-card')) {
    const voteSettingsCard = byId('cfg-private')?.closest('.glass');
    voteSettingsCard?.insertAdjacentHTML('afterend', `<div id="result-options-card" class="mx-4 mb-4 glass rounded-2xl overflow-hidden divide-y divide-white/5"><div class="px-4 py-3.5"><p class="text-sm font-semibold">Resultados</p><p class="text-xs text-zinc-500 mt-0.5">Controla qué se revela al terminar cada votación</p></div><label class="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[.03] transition"><div><p class="text-sm font-semibold">Ver todos los resultados</p><p class="text-xs text-zinc-500 mt-0.5">Si se desmarca, solo se revela el más votado</p></div><span class="toggle"><input id="cfg-show-all-results" type="checkbox" checked /><span class="toggle-track"></span></span></label><label class="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[.03] transition"><div><p class="text-sm font-semibold">Ocultar empates</p><p class="text-xs text-zinc-500 mt-0.5">Si hay empate, el juego elige uno al azar para más caos</p></div><span class="toggle"><input id="cfg-hide-ties" type="checkbox" /><span class="toggle-track"></span></span></label><label id="cfg-red-green-row" class="hidden flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[.03] transition"><div><p class="text-sm font-semibold">Rojo / Verde</p><p class="text-xs text-zinc-500 mt-0.5">Rojo si eres el más votado, verde si no</p></div><span class="toggle"><input id="cfg-red-green" type="checkbox" /><span class="toggle-track"></span></span></label><label id="cfg-vote-count-row" class="hidden flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[.03] transition"><div><p class="text-sm font-semibold">Ver número de votos</p><p class="text-xs text-zinc-500 mt-0.5">Solo configurable cuando el voto es secreto</p></div><span class="toggle"><input id="cfg-show-vote-counts" type="checkbox" checked /><span class="toggle-track"></span></span></label></div>`);
  }
  if (!byId('admin-participation-card')) {
    byId('result-options-card')?.insertAdjacentHTML('afterend', `<div id="admin-participation-card" class="mx-4 mb-4 glass rounded-2xl overflow-hidden"><label class="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[.03] transition"><div><p class="text-sm font-semibold">El Admin cuenta para votos</p><p class="text-xs text-zinc-500 mt-0.5">Si se desmarca, el admin no puede votar ni recibir votos</p></div><span class="toggle"><input id="cfg-admin-counts" type="checkbox" checked /><span class="toggle-track"></span></span></label></div>`);
  }
  if (byId('cfg-admin-counts') && !byId('cfg-admin-counts').dataset.adminCountsBound) {
    byId('cfg-admin-counts').dataset.adminCountsBound = '1';
    byId('cfg-admin-counts').addEventListener('input', () => {
      updateStartButton();
      renderWaitingPlayers();
    });
  }
  ['cfg-show-all-results', 'cfg-private'].forEach(id => {
    const input = byId(id);
    if (input && !input.dataset.resultOptionsBound) {
      input.dataset.resultOptionsBound = '1';
      input.addEventListener('input', () => App.updateResultOptionsMode?.());
    }
  });
  if (!byId('admin-force-end')) {
    byId('admin-next')?.insertAdjacentHTML('beforeend', `<button id="admin-force-end" type="button" onclick="App.endGameForEveryone()" class="mt-3 w-full bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-100 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition">Fin del juego</button>`);
  }
  if (!byId('admin-game-force-end')) {
    const gameFooter = byId('votes-status')?.parentElement;
    gameFooter?.insertAdjacentHTML('afterend', `<button id="admin-game-force-end" type="button" onclick="App.endGameForEveryone()" class="hidden mx-5 mb-4 bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-100 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition">Fin del juego</button>`);
  }
  if (!byId('question-categories-card')) {
    const questionsCard = byId('cfg-questions')?.closest('.glass');
    questionsCard?.insertAdjacentHTML('afterend', `<div id="question-categories-card" class="mx-4 mb-4 glass rounded-2xl p-4"><div class="flex items-start justify-between gap-3 mb-3"><div><p class="text-sm font-semibold">Categorías de preguntas</p><p class="text-xs text-zinc-500 mt-0.5">Elige qué temas entran en la partida</p></div><span id="question-category-count" class="text-xs bg-brand/20 text-brand-light px-2.5 py-1 rounded-full font-bold whitespace-nowrap">Todas</span></div><div class="flex gap-2 mb-3"><button type="button" onclick="App.selectQuestionCategories(true)" class="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl text-xs font-bold transition">Todas</button><button type="button" onclick="App.selectQuestionCategories(false)" class="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl text-xs font-bold transition">Limpiar</button></div><div id="question-category-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2"></div><p id="question-category-summary" class="text-xs text-zinc-500 mt-3"></p></div>`);
  }
  if (byId('cfg-questions') && !byId('cfg-questions').dataset.categoryBound) {
    byId('cfg-questions').dataset.categoryBound = '1';
    byId('cfg-questions').addEventListener('input', () => App.updateQuestionMode?.());
  }

  if (!byId('round-timer-box')) {
    const progress = byId('round-progress')?.parentElement;
    progress?.insertAdjacentHTML('afterend', `<div id="round-timer-box" class="hidden px-5 py-2 border-b border-white/5 bg-zinc-950/60"><div class="flex items-center justify-between gap-3 text-xs"><span class="text-zinc-500 font-bold uppercase tracking-wider">Tiempo</span><span id="round-timer-label" class="font-black text-brand-light">—</span></div><div class="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div id="round-timer-bar" class="h-full bg-gradient-to-r from-brand to-violet-400 transition-all duration-300" style="width:100%"></div></div></div>`);
  }
  if (!byId('democrazy-enhanced-style')) {
    const style = document.createElement('style');
    style.id = 'democrazy-enhanced-style';
    style.textContent = `@keyframes votePulse{0%{transform:scale(1)}45%{transform:scale(1.08)}100%{transform:scale(1)}}@keyframes voteRipple{from{opacity:.45;transform:translate(-50%,-50%) scale(.35)}to{opacity:0;transform:translate(-50%,-50%) scale(2.7)}}.vote-card.vote-pop{animation:votePulse .34s cubic-bezier(.34,1.4,.64,1)}.vote-ripple{position:absolute;left:50%;top:50%;width:84px;height:84px;border-radius:999px;background:rgba(124,58,237,.65);pointer-events:none;animation:voteRipple .55s ease-out forwards}.timer-danger #round-timer-label{color:#f87171}.timer-danger #round-timer-bar{background:linear-gradient(90deg,#ef4444,#f97316)}#qr-panel{display:none!important}#login-form input::selection{background:rgba(124,58,237,.35)}.question-category-pill{border:1px solid rgba(255,255,255,.06);background:rgba(39,39,42,.72)}.question-category-pill:has(input:checked){border-color:rgba(124,58,237,.7);background:rgba(124,58,237,.18);box-shadow:0 0 0 1px rgba(124,58,237,.22)}.question-category-pill input{accent-color:#7C3AED}@keyframes epicFlash{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.035)}}@keyframes epicCrownDrop{0%{opacity:0;transform:translateY(-28px) scale(.6) rotate(-10deg)}60%{opacity:1;transform:translateY(4px) scale(1.16) rotate(5deg)}100%{opacity:1;transform:translateY(0) scale(1) rotate(0)}}@keyframes epicNameReveal{0%{opacity:0;filter:blur(16px);letter-spacing:.35em;transform:translateY(18px) scale(.92)}70%{opacity:1;filter:blur(0);letter-spacing:.05em;transform:translateY(-3px) scale(1.04)}100%{opacity:1;filter:blur(0);letter-spacing:.02em;transform:translateY(0) scale(1)}}@keyframes epicCardIn{0%{opacity:0;transform:translateY(22px) scale(.94);filter:blur(10px)}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}@keyframes epicGlowSweep{0%{transform:translateX(-130%) skewX(-20deg)}100%{transform:translateX(130%) skewX(-20deg)}}.epic-reveal-stage{position:relative;overflow:hidden}.epic-reveal-stage:before{content:'';position:absolute;inset:-40%;background:radial-gradient(circle at 50% 20%,rgba(124,58,237,.32),transparent 34%),radial-gradient(circle at 15% 85%,rgba(245,158,11,.18),transparent 28%);pointer-events:none;animation:epicFlash 2.3s ease-in-out infinite}.epic-reveal-content{position:relative;z-index:1}.epic-winner-name{animation:epicNameReveal .95s cubic-bezier(.18,1.35,.32,1) both;text-shadow:0 0 26px rgba(167,139,250,.55)}.epic-crown{animation:epicCrownDrop .8s cubic-bezier(.18,1.35,.32,1) both}.epic-result-card{animation:epicCardIn .55s cubic-bezier(.18,1,.32,1) both;position:relative;overflow:hidden}.epic-result-card:after{content:'';position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);animation:epicGlowSweep 1.05s ease-out .15s both;pointer-events:none}.epic-dots span{animation:epicFlash 1s ease-in-out infinite}.epic-dots span:nth-child(2){animation-delay:.15s}.epic-dots span:nth-child(3){animation-delay:.3s}@keyframes redGreenPulse{0%,100%{transform:scale(1);filter:saturate(1)}50%{transform:scale(1.018);filter:saturate(1.25)}}.red-green-red{border-color:rgba(248,113,113,.55)!important;box-shadow:0 0 48px rgba(239,68,68,.24)!important;background:linear-gradient(145deg,rgba(127,29,29,.82),rgba(24,24,27,.88))!important;animation:redGreenPulse 1.8s ease-in-out infinite}.red-green-green{border-color:rgba(52,211,153,.55)!important;box-shadow:0 0 48px rgba(16,185,129,.24)!important;background:linear-gradient(145deg,rgba(6,78,59,.82),rgba(24,24,27,.88))!important;animation:redGreenPulse 1.8s ease-in-out infinite}.red-green-badge{animation:epicCardIn .55s cubic-bezier(.18,1,.32,1) both}@media(max-width:640px){#screen-login{padding-left:16px!important;padding-right:16px!important}#login-form{width:100%;max-width:100%}:root{--app-x:clamp(12px,4vw,18px)}#screen-login,#screen-lobby,#screen-final{padding-left:var(--app-x)!important;padding-right:var(--app-x)!important}#screen-waiting,#screen-game,#screen-reveal{padding:var(--app-x)!important;gap:12px}#screen-waiting>.glass:first-child,#screen-game>.glass:first-child,#screen-reveal>.glass:first-child{border-radius:24px;top:var(--app-x);margin:0}#admin-settings{border-bottom:0!important}.screen .mx-4{margin-left:0!important;margin-right:0!important}.screen .px-5{padding-left:16px!important;padding-right:16px!important}.screen .p-5{padding:16px!important}#screen-game>.flex-1,#screen-reveal>.flex-1,#screen-waiting>.flex-1{padding-left:2px!important;padding-right:2px!important}#game-question{font-size:1.35rem;line-height:1.25}#vote-grid{gap:10px}.vote-card{padding:16px 10px!important}#toast{max-width:calc(100vw - 24px);white-space:normal;text-align:center;justify-content:center}}`;
    document.head.appendChild(style);
  }

  if (!byId('democrazy-room-ended-style')) {
    const style = document.createElement('style');
    style.id = 'democrazy-room-ended-style';
    style.textContent = `.room-ended-flash{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(9,9,11,.94);backdrop-filter:blur(18px);animation:epicCardIn .35s ease both}.room-ended-flash>div{max-width:22rem;margin:1rem;text-align:center}`;
    document.head.appendChild(style);
  }
}

let socketConnectorPromise = null;
async function loadSocketConnector() {
  if (!socketConnectorPromise) {
    socketConnectorPromise = import('https://esm.sh/itty-sockets').then(mod => mod.connect).catch(error => {
      console.warn('No se pudo cargar itty-sockets. Se usará polling contra la API.', error);
      return null;
    });
  }
  return socketConnectorPromise;
}

function closeSocket(manual = true) {
  state.socketManualClose = manual;
  clearTimeout(state.socketReconnectTimer);
  clearInterval(state.pollingTimer);
  state.socketReconnectTimer = null;
  state.pollingTimer = null;
  state.socketReady = false;
  try { state.socket?.close?.(); } catch {}
  state.socket = null;
}

async function pollRoomState(roomCode) {
  try {
    const roomData = await api.getRoom(roomCode);
    const gameState = extractGameState(roomData);
    applyGameState(gameState);
    const latestEvent = gameState.latestEvent;
    if (latestEvent?.id && latestEvent.id !== state.lastEventId) {
      handleSocketMessage(latestEvent, { fromPoll: true });
    } else {
      renderWaitingPlayers();
      renderVoteStatus();
    }
  } catch (error) {
    console.warn('Error actualizando sala por polling', error);
  }
}

function setupPolling(roomCode) {
  clearInterval(state.pollingTimer);
  state.socketReady = true;
  state.pollingTimer = setInterval(() => pollRoomState(roomCode), POLL_MS);
  pollRoomState(roomCode);
  flushPendingMessages();
  return true;
}

async function connectSocket(roomCode, { reconnect = false } = {}) {
  if (!roomCode) return false;
  if (!reconnect) {
    closeSocket(false);
    state.socketReconnectAttempts = 0;
  }
  state.socketRoomCode = roomCode;
  state.socketManualClose = false;

  const connect = await loadSocketConnector();
  if (!connect) {
    toast('Conexión por API activada', '📡');
    return setupPolling(roomCode);
  }

  try {
    state.socket = connect(`democrazy-${roomCode}`);
    state.socketReady = true;
    state.socketReconnectAttempts = 0;
    state.socket.on?.('message', ({ message }) => {
      try { handleSocketMessage(typeof message === 'string' ? JSON.parse(message) : message); }
      catch (e) { console.warn('socket parse error', e); }
    });
    const scheduleReconnect = () => {
      state.socketReady = false;
      if (state.socketManualClose || !state.socketRoomCode) return;
      if (state.socketReconnectAttempts >= SOCKET_MAX_RETRIES) {
        toast('Conexión por API activada', '📡');
        setupPolling(state.socketRoomCode);
        return;
      }
      state.socketReconnectAttempts += 1;
      clearTimeout(state.socketReconnectTimer);
      state.socketReconnectTimer = setTimeout(() => connectSocket(state.socketRoomCode, { reconnect: true }), SOCKET_RECONNECT_MS * state.socketReconnectAttempts);
    };
    state.socket.on?.('close', scheduleReconnect);
    state.socket.on?.('error', scheduleReconnect);
    flushPendingMessages();
    return true;
  } catch (error) {
    console.warn('socket connect error', error);
    state.socketReady = false;
    return setupPolling(roomCode);
  }
}

function flushPendingMessages() {
  const queued = state.pendingMessages.splice(0);
  queued.forEach(data => emit(data));
}

function emit(data) {
  if (!data) return;
  const event = { ...data, id: data.id || `${Date.now()}-${Math.random().toString(16).slice(2)}` };
  if (state.socketReady && state.socket?.send) state.socket.send(JSON.stringify(event));
  else if (!state.pollingTimer) state.pendingMessages.push(event);
  persistGameState({ latestEvent: event, status: event.type === 'room_closed' ? 'closed' : (event.type === 'game_over' ? 'finished' : undefined) });
}

function handleSocketMessage(data, { fromPoll = false } = {}) {
  if (!data?.type) return;
  if (data.id) state.lastEventId = data.id;
  switch (data.type) {
    case 'player_joined': {
      const p = upsertPlayer(data.player);
      if (p && state.scores[p.id] == null) state.scores[p.id] = 0;
      renderWaitingPlayers();
      if (state.isHost && !fromPoll) emit({ type: 'room_update', players: state.players, hostId: state.hostId });
      break;
    }
    case 'room_update':
      state.players = (data.players ?? []).map(normPlayer);
      state.hostId = String(data.hostId ?? state.hostId ?? '');
      state.isHost = sid() === state.hostId;
      renderWaitingPlayers();
      renderVoteStatus();
      break;
    case 'player_left':
      state.players = state.players.filter(p => p.id !== String(data.playerId));
      delete state.votes[String(data.playerId)];
      renderWaitingPlayers();
      renderVoteStatus();
      break;
    case 'game_started':
      state.settings = normalizeSettings(data.settings);
      state.players = (data.players ?? []).map(normPlayer);
      state.hostId = String(data.hostId ?? state.hostId ?? '');
      state.isHost = sid() === state.hostId;
      state.currentRound = 0;
      state.scores = {};
      state.players.forEach(p => { state.scores[p.id] = 0; });
      saveActiveSession();
      _startRound(data.firstRound);
      break;
    case 'question_set':
      state.currentQuestion = String(data.question || '');
      state.currentInventorId = data.inventorId ? String(data.inventorId) : state.currentInventorId;
      persistGameState();
      renderQuestionArea();
      renderVoteGrid();
      renderVoteStatus();
      maybeStartRoundTimer();
      break;
    case 'timer_sync':
      if (!state.isHost && data.round === state.currentRound) startTimer(Number(data.remaining ?? 0), { fromHost: true });
      break;
    case 'round_timeout':
      if (data.round === state.currentRound) {
        state.timerExpired = true;
        stopTimer(false);
        renderTimer(0);
        renderVoteStatus();
        if (!state.isHost) toast('Tiempo agotado. Esperando resultados...', '⏱️');
      }
      break;
    case 'vote_cast':
      state.votes[String(data.voterId)] = String(data.votedId);
      persistGameState();
      renderVoteStatus();
      if (state.isHost && allPlayersVoted()) _doReveal();
      break;
    case 'round_reveal':
      stopTimer();
      state.votes = data.votes ?? {};
      state.scores = data.scores ?? {};
      state.roundWinnerIds = Array.isArray(data.roundWinnerIds) ? data.roundWinnerIds.map(String) : (data.roundWinnerId ? [String(data.roundWinnerId)] : []);
      persistGameState();
      _showReveal(data.round, data.question);
      break;
    case 'next_round':
      _startRound(data.round);
      break;
    case 'game_over':
      stopTimer();
      state.scores = data.scores ?? {};
      persistGameState({ status: 'finished' });
      _showFinal();
      break;
    case 'room_closed':
      closeRoomLocally(data.reason || 'El administrador ha terminado la partida.');
      break;
    case 'new_room_created':
      stopTimer();
      state.room = data.room;
      state.hostId = String(data.hostId ?? '');
      state.isHost = false;
      state.settings = normalizeSettings(data.settings);
      state.players = (data.players ?? []).map(normPlayer);
      state.currentRound = 0;
      state.currentQuestion = null;
      state.currentInventorId = null;
      state.votes = {};
      state.scores = {};
      state.hasVoted = false;
      connectSocket(state.room.code).then(() => emit({ type: 'player_joined', player: currentPlayer() }));
      saveActiveSession();
      App._enterWaiting();
      break;
  }
}

window.App = {
  init() {
    injectDynamicUI();
    const params = new URLSearchParams(location.search);
    const hashCode = roomCodeFromHash(location.hash);
    const code = (params.get('sala') || params.get('room') || hashCode || '').toUpperCase();
    const savedSession = getSavedSession();
    const canRestoreFromRoute = routeCanRestoreRoom(location.hash);

    if (savedSession && !code && !canRestoreFromRoute) {
      clearActiveSession();
    }

    const saved = localStorage.getItem('democrazy_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        u.id = String(u.id);
        state.user = u;
        setHomeUsername(u.username);
      } catch { localStorage.removeItem('democrazy_user'); }
    }

    if (code) sessionStorage.setItem('pending_room', code);
    if (!code && !canRestoreFromRoute) showHome({ replace: true });
    if (code && !state.user) showHome({ join: true, roomCode: code, replace: true });

    if (state.user && (code || canRestoreFromRoute)) {
      const shouldReconnect = Boolean(savedSession?.roomCode && (!code || savedSession.roomCode === code) && canRestoreFromRoute);
      setTimeout(() => App._enterLobby({ restoreSavedRoom: shouldReconnect }), 0);
    }
  },

  useExistingUser() { showHome(); },

  showNewUserForm() { showHome(); byId('input-username')?.focus(); },

  async prepareHomeUser() {
    const username = byId('input-username')?.value.trim() || '';
    const errEl = byId('login-error');
    errEl?.classList.add('hidden');
    byId('input-username')?.classList.remove('shake');
    if (!username || username.length < 2) {
      if (errEl) {
        errEl.textContent = 'Pon un nombre de al menos 2 caracteres.';
        errEl.classList.remove('hidden');
      }
      byId('input-username')?.classList.add('shake');
      setTimeout(() => byId('input-username')?.classList.remove('shake'), 400);
      return false;
    }
    if (state.user?.id && state.user.username === username) return true;
    try {
      const res = await api.createUser(username, 'democrazy', '');
      const user = { id: String(res.user_id ?? res.id), username };
      state.user = user;
      localStorage.setItem('democrazy_user', JSON.stringify(user));
      setHomeUsername(username);
      return true;
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message || 'Error al crear jugador.';
        errEl.classList.remove('hidden');
      }
      return false;
    }
  },

  async createUser() {
    if (await App.prepareHomeUser()) showHome();
  },

  async createHomeRoom() {
    if (await App.prepareHomeUser()) await App.createRoom();
  },

  async showJoinForm(roomCode = '') {
    if (!(await App.prepareHomeUser())) return;
    showHomeJoin(roomCode || sessionStorage.getItem('pending_room') || '');
  },

  hideJoinForm() {
    hideHomeJoin();
    if (!sessionStorage.getItem('pending_room')) history.replaceState({ screen: 'login' }, '', '#/');
  },

  async joinHomeRoom() {
    if (!(await App.prepareHomeUser())) return;
    await App.joinRoom();
  },

  switchUser() {
    clearActiveSession();
    localStorage.removeItem('democrazy_user');
    sessionStorage.removeItem('pending_room');
    state.user = null;
    state.room = null;
    byId('input-username') && (byId('input-username').value = '');
    byId('home-switch-user')?.classList.add('hidden');
    showHome({ replace: true });
  },

  async _enterLobby({ restoreSavedRoom = false } = {}) {
    const pending = sessionStorage.getItem('pending_room');
    const savedRoom = restoreSavedRoom ? getSavedSession() : null;
    if (savedRoom && (!pending || savedRoom.roomCode === pending)) {
      if (pending) sessionStorage.removeItem('pending_room');
      await App.reconnectRoom(savedRoom.roomCode);
      return;
    }
    if (pending) {
      sessionStorage.removeItem('pending_room');
      byId('input-room-code').value = pending;
      await App.joinRoom();
      return;
    }
    showHome({ replace: true });
  },

  async reconnectRoom(code) {
    try {
      const roomData = await api.getRoom(code);
      const gameState = extractGameState(roomData);
      state.room = { code, id: String(roomData.id ?? roomData.room_id ?? getSavedSession()?.roomId ?? '') };
      state.hostId = roomHostId(roomData, gameState.hostId ?? getSavedSession()?.hostId);
      applyGameState(gameState);
      state.isHost = sid() === state.hostId;
      const rawPlayers = roomData.players ?? roomData.users ?? roomData.members ?? state.players;
      state.players = rawPlayers.map(normPlayer);
      upsertPlayer(currentPlayer());
      state.settings = normalizeSettings(roomData.room_settings ?? roomData.settings ?? gameState.settings ?? state.settings);
      if (roomData.status === 'closed' || gameState.status === 'closed') {
        closeRoomLocally('Esta sala ya ha terminado.');
        return;
      }
      await connectSocket(code);
      emit({ type: 'player_joined', player: currentPlayer() });
      saveActiveSession();
      if ((roomData.status === 'playing' || gameState.status === 'playing') && state.currentRound && (state.currentQuestion || state.currentInventorId)) _startRound({ roundNum: state.currentRound, question: state.currentQuestion, inventorId: state.currentInventorId });
      else if ((roomData.status === 'finished' || gameState.status === 'finished') && Object.keys(state.scores).length) _showFinal();
      else App._enterWaiting();
    } catch (error) {
      clearActiveSession();
      console.warn('No se pudo reconectar a la sala', error);
    }
  },

  async createRoom() {
    const btn = qs('.screen.active [data-create-room-button]') || byId('screen-lobby')?.querySelector('.btn-brand');
    const previousHTML = btn?.innerHTML;
    if (btn) {
      btn.textContent = 'Creando...';
      btn.disabled = true;
    }
    try {
      const settings = normalizeSettings({ rounds: 0, infiniteMode: true, points: true, privateVote: false, showAllResults: true, redGreenMode: false, showVoteCounts: true, hideTies: false, useQuestions: true, questionVisible: true, roundTimeLimit: 30, questionCategories: getAllQuestionCategoryIds() });
      const res = await api.createRoom(GAME_ID, sid(), settings, { status: 'waiting', hostId: sid(), players: [currentPlayer()], settings });
      state.room = { code: res.room_code ?? res.code, id: String(res.room_id ?? res.id) };
      state.hostId = sid();
      state.isHost = true;
      state.players = [currentPlayer()];
      state.settings = settings;
      await connectSocket(state.room.code);
      persistGameState({ status: 'waiting' });
      saveActiveSession();
      App._enterWaiting();
    } catch (e) {
      toast('Error al crear sala: ' + (e.message || 'desconocido'), '⚠️');
      console.error(e);
    } finally {
      if (btn) {
        btn.innerHTML = previousHTML || 'Crear sala';
        btn.disabled = false;
      }
    }
  },

  async joinRoom() {
    const code = byId('input-room-code').value.trim().toUpperCase();
    const errEl = byId('join-error');
    errEl?.classList.add('hidden');
    if (code.length < 4) {
      if (errEl) { errEl.textContent = 'Introduce el código de la sala.'; errEl.classList.remove('hidden'); }
      return;
    }
    try {
      await api.joinRoom(code, sid());
      const roomData = await api.getRoom(code);
      const gameState = extractGameState(roomData);
      if (roomData.status === 'closed' || gameState.status === 'closed') {
        if (errEl) { errEl.textContent = 'Esta sala ya ha terminado.'; errEl.classList.remove('hidden'); }
        clearActiveSession();
        return;
      }
      state.room = { code, id: String(roomData.id ?? roomData.room_id ?? '') };
      state.hostId = roomHostId(roomData, gameState.hostId);
      state.isHost = sid() === state.hostId;
      state.players = (roomData.players ?? roomData.users ?? roomData.members ?? gameState.players ?? []).map(normPlayer);
      upsertPlayer(currentPlayer());
      state.settings = normalizeSettings(roomData.room_settings ?? roomData.settings ?? gameState.settings ?? state.settings);
      await connectSocket(code);
      emit({ type: 'player_joined', player: currentPlayer() });
      saveActiveSession();
      App._enterWaiting();
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message || 'Sala no encontrada.';
        errEl.classList.remove('hidden');
      }
      console.error(e);
    }
  },

  _enterWaiting() {
    injectDynamicUI();
    byId('waiting-code').textContent = state.room.code;
    byId('qr-code-label').textContent = state.room.code;
    byId('admin-settings').classList.toggle('hidden', !state.isHost);
    byId('admin-start').classList.toggle('hidden', !state.isHost);
    byId('guest-wait').classList.toggle('hidden', state.isHost);
    if (state.isHost) {
      const s = normalizeSettings(state.settings);
      if (byId('cfg-rounds')) byId('cfg-rounds').value = s.rounds || 0;
      if (byId('cfg-rounds-display')) byId('cfg-rounds-display').textContent = '∞';
      byId('cfg-points').checked = s.points;
      byId('cfg-private').checked = s.privateVote;
      if (byId('cfg-admin-counts')) byId('cfg-admin-counts').checked = s.adminCountsForVotes !== false;
      if (byId('cfg-show-all-results')) byId('cfg-show-all-results').checked = s.showAllResults;
      if (byId('cfg-red-green')) byId('cfg-red-green').checked = s.redGreenMode;
      if (byId('cfg-show-vote-counts')) byId('cfg-show-vote-counts').checked = s.showVoteCounts;
      if (byId('cfg-hide-ties')) byId('cfg-hide-ties').checked = s.hideTies === true;
      byId('cfg-questions').checked = s.useQuestions;
      byId('cfg-visible').checked = s.questionVisible ?? true;
      if (byId('cfg-round-time')) byId('cfg-round-time').value = String(s.roundTimeLimit ?? 30);
      renderQuestionCategorySettings(s.questionCategories);
      App.updateQuestionMode();
      App.updateResultOptionsMode();
      App.updateVisibleHint();
    }
    renderWaitingPlayers();
    renderQR(getShareUrl());
    saveActiveSession();
    showScreen('waiting');
    history.replaceState({ screen: 'waiting' }, '', `?sala=${encodeURIComponent(state.room.code)}`);
  },

  toggleQR() { App.openShareModal(); },

  shareRoom() { App.openShareModal(); },

  openShareModal() {
    const modal = byId('share-modal');
    if (!modal || !state.room?.code) return;
    const url = getShareUrl();
    byId('share-room-code').textContent = state.room.code;
    const input = byId('share-link-input');
    if (input) input.value = url;
    byId('native-share-button')?.classList.toggle('hidden', !navigator.share);
    renderQR(url);
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => input?.select?.(), 40);
  },

  closeShareModal() {
    byId('share-modal')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  },

  async copyShareLink() {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado', '📋');
    } catch {
      const input = byId('share-link-input');
      input?.select?.();
      toast('Copia el enlace seleccionado', '📋');
    }
  },

  async shareViaWebShare() {
    const url = getShareUrl();
    if (!navigator.share) return App.copyShareLink();
    try {
      await navigator.share({ title: 'Democrazy', text: `Únete con código: ${state.room.code}`, url });
      App.closeShareModal();
    } catch {}
  },

  getSelectedQuestionCategories() {
    return [...document.querySelectorAll('.question-category-checkbox:checked')].map(input => input.value);
  },

  selectQuestionCategories(selectAll = true) {
    document.querySelectorAll('.question-category-checkbox').forEach(input => { input.checked = Boolean(selectAll); });
    App.updateCategorySummary();
  },

  updateCategorySummary() {
    const categories = getQuestionCategories();
    const selected = App.getSelectedQuestionCategories();
    const summary = byId('question-category-summary');
    const count = byId('question-category-count');
    if (summary) {
      if (!categories.length) summary.textContent = 'No hay categorías cargadas.';
      else if (!selected.length) summary.textContent = 'Marca al menos una categoría para usar preguntas predefinidas.';
      else if (selected.length === categories.length) summary.textContent = `${categories.length} categorías activas · ${window.questions?.length ?? 0} preguntas disponibles.`;
      else {
        const totalQuestions = categories.filter(category => selected.includes(String(category.id))).reduce((acc, category) => acc + category.questions.length, 0);
        summary.textContent = `${selected.length} de ${categories.length} categorías activas · ${totalQuestions} preguntas disponibles.`;
      }
    }
    if (count) count.textContent = !selected.length ? '0' : (selected.length === categories.length ? 'Todas' : String(selected.length));
    updateStartButton();
  },

  updateResultOptionsMode() {
    const showAllResults = byId('cfg-show-all-results')?.checked ?? true;
    const privateVote = byId('cfg-private')?.checked ?? false;
    const redGreenRow = byId('cfg-red-green-row');
    const redGreenInput = byId('cfg-red-green');
    const voteCountRow = byId('cfg-vote-count-row');
    const voteCountInput = byId('cfg-show-vote-counts');

    redGreenRow?.classList.toggle('hidden', showAllResults);
    if (redGreenInput) {
      redGreenInput.disabled = showAllResults;
      if (showAllResults) redGreenInput.checked = false;
    }

    voteCountRow?.classList.toggle('hidden', !privateVote);
    if (voteCountInput) {
      voteCountInput.disabled = !privateVote;
      if (!privateVote) voteCountInput.checked = true;
    }
  },

  updateQuestionMode() {
    const enabled = byId('cfg-questions')?.checked ?? true;
    const card = byId('question-categories-card');
    card?.classList.toggle('opacity-50', !enabled);
    card?.classList.toggle('pointer-events-none', !enabled);
    App.updateCategorySummary();
  },

  adjRounds(delta) {
    const input = byId('cfg-rounds');
    const display = byId('cfg-rounds-display');
    const val = Math.min(20, Math.max(1, (parseInt(input.value) || 5) + delta));
    input.value = val;
    display.textContent = val;
    display.classList.add('scale-125');
    setTimeout(() => display.classList.remove('scale-125'), 200);
  },

  updateVisibleHint() {
    byId('cfg-visible-hint').textContent = byId('cfg-visible').checked ? 'Todos ven la pregunta' : 'Solo el admin ve la pregunta';
  },

  async startGame() {
    if (!state.isHost) return;
    const adminCountsForVotes = byId('cfg-admin-counts')?.checked ?? true;
    const pendingSettings = normalizeSettings({ ...state.settings, adminCountsForVotes });
    if (votingPlayers(state.players, pendingSettings).length < 2) {
      toast('Necesitas al menos 2 jugadores participantes para empezar', '👥');
      updateStartButton();
      return;
    }
    const useQuestions = byId('cfg-questions').checked;
    const selectedCategories = App.getSelectedQuestionCategories();
    if (useQuestions && !selectedCategories.length) {
      toast('Selecciona al menos una categoría', '🏷️');
      App.updateCategorySummary();
      return;
    }
    const privateVote = byId('cfg-private').checked;
    const showAllResults = byId('cfg-show-all-results')?.checked ?? true;
    const settings = normalizeSettings({
      rounds: 0,
      infiniteMode: true,
      points: byId('cfg-points').checked,
      privateVote,
      adminCountsForVotes,
      showAllResults,
      redGreenMode: !showAllResults && (byId('cfg-red-green')?.checked ?? false),
      showVoteCounts: privateVote ? (byId('cfg-show-vote-counts')?.checked ?? true) : true,
      hideTies: byId('cfg-hide-ties')?.checked ?? false,
      useQuestions,
      questionVisible: byId('cfg-visible').checked,
      roundTimeLimit: parseInt(byId('cfg-round-time')?.value ?? '30', 10) || 0,
      questionCategories: selectedCategories,
    });
    state.settings = settings;
    state.scores = {};
    state.players.forEach(p => { state.scores[p.id] = 0; });
    state.currentRound = 0;
    const firstRound = _buildRound(1);
    await api.updateRoomState(state.room.code, { status: 'playing', roomSettings: settings, gameState: getGameState({ status: 'playing' }) });
    emit({ type: 'game_started', settings, players: state.players, hostId: state.hostId, firstRound });
    saveActiveSession();
    _startRound(firstRound);
  },

  setCustomQuestion() {
    const input = byId('manual-question-input');
    const err = byId('manual-question-error');
    if (!input) return;
    const question = input.value.trim();
    if (question.length < 3) {
      if (err) { err.textContent = 'Escribe una pregunta un poco más larga.'; err.classList.remove('hidden'); }
      return;
    }
    state.currentQuestion = question;
    emit({ type: 'question_set', round: state.currentRound, question, inventorId: state.currentInventorId });
    renderQuestionArea();
    renderVoteGrid();
    renderVoteStatus();
    maybeStartRoundTimer();
  },

  castVote(votedId) {
    if (state.hasVoted || !state.currentQuestion || state.timerExpired) return;
    if (!currentUserCanVote()) {
      toast('El admin no participa en esta partida', '🚫');
      return;
    }
    const tid = String(votedId);
    if (!votingPlayerIds().has(tid) || tid === sid()) {
      toast('No puedes votar a ese jugador', '🚫');
      return;
    }
    state.hasVoted = true;
    state.votes[sid()] = tid;
    document.querySelectorAll('.vote-card').forEach(c => {
      const selected = c.dataset.id === tid;
      c.classList.toggle('selected', selected);
      c.classList.add('voted');
      if (selected) animateVoteCard(c);
    });
    byId('voted-feedback').textContent = '✓ Voto registrado';
    byId('voted-feedback').classList.remove('hidden');
    toast('Voto registrado', '✅');
    renderVoteStatus();
    emit({ type: 'vote_cast', voterId: sid(), votedId: tid });
    if (state.isHost && allPlayersVoted()) _doReveal();
  },

  nextRound() {
    if (!state.isHost) return;
    stopTimer();
    const round = _buildRound(state.currentRound + 1);
    emit({ type: 'next_round', round });
    _startRound(round);
  },

  endGameForEveryone() {
    if (!state.isHost) return;
    stopTimer();
    clearRevealAnimationTimers();
    emit({ type: 'room_closed', reason: 'El administrador ha terminado la partida.' });
    persistGameState({ status: 'closed' });
    closeRoomLocally('Has terminado la partida. Sala cerrada.');
  },

  async newGame() {
    try {
      if (!state.isHost) return;
      stopTimer();
      const currentPlayers = [...state.players];
      const res = await api.createRoom(GAME_ID, sid(), state.settings, { status: 'waiting', hostId: sid(), players: currentPlayers, settings: state.settings });
      const newRoom = { code: res.room_code ?? res.code, id: String(res.room_id ?? res.id) };
      emit({ type: 'new_room_created', room: newRoom, settings: state.settings, players: currentPlayers, hostId: sid() });
      state.room = newRoom;
      state.hostId = sid();
      state.isHost = true;
      state.players = currentPlayers;
      state.votes = {};
      state.scores = {};
      state.currentRound = 0;
      state.currentQuestion = null;
      state.currentInventorId = null;
      state.hasVoted = false;
      await connectSocket(state.room.code);
      persistGameState({ status: 'waiting' });
      saveActiveSession();
      App._enterWaiting();
    } catch (e) {
      toast('Error: ' + (e.message || 'desconocido'), '⚠️');
    }
  },

  exitToLobby() {
    stopTimer();
    closeSocket(true);
    clearActiveSession();
    state.room = null;
    state.isHost = false;
    state.hostId = null;
    state.players = [];
    showHome({ replace: true });
  },
};

function closeRoomLocally(message = 'La sala ha terminado.') {
  stopTimer();
  clearRevealAnimationTimers();
  closeSocket(true);
  clearActiveSession();
  sessionStorage.removeItem('pending_room');
  const overlay = document.createElement('div');
  overlay.className = 'room-ended-flash';
  overlay.innerHTML = `<div class="glass rounded-[2rem] p-7 border border-red-400/20 shadow-2xl"><div class="text-5xl mb-3">🏁</div><h2 class="text-3xl font-black text-gradient mb-2">Fin del juego</h2><p class="text-zinc-400 text-sm">${escapeHTML(message)}</p></div>`;
  document.body.appendChild(overlay);
  state.room = null;
  state.isHost = false;
  state.hostId = null;
  state.players = [];
  state.votes = {};
  state.currentRound = 0;
  state.currentQuestion = null;
  state.currentInventorId = null;
  state.hasVoted = false;
  setTimeout(() => {
    overlay.remove();
    showHome({ replace: true });
    toast(message, '🏁');
  }, 1300);
}

function animateVoteCard(card) {
  card.classList.remove('vote-pop');
  void card.offsetWidth;
  card.classList.add('vote-pop');
  card.style.position = 'relative';
  card.style.overflow = 'hidden';
  const ripple = document.createElement('span');
  ripple.className = 'vote-ripple';
  card.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

function getQuestionPoolForSettings(settings = state.settings) {
  const categories = getQuestionCategories();
  if (!categories.length) return (window.questions || []).map(question => typeof question === 'string' ? question : question.text).filter(Boolean);
  const selected = new Set(normalizeQuestionCategories(settings.questionCategories));
  const pool = categories
    .filter(category => selected.has(String(category.id)))
    .flatMap(category => category.questions.map(text => ({ text, categoryId: category.id, categoryName: category.name })));
  return pool.length ? pool : categories.flatMap(category => category.questions.map(text => ({ text, categoryId: category.id, categoryName: category.name })));
}

function _buildRound(roundNum) {
  const questionList = getQuestionPoolForSettings();
  if (state.settings.useQuestions && questionList.length) {
    const picked = questionList[Math.floor(Math.random() * questionList.length)];
    return { roundNum, question: typeof picked === 'string' ? picked : picked.text, questionCategoryId: picked.categoryId ?? null, questionCategoryName: picked.categoryName ?? null, inventorId: null };
  }
  const participants = votingPlayers();
  const inventorPool = participants.length ? participants : state.players;
  return { roundNum, question: null, questionCategoryId: null, questionCategoryName: null, inventorId: inventorPool[Math.floor(Math.random() * inventorPool.length)]?.id ?? sid() };
}

function allPlayersVoted() {
  const participants = votingPlayers();
  if (participants.length < 2) return false;
  return new Set(validVoteEntries().map(([voterId]) => String(voterId))).size >= participants.length;
}

function _doReveal() {
  if (!state.isHost) return;
  stopTimer(false);
  const voteCounts = {};
  const participants = votingPlayers();
  participants.forEach(p => { voteCounts[p.id] = 0; });
  const entries = validVoteEntries();
  entries.forEach(([, votedId]) => { voteCounts[String(votedId)] = (voteCounts[String(votedId)] || 0) + 1; });
  state.votes = Object.fromEntries(entries);

  const maxVotes = Math.max(...Object.values(voteCounts), 0);
  let winnerIds = maxVotes > 0 ? Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes) : [];
  if (hideTies() && winnerIds.length > 1) {
    winnerIds = [winnerIds[Math.floor(Math.random() * winnerIds.length)]];
  }
  state.roundWinnerIds = winnerIds.map(String);

  if (state.settings.points && winnerIds.length) {
    entries.forEach(([voterId, votedId]) => {
      if (winnerIds.includes(String(votedId))) state.scores[String(voterId)] = (state.scores[String(voterId)] || 0) + 1;
    });
  }
  emit({ type: 'round_reveal', round: state.currentRound, question: state.currentQuestion, votes: state.votes, scores: state.scores, roundWinnerIds: state.roundWinnerIds });
  _showReveal(state.currentRound, state.currentQuestion);
}

function maybeStartRoundTimer() {
  if (!state.currentQuestion) return;
  const limit = Number(state.settings.roundTimeLimit || 0);
  if (limit <= 0) {
    stopTimer(false);
    renderTimer(null);
    return;
  }
  if (state.isHost) {
    startTimer(limit);
    emit({ type: 'timer_sync', round: state.currentRound, remaining: limit });
  } else {
    renderTimer(limit);
  }
}

function startTimer(seconds, { fromHost = false } = {}) {
  stopTimer(false);
  const limit = Number(seconds || 0);
  if (limit <= 0) return renderTimer(null);
  state.timerExpired = false;
  state.timerRemaining = limit;
  state.timerEndsAt = Date.now() + limit * 1000;
  renderTimer(limit);
  state.timerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
    state.timerRemaining = remaining;
    renderTimer(remaining);
    if (state.isHost && remaining > 0 && remaining % 5 === 0) emit({ type: 'timer_sync', round: state.currentRound, remaining });
    if (remaining <= 0) {
      stopTimer(false);
      state.timerExpired = true;
      if (state.isHost) {
        emit({ type: 'round_timeout', round: state.currentRound });
        if (validVoteEntries().length === 0) toast('Ronda sin votos. Pasando a resultados.', '⏱️');
        _doReveal();
      } else if (!fromHost) {
        renderVoteStatus();
      }
    }
  }, 250);
}

function stopTimer(hide = true) {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerEndsAt = null;
  if (hide) renderTimer(null);
}

function renderTimer(remaining) {
  const box = byId('round-timer-box');
  const label = byId('round-timer-label');
  const bar = byId('round-timer-bar');
  if (!box || !label || !bar) return;
  if (remaining === null || remaining === undefined || Number(state.settings.roundTimeLimit || 0) <= 0) {
    box.classList.add('hidden');
    box.classList.remove('timer-danger');
    return;
  }
  const total = Math.max(1, Number(state.settings.roundTimeLimit || remaining || 1));
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  box.classList.remove('hidden');
  box.classList.toggle('timer-danger', remaining <= 5);
  label.textContent = remaining > 0 ? `${remaining}s` : 'Tiempo agotado';
  bar.style.width = `${pct}%`;
}

function renderQuestionCategorySettings(selectedIds = state.settings.questionCategories) {
  const list = byId('question-category-list');
  const card = byId('question-categories-card');
  if (!list || !card) return;
  const categories = getQuestionCategories();
  if (!categories.length) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  const selected = new Set(normalizeQuestionCategories(selectedIds));
  list.innerHTML = categories.map(category => {
    const id = escapeHTML(category.id);
    const name = escapeHTML(category.name);
    const emoji = escapeHTML(category.emoji || '🏷️');
    const count = category.questions.length;
    const checked = selected.has(String(category.id)) ? 'checked' : '';
    return `<label class="question-category-pill rounded-2xl px-3 py-2.5 flex items-center gap-3 cursor-pointer transition"><input type="checkbox" class="question-category-checkbox w-4 h-4 flex-shrink-0" value="${id}" ${checked} /><span class="text-lg flex-shrink-0">${emoji}</span><span class="min-w-0 flex-1"><span class="block text-sm font-bold truncate">${name}</span><span class="block text-[11px] text-zinc-500">${count} preguntas</span></span></label>`;
  }).join('');
  list.querySelectorAll('.question-category-checkbox').forEach(input => input.addEventListener('input', App.updateCategorySummary));
  App.updateQuestionMode?.();
}

function updateStartButton() {
  const btn = byId('admin-start')?.querySelector('button');
  if (!btn) return;
  const categoryOk = !(byId('cfg-questions')?.checked) || App.getSelectedQuestionCategories?.().length > 0;
  const pendingSettings = normalizeSettings({ ...state.settings, adminCountsForVotes: getAdminCountsSettingFromUI() });
  const participantCount = votingPlayers(state.players, pendingSettings).length;
  const playersOk = participantCount >= 2;
  const canStart = playersOk && categoryOk;
  btn.disabled = !canStart;
  btn.classList.toggle('opacity-50', !canStart);
  btn.classList.toggle('cursor-not-allowed', !canStart);
  btn.textContent = !playersOk ? 'Esperando más jugadores participantes' : (categoryOk ? '¡Comenzar partida! 🚀' : 'Elige una categoría');
}

function renderWaitingPlayers() {
  const c = byId('waiting-players');
  if (!c) return;
  byId('waiting-count').textContent = state.players.length;
  c.innerHTML = state.players.map((p, i) => {
    const username = escapeHTML(p.username);
    const hostBadge = p.id === state.hostId ? '<span class="text-xs bg-brand/20 text-brand-light px-2.5 py-0.5 rounded-full font-bold">Host</span>' : '';
    const adminOutBadge = p.id === state.hostId && getAdminCountsSettingFromUI() === false ? '<span class="text-xs bg-red-500/15 text-red-200 px-2.5 py-0.5 rounded-full font-bold">No juega</span>' : '';
    return `<div class="flex items-center gap-3 glass rounded-2xl px-4 py-3 pop" style="animation-delay:${i * .05}s"><div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-base shadow-md">${initials(p.username)}</div><span class="flex-1 font-semibold truncate">${username}</span>${p.id === sid() ? '<span class="text-xs text-zinc-500 font-medium">Tú</span>' : ''}${hostBadge}${adminOutBadge}</div>`;
  }).join('');
  updateStartButton();
}

function _startRound({ roundNum, question, inventorId }) {
  stopTimer();
  clearRevealAnimationTimers();
  state.currentRound = roundNum;
  state.currentQuestion = question ? String(question) : null;
  state.currentInventorId = inventorId ? String(inventorId) : null;
  state.votes = {};
  state.roundWinnerIds = [];
  state.hasVoted = false;
  state.timerExpired = false;
  byId('game-round').textContent = roundNum;
  byId('game-rounds').textContent = '∞';
  byId('voted-feedback').classList.add('hidden');
  byId('voted-feedback').textContent = '✓ Voto registrado';
  byId('round-progress').style.width = `${Math.min(100, ((roundNum - 1) % 10) * 10)}%`;
  persistGameState({ status: 'playing' });
  renderQuestionArea();
  renderScoresHeader();
  renderVoteGrid();
  renderVoteStatus();
  byId('admin-game-force-end')?.classList.toggle('hidden', !state.isHost);
  showScreen('game');
  maybeStartRoundTimer();
}

function renderQuestionArea() {
  const inventorEl = byId('question-inventor');
  const qEl = byId('game-question');
  const canSeeQuestion = state.settings.questionVisible || state.isHost;
  if (state.currentQuestion) {
    inventorEl.classList.add('hidden');
    qEl.classList.remove('hidden');
    qEl.textContent = canSeeQuestion ? state.currentQuestion : '🔒 El admin conoce la pregunta';
    return;
  }
  const inventor = state.players.find(p => p.id === String(state.currentInventorId));
  inventorEl.classList.remove('hidden');
  byId('inventor-name').textContent = inventor?.username ?? '?';
  qEl.classList.remove('hidden');
  const canCreate = sid() === String(state.currentInventorId) || state.isHost;
  if (canCreate) {
    qEl.innerHTML = `<span class="block text-sm text-zinc-400 font-medium mb-3">Escribe la pregunta de esta ronda para que todos puedan votar.</span><span class="block glass rounded-2xl p-3"><input id="manual-question-input" type="text" maxlength="140" placeholder="Ej: ¿Quién sobreviviría mejor en una isla desierta?" class="w-full bg-zinc-800/70 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/70 placeholder-zinc-600 transition" /><span id="manual-question-error" class="hidden text-red-400 text-xs mt-2 text-left block"></span><button id="manual-question-button" class="btn-brand mt-3 w-full py-3 rounded-xl font-bold text-sm">Usar esta pregunta</button></span>`;
    byId('manual-question-input')?.addEventListener('keydown', event => { if (event.key === 'Enter') App.setCustomQuestion(); });
    byId('manual-question-button')?.addEventListener('click', App.setCustomQuestion);
    byId('manual-question-input')?.focus();
  } else {
    qEl.textContent = `Esperando a que ${inventor?.username ?? 'el jugador elegido'} escriba la pregunta...`;
  }
}

function renderScoresHeader() {
  const header = byId('game-scores-header');
  if (!header) return;
  if (!state.settings.points) return void (header.innerHTML = '');
  const shownPlayers = votingPlayers();
  header.innerHTML = shownPlayers.map(p => `<div class="flex flex-col items-center min-w-0 px-1"><span class="text-[10px] text-zinc-500 truncate max-w-[3.5rem]">${escapeHTML(p.username.slice(0, 6))}</span><span class="font-black text-brand-light text-sm leading-tight">${state.scores[p.id] || 0}</span></div>`).join('');
}

function renderVoteGrid() {
  const grid = byId('vote-grid');
  if (!grid) return;
  if (!state.currentQuestion) return void (grid.innerHTML = '<p class="col-span-2 text-center text-zinc-600 text-sm py-10">La votación se activará cuando haya una pregunta.</p>');
  if (state.timerExpired) return void (grid.innerHTML = '<p class="col-span-2 text-center text-zinc-600 text-sm py-10">Tiempo agotado. Esperando resultados...</p>');
  if (!currentUserCanVote()) return void (grid.innerHTML = '<p class="col-span-2 text-center text-zinc-500 text-sm py-10">Como admin no participas en esta partida: no puedes votar ni recibir votos.</p>');
  const participants = votingPlayers();
  const votable = participants.filter(p => p.id !== sid());
  grid.innerHTML = votable.length ? votable.map((p, i) => `<button class="vote-card rounded-2xl p-5 flex flex-col items-center gap-3 pop" data-id="${escapeHTML(p.id)}" style="animation-delay:${i * .06}s"><div class="w-14 h-14 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-2xl shadow-lg">${initials(p.username)}</div><span class="font-bold text-sm text-zinc-200">${escapeHTML(p.username)}</span></button>`).join('') : '<p class="col-span-2 text-center text-zinc-600 text-sm py-10">Necesitas más jugadores participantes para votar</p>';
  grid.querySelectorAll('.vote-card').forEach(button => button.addEventListener('click', () => App.castVote(button.dataset.id)));
}


function clearRevealAnimationTimers() {
  state.revealAnimationTimers.forEach(timer => clearTimeout(timer));
  state.revealAnimationTimers = [];
}

function scheduleRevealStep(delay, callback) {
  const timer = setTimeout(() => {
    state.revealAnimationTimers = state.revealAnimationTimers.filter(item => item !== timer);
    callback();
  }, delay);
  state.revealAnimationTimers.push(timer);
  return timer;
}

function renderEpicVoterList(voters = []) {
  if (state.settings.privateVote || !voters.length) return '';
  return `<div class="mt-4 rounded-2xl bg-zinc-950/55 border border-white/5 p-3"><p class="text-[10px] uppercase tracking-[0.28em] text-zinc-500 font-black mb-2">Votado por</p><div class="flex flex-wrap gap-2">${voters.map((v, i) => `<span class="bg-brand/15 border border-brand/20 text-brand-light px-3 py-1 rounded-full text-xs font-bold pop" style="animation-delay:${i * .08}s">${escapeHTML(v)}</span>`).join('')}</div></div>`;
}

function renderEpicResultCard(player, voters = [], index = 0, maxVotes = 1, isWinner = false) {
  const voteTotal = voters.length;
  const showVoteCounts = shouldShowVoteCounts();
  const barPct = Math.round((voteTotal / maxVotes) * 100);
  const pts = state.scores[player.id] || 0;
  const name = playerLabel(player);
  const medal = index === 0 ? '👑' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `${index + 1}.`));
  const countHtml = showVoteCounts
    ? `<p class="text-xs text-zinc-500">${voteTotal} voto${voteTotal !== 1 ? 's' : ''}</p>`
    : `<p class="text-xs text-zinc-500">Votos ocultos</p>`;
  const barHtml = showVoteCounts
    ? `<div class="h-2 bg-zinc-900 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-brand via-violet-400 to-amber-300 rounded-full bar-grow" style="width:${barPct}%"></div></div>`
    : '';
  return `<div class="epic-result-card glass rounded-2xl p-4 ${isWinner ? 'border border-brand/40 shadow-xl shadow-brand/10' : ''}" style="animation-delay:${Math.min(index, 6) * .05}s"><div class="flex items-center gap-3 ${showVoteCounts ? 'mb-3' : ''}"><span class="text-2xl flex-shrink-0">${medal}</span><div class="w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(player.username)} flex items-center justify-center font-black shadow-lg flex-shrink-0">${initials(player.username)}</div><div class="flex-1 min-w-0"><p class="font-black truncate ${isWinner ? 'text-brand-light' : 'text-zinc-100'}">${escapeHTML(name)}</p>${countHtml}</div>${state.settings.points ? `<span class="font-black text-gradient text-lg flex-shrink-0">${pts}pts</span>` : ''}</div>${barHtml}${renderEpicVoterList(voters)}</div>`;
}


function renderVoteStatus() {
  const el = byId('votes-status');
  if (!el) return;
  const voted = new Set(validVoteEntries().map(([voterId]) => String(voterId))).size;
  const total = state.currentQuestion ? votingPlayers().length : 0;
  if (!state.currentQuestion) el.textContent = 'Esperando pregunta para iniciar la votación';
  else if (total < 2) el.textContent = 'No hay suficientes jugadores participantes para votar';
  else if (state.timerExpired) el.textContent = `Tiempo agotado · ${voted} de ${total} votaron`;
  else el.textContent = `${voted} de ${total} han votado`;
}

function _showReveal(roundNum, question) {
  stopTimer();
  clearRevealAnimationTimers();
  byId('reveal-round').textContent = roundNum;
  const qEl = byId('reveal-question');
  qEl.textContent = question || '';
  qEl.classList.toggle('hidden', !question);

  const participants = votingPlayers();
  const voteCounts = {};
  participants.forEach(p => { voteCounts[p.id] = []; });
  validVoteEntries().forEach(([voterId, votedId]) => {
    const key = String(votedId);
    if (!voteCounts[key]) return;
    const voter = participants.find(p => p.id === String(voterId));
    voteCounts[key].push(playerLabel(voter));
  });

  const naturalSorted = [...participants].sort((a, b) => (voteCounts[b.id]?.length || 0) - (voteCounts[a.id]?.length || 0));
  const maxVotes = Math.max(...naturalSorted.map(p => voteCounts[p.id]?.length || 0), 1);
  const maxRealVotes = Math.max(...naturalSorted.map(p => voteCounts[p.id]?.length || 0), 0);
  const naturalWinnerIds = maxRealVotes > 0 ? naturalSorted.filter(p => (voteCounts[p.id]?.length || 0) === maxRealVotes).map(p => p.id) : [];
  const winnerIds = hideTies() && state.roundWinnerIds?.length ? state.roundWinnerIds : naturalWinnerIds;
  const sorted = hideTies() && winnerIds.length
    ? [...naturalSorted].sort((a, b) => (winnerIds.includes(b.id) ? 1 : 0) - (winnerIds.includes(a.id) ? 1 : 0) || (voteCounts[b.id]?.length || 0) - (voteCounts[a.id]?.length || 0))
    : naturalSorted;
  const winner = sorted.find(p => winnerIds.includes(p.id)) || sorted[0];
  const winnerVoters = winner ? (voteCounts[winner.id] || []) : [];
  const visibleTie = !hideTies() && naturalWinnerIds.length > 1;
  const winnerNames = visibleTie
    ? naturalWinnerIds.map(id => participants.find(player => player.id === id)).filter(Boolean).map(playerLabel).join(' · ')
    : (winner ? playerLabel(winner) : '—');
  const winnerTitle = visibleTie ? 'HAY EMPATE ENTRE' : 'EL MÁS VOTADO ES';
  const hasVotes = winnerVoters.length > 0;
  const showAllResults = state.settings.showAllResults !== false;
  const showVoteCounts = shouldShowVoteCounts();
  const redGreenMode = !showAllResults && state.settings.redGreenMode === true;
  const currentPlayerIsWinner = redGreenMode && hasVotes && winnerIds.includes(sid());
  const redGreenClass = redGreenMode ? (currentPlayerIsWinner ? 'red-green-red' : 'red-green-green') : '';
  const redGreenBadge = redGreenMode
    ? `<div class="red-green-badge ${currentPlayerIsWinner ? 'bg-red-500/20 border-red-300/30 text-red-100' : 'bg-emerald-500/20 border-emerald-300/30 text-emerald-100'} border rounded-2xl px-4 py-3"><p class="text-xs font-black uppercase tracking-[0.28em]">${currentPlayerIsWinner ? 'Pantalla roja' : 'Pantalla verde'}</p><p class="text-sm font-bold mt-1">${currentPlayerIsWinner ? 'Eres el más votado de esta ronda' : 'No eres el más votado'}</p></div>`
    : '';
  const tieChaosHtml = hideTies() && naturalWinnerIds.length > 1 && hasVotes ? '<p class="text-xs text-amber-200/80 font-black uppercase tracking-[0.22em] mt-1">Empate oculto · elegido al azar</p>' : '';
  const winnerCountHtml = showVoteCounts && hasVotes ? `<p class="text-brand-light font-black text-lg">${winnerVoters.length} voto${winnerVoters.length !== 1 ? 's' : ''}</p>${tieChaosHtml}` : tieChaosHtml;
  const resultsEl = byId('reveal-results');
  const adminNext = byId('admin-next');
  const guestWait = byId('guest-next-wait');

  adminNext?.classList.add('hidden');
  guestWait?.classList.add('hidden');
  if (state.isHost) byId('next-round-btn').textContent = 'Siguiente pregunta →';
  byId('admin-force-end')?.classList.toggle('hidden', !state.isHost);

  resultsEl.innerHTML = `<div class="epic-reveal-stage ${redGreenClass} glass rounded-[2rem] p-5 sm:p-7 text-center border border-brand/20 shadow-2xl shadow-brand/10"><div class="epic-reveal-content space-y-5"><p class="text-xs sm:text-sm text-zinc-500 font-black uppercase tracking-[0.32em]">Veredicto de la ronda</p><div id="epic-reveal-line" class="min-h-[9.5rem] flex flex-col items-center justify-center gap-4"><p class="text-2xl sm:text-3xl font-black text-zinc-100 uppercase leading-tight">${winnerTitle}</p><div class="epic-dots flex gap-2 text-brand-light text-4xl font-black" aria-label="Pausa dramática"><span>•</span><span>•</span><span>•</span></div></div>${redGreenBadge}<div id="epic-winner-voters" class="hidden"></div></div></div><div id="epic-other-results" class="space-y-3 mt-4"></div>`;

  launchConfetti();
  showScreen('reveal');
  persistGameState({ status: 'playing' });

  const showRevealActions = () => {
    byId('admin-next')?.classList.toggle('hidden', !state.isHost);
    byId('guest-next-wait')?.classList.toggle('hidden', state.isHost);
  };

  scheduleRevealStep(1350, () => {
    const line = byId('epic-reveal-line');
    if (!line) return;
    if (!hasVotes) {
      line.innerHTML = `<p class="text-xs text-zinc-500 font-black uppercase tracking-[0.32em]">Resultado</p><p class="epic-winner-name text-4xl sm:text-5xl font-black text-gradient uppercase leading-tight">NADIE HA VOTADO</p><p class="text-sm text-zinc-500 max-w-xs mx-auto">La ronda queda sin ganador claro.</p>`;
      return;
    }
    line.innerHTML = `<div class="epic-crown text-6xl">${visibleTie ? '⚔️' : '👑'}</div><p class="text-xs text-zinc-500 font-black uppercase tracking-[0.32em]">${winnerTitle}</p><h2 class="epic-winner-name text-5xl sm:text-6xl font-black text-gradient uppercase leading-none break-words">${escapeHTML(winnerNames)}</h2>${winnerCountHtml}`;
  });

  if (!state.settings.privateVote && hasVotes) {
    scheduleRevealStep(2700, () => {
      const voterBox = byId('epic-winner-voters');
      if (!voterBox) return;
      voterBox.classList.remove('hidden');
      voterBox.innerHTML = `<div class="glass rounded-2xl p-4 border border-amber-300/20 bg-amber-300/5"><p class="text-xs text-amber-200/80 font-black uppercase tracking-[0.28em] mb-3">Votado por</p><div class="flex flex-wrap justify-center gap-2">${winnerVoters.map((v, i) => `<span class="pop bg-amber-300/15 border border-amber-200/20 text-amber-100 px-3 py-1.5 rounded-full text-sm font-black" style="animation-delay:${i * .1}s">${escapeHTML(v)}</span>`).join('')}</div></div>`;
    });
  }

  const restDelay = !state.settings.privateVote && hasVotes ? 4100 : 2800;
  if (!showAllResults) {
    scheduleRevealStep(restDelay, showRevealActions);
    return;
  }

  sorted.forEach((player, index) => {
    const delay = restDelay + (index * 650);
    scheduleRevealStep(delay, () => {
      const otherResults = byId('epic-other-results');
      if (!otherResults) return;
      const voters = voteCounts[player.id] || [];
      otherResults.insertAdjacentHTML('beforeend', renderEpicResultCard(player, voters, index, maxVotes, index === 0 && hasVotes));
      if (index === sorted.length - 1) {
        scheduleRevealStep(450, showRevealActions);
      }
    });
  });
}


function _showFinal() {
  stopTimer();
  clearRevealAnimationTimers();
  launchConfetti();
  const sorted = [...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));
  byId('winner-name').textContent = sorted[0] ? playerLabel(sorted[0]) : '—';
  byId('final-scores').innerHTML = sorted.map((p, i) => `<div class="flex items-center gap-3 glass rounded-2xl px-4 py-3.5 pop" style="animation-delay:${i * .08}s"><span class="text-2xl flex-shrink-0">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span><div class="w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-sm shadow-md flex-shrink-0">${initials(p.username)}</div><span class="flex-1 font-semibold truncate">${escapeHTML(playerLabel(p))}</span><span class="font-black text-gradient text-lg">${state.scores[p.id] || 0}pts</span></div>`).join('');
  byId('admin-new-game').classList.toggle('hidden', !state.isHost);
  byId('guest-end-wait').classList.toggle('hidden', state.isHost);
  persistGameState({ status: 'finished' });
  showScreen('final');
}

App.init();
