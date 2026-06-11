const api = new window.GameAPI();
const GAME_ID = 12;
const SOCKET_RECONNECT_MS = 1800;
const SOCKET_MAX_RETRIES = 6;
const API_POLL_MS = 1500;
const SESSION_KEY = 'democrazy_active_room';

const state = {
  user: null,
  room: null,
  roomStatus: 'waiting',
  hostId: null,
  isHost: false,
  players: [],
  settings: {
    rounds: 5,
    points: true,
    privateVote: false,
    useQuestions: true,
    questionVisible: true,
    roundTimeLimit: 30,
  },
  currentRound: 0,
  currentQuestion: null,
  currentInventorId: null,
  votes: {},
  scores: {},
  hasVoted: false,
  socket: null,
  socketReady: false,
  socketRoomCode: null,
  socketReconnectAttempts: 0,
  socketReconnectTimer: null,
  socketManualClose: false,
  pollTimer: null,
  pendingMessages: [],
  syncTimer: null,
  timerInterval: null,
  timerStartedAt: null,
  timerEndsAt: null,
  timerRemaining: 0,
  timerExpired: false,
  lastEventId: null,
  appliedEventIds: new Set(),
};

const sid = () => String(state.user?.id ?? '');
const questionBank = () => window.questions ?? [];

const SCREEN_ROUTES = {
  login: '#/',
  lobby: '#/lobby',
  waiting: '#/sala',
  game: '#/juego',
  reveal: '#/resultados',
  final: '#/final',
};

function byId(id) {
  return document.getElementById(id);
}

function activeScreen() {
  return document.querySelector('.screen.active')?.id?.replace('screen-', '') ?? '';
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
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

  if (screen === 'lobby' && !state.user) {
    showScreen('login', true);
    return;
  }
  if (['waiting', 'game', 'reveal', 'final'].includes(screen) && !state.room) {
    showScreen(state.user ? 'lobby' : 'login', true);
    return;
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  byId(`screen-${screen}`)?.classList.add('active');
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
  toast._timer = setTimeout(() => {
    el.style.opacity = '0';
  }, 2800);
}

function renderQR(url) {
  const img = document.createElement('img');
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  img.className = 'rounded-lg';
  img.width = img.height = 180;
  const c = byId('qr-container');
  if (!c) return;
  c.innerHTML = '';
  c.appendChild(img);
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
    p.style.cssText = `
      left:${Math.random() * 100}vw;
      width:${5 + Math.random() * 9}px;
      height:${5 + Math.random() * 9}px;
      background:${colors[i % colors.length]};
      border-radius:${isCircle ? '50%' : '2px'};
      animation-duration:${2.2 + Math.random() * 2.8}s;
      animation-delay:${Math.random() * 1.2}s;
    `;
    container.appendChild(p);
  }
  setTimeout(() => {
    container.innerHTML = '';
  }, 6000);
}

function avatarGradient(username) {
  const palettes = [
    'from-violet-500 to-purple-700',
    'from-blue-500 to-indigo-700',
    'from-emerald-500 to-teal-700',
    'from-rose-500 to-pink-700',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-sky-700',
    'from-fuchsia-500 to-violet-700',
  ];
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
  if (state.scores[p.id] == null) state.scores[p.id] = 0;
  return p;
}

function saveActiveSession() {
  if (!state.user || !state.room) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    roomCode: state.room.code,
    roomId: state.room.id,
    hostId: state.hostId,
    isHost: state.isHost,
    userId: sid(),
    savedAt: Date.now(),
  }));
}

function clearActiveSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getSavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!saved?.roomCode || saved.userId !== sid()) return null;
    return saved;
  } catch {
    clearActiveSession();
    return null;
  }
}

function boolSetting(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeSettings(settings = {}) {
  return {
    rounds: Math.max(1, Number(settings.rounds ?? 5)),
    points: boolSetting(settings.points, true),
    privateVote: boolSetting(settings.privateVote, false),
    useQuestions: boolSetting(settings.useQuestions, true),
    questionVisible: boolSetting(settings.questionVisible, true),
    roundTimeLimit: Math.max(0, Number(settings.roundTimeLimit ?? 30)),
  };
}

function normalizeGameState(raw = {}) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

function extractRoomCode(roomData, fallback = '') {
  return String(roomData.room_code ?? roomData.code ?? fallback ?? '').toUpperCase();
}

function extractRoomId(roomData) {
  return String(roomData.room_id ?? roomData.id ?? '');
}

function extractPlayers(roomData = {}, gameState = {}) {
  const rawPlayers = gameState.players ?? roomData.players ?? roomData.users ?? roomData.members ?? [];
  return rawPlayers.map(normPlayer);
}

function setHost(hostId) {
  state.hostId = hostId ? String(hostId) : state.hostId;
  state.isHost = Boolean(state.hostId && state.hostId === sid());
}

function buildGameState(lastEvent = null, overrides = {}) {
  return {
    status: overrides.status ?? state.roomStatus,
    hostId: state.hostId,
    players: state.players,
    settings: state.settings,
    currentRound: state.currentRound,
    currentQuestion: state.currentQuestion,
    currentInventorId: state.currentInventorId,
    votes: state.votes,
    scores: state.scores,
    timerStartedAt: state.timerStartedAt,
    timerEndsAt: state.timerEndsAt,
    timerExpired: state.timerExpired,
    lastEvent: lastEvent ?? null,
    updatedAt: Date.now(),
  };
}

async function persistRoomState(lastEvent = null, { status, roomSettings } = {}) {
  if (!state.room?.code) return;
  const nextStatus = status ?? state.roomStatus;
  const gameState = buildGameState(lastEvent, { status: nextStatus });
  try {
    await api.updateRoomState(state.room.code, {
      gameState,
      status: nextStatus,
      roomSettings: roomSettings ?? state.settings,
    });
  } catch (error) {
    console.warn('No se pudo persistir el estado de la sala', error);
  }
}

function scheduleStateSync() {
  clearTimeout(state.syncTimer);
  state.syncTimer = setTimeout(() => persistRoomState(), 250);
}

function makeEvent(data) {
  return {
    ...data,
    eventId: data.eventId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}-${sid()}`,
    fromId: data.fromId ?? sid(),
    createdAt: data.createdAt ?? Date.now(),
  };
}

function injectDynamicUI() {
  if (!byId('cfg-round-time')) {
    const roundsCard = byId('cfg-rounds')?.closest('.glass');
    if (roundsCard) {
      roundsCard.insertAdjacentHTML('afterend', `
        <div id="round-time-card" class="mx-4 mb-2 glass rounded-2xl">
          <div class="flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p class="text-sm font-semibold">Tiempo por ronda</p>
              <p class="text-xs text-zinc-500 mt-0.5">Evita que la partida se quede bloqueada</p>
            </div>
            <select id="cfg-round-time" class="bg-zinc-800/70 border border-zinc-700/60 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/70">
              <option value="0">Sin límite</option>
              <option value="15">15 s</option>
              <option value="30" selected>30 s</option>
              <option value="45">45 s</option>
              <option value="60">60 s</option>
            </select>
          </div>
        </div>
      `);
    }
  }

  if (!byId('round-timer-box')) {
    const progress = byId('round-progress')?.parentElement;
    if (progress) {
      progress.insertAdjacentHTML('afterend', `
        <div id="round-timer-box" class="hidden px-5 py-2 border-b border-white/5 bg-zinc-950/60">
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="text-zinc-500 font-bold uppercase tracking-wider">Tiempo</span>
            <span id="round-timer-label" class="font-black text-brand-light">—</span>
          </div>
          <div class="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div id="round-timer-bar" class="h-full bg-gradient-to-r from-brand to-violet-400 transition-all duration-300" style="width:100%"></div>
          </div>
        </div>
      `);
    }
  }

  if (!document.getElementById('democrazy-enhanced-style')) {
    const style = document.createElement('style');
    style.id = 'democrazy-enhanced-style';
    style.textContent = `
      @keyframes votePulse {
        0% { transform: scale(1); }
        45% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      @keyframes voteRipple {
        from { opacity: .45; transform: translate(-50%, -50%) scale(.35); }
        to { opacity: 0; transform: translate(-50%, -50%) scale(2.7); }
      }
      .vote-card.vote-pop { animation: votePulse .34s cubic-bezier(.34,1.4,.64,1); }
      .vote-ripple {
        position:absolute;
        left:50%;
        top:50%;
        width:84px;
        height:84px;
        border-radius:999px;
        background:rgba(124,58,237,.65);
        pointer-events:none;
        animation:voteRipple .55s ease-out forwards;
      }
      .timer-danger #round-timer-label { color:#f87171; }
      .timer-danger #round-timer-bar { background:linear-gradient(90deg,#ef4444,#f97316); }
      button:disabled { opacity:.55; cursor:not-allowed; box-shadow:none !important; }
    `;
    document.head.appendChild(style);
  }
}

let socketConnectorPromise = null;
async function loadSocketConnector() {
  if (!socketConnectorPromise) {
    socketConnectorPromise = import('https://esm.sh/itty-sockets')
      .then(mod => mod.connect)
      .catch(error => {
        console.warn('No se pudo cargar itty-sockets. Se usará fallback por API.', error);
        return null;
      });
  }
  return socketConnectorPromise;
}

function stopPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

function startPolling(roomCode) {
  if (!roomCode) return false;
  stopPolling();
  state.socketReady = false;
  state.socketRoomCode = roomCode;
  pollRoom(roomCode);
  state.pollTimer = setInterval(() => pollRoom(roomCode), API_POLL_MS);
  return true;
}

function closeSocket(manual = true) {
  state.socketManualClose = manual;
  clearTimeout(state.socketReconnectTimer);
  state.socketReconnectTimer = null;
  stopPolling();
  state.socketReady = false;
  try { state.socket?.close?.(); } catch {}
  state.socket = null;
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
    const ready = startPolling(roomCode);
    if (ready) toast('Conexión de respaldo por API activada', '📡');
    return ready;
  }

  try {
    stopPolling();
    state.socket = connect(`democrazy-${roomCode}`);
    state.socketReady = true;
    state.socketReconnectAttempts = 0;

    state.socket.on?.('message', ({ message }) => {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        handleSocketMessage(data);
      } catch (e) {
        console.warn('socket parse error', e);
      }
    });

    const scheduleReconnect = () => {
      state.socketReady = false;
      if (state.socketManualClose || !state.socketRoomCode) return;
      if (state.socketReconnectAttempts >= SOCKET_MAX_RETRIES) {
        startPolling(state.socketRoomCode);
        toast('Conexión de respaldo por API activada', '📡');
        return;
      }
      state.socketReconnectAttempts += 1;
      clearTimeout(state.socketReconnectTimer);
      state.socketReconnectTimer = setTimeout(() => {
        connectSocket(state.socketRoomCode, { reconnect: true });
      }, SOCKET_RECONNECT_MS * state.socketReconnectAttempts);
    };

    state.socket.on?.('close', scheduleReconnect);
    state.socket.on?.('error', scheduleReconnect);
    flushPendingMessages();
    return true;
  } catch (error) {
    console.warn('socket connect error', error);
    state.socketReady = false;
    startPolling(roomCode);
    return true;
  }
}

function flushPendingMessages() {
  const queued = state.pendingMessages.splice(0);
  queued.forEach(event => sendSocketEvent(event));
}

function sendSocketEvent(event) {
  if (state.socketReady && state.socket?.send) {
    state.socket.send(JSON.stringify(event));
    return true;
  }
  return false;
}

function emit(data, { persist = true, status, roomSettings } = {}) {
  if (!data) return null;
  const event = makeEvent(data);
  state.appliedEventIds.add(event.eventId);
  state.lastEventId = event.eventId;

  if (!sendSocketEvent(event)) {
    state.pendingMessages.push(event);
  }

  if (persist) {
    persistRoomState(event, { status, roomSettings });
  }

  return event;
}

async function pollRoom(roomCode = state.room?.code) {
  if (!roomCode) return;
  try {
    const roomData = await api.getRoom(roomCode);
    applyRoomSnapshot(roomData, { render: true });
  } catch (error) {
    console.warn('No se pudo refrescar la sala', error);
  }
}

function applyRoomSnapshot(roomData = {}, { render = false } = {}) {
  const gameState = normalizeGameState(roomData.game_state ?? roomData.gameState ?? {});
  const roomCode = extractRoomCode(roomData, state.room?.code);
  if (roomCode) state.room = { code: roomCode, id: extractRoomId(roomData) || state.room?.id || '' };

  setHost(gameState.hostId ?? roomData.host_id ?? roomData.hostId ?? state.hostId ?? getSavedSession()?.hostId);
  state.roomStatus = gameState.status ?? roomData.status ?? state.roomStatus;
  state.settings = normalizeSettings(gameState.settings ?? roomData.room_settings ?? roomData.settings ?? state.settings);
  state.players = extractPlayers(roomData, gameState);
  upsertPlayer(currentPlayer());

  state.currentRound = Number(gameState.currentRound ?? state.currentRound ?? 0);
  state.currentQuestion = gameState.currentQuestion !== undefined ? gameState.currentQuestion : state.currentQuestion;
  state.currentInventorId = gameState.currentInventorId !== undefined && gameState.currentInventorId !== null
    ? String(gameState.currentInventorId)
    : state.currentInventorId;
  state.votes = gameState.votes ?? state.votes ?? {};
  state.scores = gameState.scores ?? state.scores ?? {};
  state.timerStartedAt = gameState.timerStartedAt ?? state.timerStartedAt;
  state.timerEndsAt = gameState.timerEndsAt ?? state.timerEndsAt;
  state.timerExpired = Boolean(gameState.timerExpired ?? state.timerExpired);

  const lastEvent = gameState.lastEvent;
  if (lastEvent?.eventId && !state.appliedEventIds.has(lastEvent.eventId)) {
    handleSocketMessage(lastEvent);
  } else if (render) {
    renderCurrentStatus();
  }

  saveActiveSession();
}

function renderCurrentStatus() {
  renderWaitingPlayers();
  renderScoresHeader();
  renderVoteGrid();
  renderVoteStatus();

  const screen = activeScreen();
  if (screen === 'game') syncTimerFromState();
}

function handleSocketMessage(data = {}) {
  if (!data.type) return;
  if (data.eventId) {
    if (state.appliedEventIds.has(data.eventId)) return;
    state.appliedEventIds.add(data.eventId);
    state.lastEventId = data.eventId;
  }

  switch (data.type) {
    case 'player_joined': {
      const p = upsertPlayer(data.player);
      renderWaitingPlayers();
      if (state.isHost && p) {
        emit({ type: 'room_update', players: state.players, hostId: state.hostId });
        scheduleStateSync();
      }
      break;
    }
    case 'room_update':
      state.players = (data.players ?? []).map(normPlayer);
      if (data.hostId) setHost(data.hostId);
      renderWaitingPlayers();
      renderVoteStatus();
      break;
    case 'player_left':
      state.players = state.players.filter(p => p.id !== String(data.playerId));
      delete state.votes[String(data.playerId)];
      renderWaitingPlayers();
      renderVoteStatus();
      if (state.isHost) scheduleStateSync();
      break;
    case 'game_started':
      state.roomStatus = 'playing';
      state.settings = normalizeSettings(data.settings);
      state.players = (data.players ?? []).map(normPlayer);
      if (data.hostId) setHost(data.hostId);
      state.scores = {};
      state.players.forEach(p => { state.scores[p.id] = 0; });
      saveActiveSession();
      _startRound(data.firstRound);
      break;
    case 'question_set':
      if (data.round && Number(data.round) !== state.currentRound) return;
      state.currentQuestion = String(data.question || '');
      state.currentInventorId = data.inventorId ? String(data.inventorId) : state.currentInventorId;
      state.timerExpired = false;
      renderQuestionArea();
      renderVoteGrid();
      renderVoteStatus();
      if (state.isHost) maybeStartRoundTimer();
      break;
    case 'timer_sync':
      if (!state.isHost && Number(data.round) === state.currentRound) {
        const remaining = Number(data.remaining ?? 0);
        if (data.timerEndsAt) state.timerEndsAt = Number(data.timerEndsAt);
        startTimer(remaining, { fromHost: true });
      }
      break;
    case 'round_timeout':
      if (Number(data.round) === state.currentRound) {
        state.timerExpired = true;
        stopTimer(false);
        renderTimer(0);
        renderVoteStatus();
        if (!state.isHost) toast('Tiempo agotado. Esperando resultados...', '⏱️');
      }
      break;
    case 'vote_cast':
      state.votes[String(data.voterId)] = String(data.votedId);
      renderVoteStatus();
      if (state.isHost) {
        scheduleStateSync();
        if (Object.keys(state.votes).length >= state.players.length) _doReveal();
      }
      break;
    case 'round_reveal':
      stopTimer();
      state.roomStatus = 'reveal';
      state.votes = data.votes ?? {};
      state.scores = data.scores ?? {};
      _showReveal(Number(data.round), data.question);
      break;
    case 'next_round':
      state.roomStatus = 'playing';
      _startRound(data.round);
      break;
    case 'game_over':
      stopTimer();
      state.roomStatus = 'final';
      state.scores = data.scores ?? {};
      _showFinal();
      break;
    case 'new_room_created':
      stopTimer();
      state.roomStatus = 'waiting';
      state.room = data.room;
      state.settings = normalizeSettings(data.settings ?? state.settings);
      state.players = (data.players ?? state.players).map(normPlayer);
      setHost(data.hostId ?? state.hostId);
      state.votes = {};
      state.scores = {};
      state.currentRound = 0;
      state.currentQuestion = null;
      state.currentInventorId = null;
      state.hasVoted = false;
      connectSocket(state.room.code).then(() => {
        emit({ type: 'player_joined', player: currentPlayer() });
      });
      saveActiveSession();
      App._enterWaiting();
      break;
  }
}

window.App = {
  init() {
    injectDynamicUI();

    const saved = localStorage.getItem('democrazy_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        u.id = String(u.id);
        state.user = u;
        byId('existing-avatar').textContent = u.username[0].toUpperCase();
        byId('existing-name').textContent = u.username;
        byId('existing-user-card').classList.remove('hidden');
        byId('new-user-toggle').classList.remove('hidden');
        byId('new-user-form').classList.add('hidden');
      } catch {
        localStorage.removeItem('democrazy_user');
      }
    }

    const code = new URLSearchParams(location.search).get('sala');
    if (code) sessionStorage.setItem('pending_room', code.toUpperCase());
    history.replaceState({ screen: 'login' }, '', '#/');

    if (state.user && getSavedSession()) {
      setTimeout(() => App._enterLobby(), 0);
    }
  },

  useExistingUser() { App._enterLobby(); },

  showNewUserForm() {
    byId('new-user-form').classList.remove('hidden');
    byId('new-user-toggle').classList.add('hidden');
    byId('existing-user-card').classList.add('hidden');
    byId('input-username').focus();
  },

  async createUser() {
    const username = byId('input-username').value.trim();
    const errEl = byId('login-error');
    errEl.classList.add('hidden');
    if (!username || username.length < 2) {
      errEl.textContent = 'El nombre debe tener al menos 2 caracteres.';
      errEl.classList.remove('hidden');
      byId('input-username').classList.add('shake');
      setTimeout(() => byId('input-username').classList.remove('shake'), 400);
      return;
    }
    try {
      const res = await api.createUser(username, 'democrazy', '');
      const user = { id: String(res.user_id ?? res.id), username };
      state.user = user;
      localStorage.setItem('democrazy_user', JSON.stringify(user));
      App._enterLobby();
    } catch (e) {
      errEl.textContent = e.message || 'Error al crear usuario.';
      errEl.classList.remove('hidden');
    }
  },

  switchUser() {
    clearActiveSession();
    closeSocket(true);
    localStorage.removeItem('democrazy_user');
    state.user = null;
    byId('existing-user-card').classList.add('hidden');
    byId('new-user-toggle').classList.add('hidden');
    byId('new-user-form').classList.remove('hidden');
    showScreen('login');
  },

  async _enterLobby() {
    byId('lobby-username').textContent = state.user.username;
    showScreen('lobby');

    const pending = sessionStorage.getItem('pending_room');
    if (pending) {
      sessionStorage.removeItem('pending_room');
      byId('input-room-code').value = pending;
      await App.joinRoom();
      return;
    }

    const savedRoom = getSavedSession();
    if (savedRoom) {
      await App.reconnectRoom(savedRoom.roomCode);
    }
  },

  async reconnectRoom(code) {
    try {
      toast('Reconectando a la sala...', '🔄');
      const roomData = await api.getRoom(code);
      applyRoomSnapshot(roomData, { render: false });
      await connectSocket(state.room.code);
      emit({ type: 'player_joined', player: currentPlayer() });
      restoreScreenFromState();
      toast('Has vuelto a la sala', '✅');
    } catch (error) {
      clearActiveSession();
      console.warn('No se pudo reconectar a la sala', error);
    }
  },

  async createRoom() {
    const btn = byId('screen-lobby').querySelector('.btn-brand');
    btn.textContent = 'Creando...';
    btn.disabled = true;
    try {
      const settings = normalizeSettings({
        rounds: 5,
        points: true,
        privateVote: false,
        useQuestions: true,
        questionVisible: true,
        roundTimeLimit: 30,
      });
      const initialState = {
        status: 'waiting',
        hostId: sid(),
        players: [currentPlayer()],
        settings,
        currentRound: 0,
        votes: {},
        scores: {},
      };
      const res = await api.createRoom(GAME_ID, sid(), settings, initialState);
      state.room = { code: String(res.room_code ?? res.code).toUpperCase(), id: String(res.room_id ?? res.id ?? '') };
      state.roomStatus = 'waiting';
      state.hostId = sid();
      state.isHost = true;
      state.players = [currentPlayer()];
      state.settings = settings;
      state.votes = {};
      state.scores = { [sid()]: 0 };
      await connectSocket(state.room.code);
      await persistRoomState(null, { status: 'waiting', roomSettings: settings });
      saveActiveSession();
      App._enterWaiting();
    } catch (e) {
      toast('Error al crear sala: ' + (e.message || 'desconocido'), '⚠️');
      console.error(e);
    } finally {
      btn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg> Crear sala';
      btn.disabled = false;
    }
  },

  async joinRoom() {
    const code = byId('input-room-code').value.trim().toUpperCase();
    const errEl = byId('join-error');
    errEl.classList.add('hidden');
    if (code.length < 4) return;
    try {
      await api.joinRoom(code, sid());
      const roomData = await api.getRoom(code);
      applyRoomSnapshot(roomData, { render: false });
      state.isHost = state.hostId === sid();
      upsertPlayer(currentPlayer());
      await connectSocket(code);
      emit({ type: 'player_joined', player: currentPlayer() });
      saveActiveSession();
      App._enterWaiting();
    } catch (e) {
      errEl.textContent = e.message || 'Sala no encontrada.';
      errEl.classList.remove('hidden');
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
      byId('cfg-rounds').value = s.rounds;
      byId('cfg-rounds-display').textContent = s.rounds;
      byId('cfg-points').checked = s.points;
      byId('cfg-private').checked = s.privateVote;
      byId('cfg-questions').checked = s.useQuestions;
      byId('cfg-visible').checked = s.questionVisible ?? true;
      if (byId('cfg-round-time')) byId('cfg-round-time').value = String(s.roundTimeLimit ?? 30);
      App.updateVisibleHint();
    }
    renderWaitingPlayers();
    const shareUrl = `${location.origin}${location.pathname}?sala=${state.room.code}`;
    renderQR(shareUrl);
    saveActiveSession();
    showScreen('waiting');
    history.replaceState({ screen: 'waiting' }, '', `#/sala/${state.room.code}`);
  },

  toggleQR() { byId('qr-panel').classList.toggle('hidden'); },

  async shareRoom() {
    const url = `${location.origin}${location.pathname}?sala=${state.room.code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Democrazy', text: `Únete con código: ${state.room.code}`, url }); }
      catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado', '📋');
    }
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
    const checked = byId('cfg-visible').checked;
    byId('cfg-visible-hint').textContent = checked
      ? 'Todos ven la pregunta'
      : 'Solo el admin ve la pregunta';
  },

  async startGame() {
    if (!state.isHost) return;
    if (state.players.length < 2) {
      toast('Necesitas al menos 2 jugadores para empezar', '👥');
      renderStartButton();
      return;
    }

    const settings = normalizeSettings({
      rounds: parseInt(byId('cfg-rounds').value) || 5,
      points: byId('cfg-points').checked,
      privateVote: byId('cfg-private').checked,
      useQuestions: byId('cfg-questions').checked,
      questionVisible: byId('cfg-visible').checked,
      roundTimeLimit: parseInt(byId('cfg-round-time')?.value ?? '30', 10) || 0,
    });
    state.settings = settings;
    state.roomStatus = 'playing';
    state.scores = {};
    state.players.forEach(p => { state.scores[p.id] = 0; });
    state.currentRound = 0;
    const firstRound = _buildRound(1);
    const event = emit({ type: 'game_started', settings, players: state.players, hostId: state.hostId, firstRound }, {
      persist: false,
      status: 'playing',
      roomSettings: settings,
    });
    await persistRoomState(event, { status: 'playing', roomSettings: settings });
    saveActiveSession();
    _startRound(firstRound);
  },

  setCustomQuestion() {
    const input = byId('manual-question-input');
    const err = byId('manual-question-error');
    if (!input) return;
    const question = input.value.trim();
    if (question.length < 3) {
      if (err) {
        err.textContent = 'Escribe una pregunta un poco más larga.';
        err.classList.remove('hidden');
      }
      return;
    }
    state.currentQuestion = question;
    state.timerExpired = false;
    emit({ type: 'question_set', round: state.currentRound, question, inventorId: state.currentInventorId });
    if (state.isHost) maybeStartRoundTimer();
    renderQuestionArea();
    renderVoteGrid();
    renderVoteStatus();
  },

  castVote(votedId) {
    if (state.hasVoted || !state.currentQuestion || state.timerExpired) return;
    const tid = String(votedId);
    if (tid === sid()) return;

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
    if (state.isHost && Object.keys(state.votes).length >= state.players.length) _doReveal();
  },

  nextRound() {
    if (!state.isHost) return;
    stopTimer();
    if (state.currentRound >= state.settings.rounds) {
      const scores = { ...state.scores };
      state.roomStatus = 'final';
      state.scores = scores;
      const event = emit({ type: 'game_over', scores }, { persist: false, status: 'final' });
      persistRoomState(event, { status: 'final' });
      _showFinal();
      return;
    }
    const round = _buildRound(state.currentRound + 1);
    state.roomStatus = 'playing';
    const event = emit({ type: 'next_round', round }, { persist: false, status: 'playing' });
    persistRoomState(event, { status: 'playing' });
    _startRound(round);
  },

  async newGame() {
    if (!state.isHost) return;
    try {
      stopTimer();
      const previousRoomCode = state.room.code;
      const players = state.players.map(normPlayer);
      const initialState = {
        status: 'waiting',
        hostId: sid(),
        players,
        settings: state.settings,
        currentRound: 0,
        votes: {},
        scores: {},
      };
      const res = await api.createRoom(GAME_ID, sid(), state.settings, initialState);
      const newRoom = { code: String(res.room_code ?? res.code).toUpperCase(), id: String(res.room_id ?? res.id ?? '') };

      emit({
        type: 'new_room_created',
        room: newRoom,
        settings: state.settings,
        players,
        hostId: sid(),
      }, { persist: true, status: 'waiting' });

      state.room = newRoom;
      state.roomStatus = 'waiting';
      state.hostId = sid();
      state.isHost = true;
      state.players = players;
      state.votes = {};
      state.scores = {};
      state.currentRound = 0;
      state.currentQuestion = null;
      state.currentInventorId = null;
      state.hasVoted = false;
      await connectSocket(state.room.code);
      await persistRoomState(null, { status: 'waiting', roomSettings: state.settings });
      saveActiveSession();
      App._enterWaiting();
      console.info(`Nueva sala creada desde ${previousRoomCode}: ${state.room.code}`);
    } catch (e) {
      toast('Error: ' + (e.message || 'desconocido'), '⚠️');
    }
  },

  exitToLobby() {
    stopTimer();
    closeSocket(true);
    clearActiveSession();
    state.room = null;
    state.roomStatus = 'waiting';
    state.hostId = null;
    state.isHost = false;
    state.players = [];
    byId('lobby-username').textContent = state.user.username;
    showScreen('lobby');
  },
};

function restoreScreenFromState() {
  renderWaitingPlayers();
  if (state.roomStatus === 'playing' && state.currentRound > 0) {
    renderRoundFromState();
    return;
  }
  if (state.roomStatus === 'reveal' && state.currentRound > 0) {
    _showReveal(state.currentRound, state.currentQuestion);
    return;
  }
  if (state.roomStatus === 'final') {
    _showFinal();
    return;
  }
  App._enterWaiting();
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

function _buildRound(roundNum) {
  if (state.settings.useQuestions) {
    const pool = questionBank();
    const question = pool.length
      ? pool[Math.floor(Math.random() * pool.length)]
      : '¿Quién del grupo ganaría este juego?';
    return { roundNum, question, inventorId: null };
  }
  const selected = state.players[Math.floor(Math.random() * state.players.length)];
  return { roundNum, question: null, inventorId: selected?.id ?? sid() };
}

function _doReveal() {
  if (!state.isHost) return;
  stopTimer(false);
  state.roomStatus = 'reveal';
  const voteCounts = {};
  state.players.forEach(p => { voteCounts[p.id] = 0; });
  Object.values(state.votes).forEach(vid => { voteCounts[String(vid)] = (voteCounts[String(vid)] || 0) + 1; });

  if (state.settings.points) {
    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    if (maxVotes > 0) {
      const top = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
      Object.entries(state.votes).forEach(([voterId, votedId]) => {
        if (top.includes(String(votedId))) state.scores[String(voterId)] = (state.scores[String(voterId)] || 0) + 1;
      });
    }
  }

  const event = emit({
    type: 'round_reveal',
    round: state.currentRound,
    question: state.currentQuestion,
    votes: state.votes,
    scores: state.scores,
  }, { persist: false, status: 'reveal' });
  persistRoomState(event, { status: 'reveal' });
  _showReveal(state.currentRound, state.currentQuestion);
}

function maybeStartRoundTimer() {
  if (!state.currentQuestion || !state.isHost) return;
  const limit = Number(state.settings.roundTimeLimit || 0);
  if (limit <= 0) {
    stopTimer(false);
    renderTimer(null);
    state.timerStartedAt = null;
    state.timerEndsAt = null;
    scheduleStateSync();
    return;
  }
  state.timerStartedAt = Date.now();
  state.timerEndsAt = state.timerStartedAt + limit * 1000;
  startTimer(limit);
  emit({ type: 'timer_sync', round: state.currentRound, remaining: limit, timerEndsAt: state.timerEndsAt });
}

function syncTimerFromState() {
  const limit = Number(state.settings.roundTimeLimit || 0);
  if (!state.currentQuestion || limit <= 0 || !state.timerEndsAt) {
    renderTimer(null);
    return;
  }
  const remaining = Math.max(0, Math.ceil((Number(state.timerEndsAt) - Date.now()) / 1000));
  if (remaining <= 0) {
    state.timerExpired = true;
    renderTimer(0);
    renderVoteStatus();
    return;
  }
  startTimer(remaining, { fromHost: !state.isHost });
}

function startTimer(seconds, { fromHost = false } = {}) {
  stopTimer(false);
  const limit = Number(seconds || 0);
  if (limit <= 0) {
    renderTimer(null);
    return;
  }

  state.timerExpired = false;
  state.timerRemaining = limit;
  state.timerEndsAt = state.timerEndsAt || Date.now() + limit * 1000;
  renderTimer(limit);

  state.timerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((Number(state.timerEndsAt) - Date.now()) / 1000));
    state.timerRemaining = remaining;
    renderTimer(remaining);

    if (state.isHost && !fromHost && remaining > 0 && remaining % 5 === 0) {
      emit({ type: 'timer_sync', round: state.currentRound, remaining, timerEndsAt: state.timerEndsAt });
    }

    if (remaining <= 0) {
      stopTimer(false);
      state.timerExpired = true;
      renderVoteStatus();
      if (state.isHost && !fromHost) {
        emit({ type: 'round_timeout', round: state.currentRound });
        _doReveal();
      }
    }
  }, 250);
}

function stopTimer(hide = true) {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
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

function renderWaitingPlayers() {
  const c = byId('waiting-players');
  const count = byId('waiting-count');
  if (!c || !count) return;
  count.textContent = state.players.length;
  c.innerHTML = state.players.map((p, i) => {
    const username = escapeHTML(p.username);
    return `
      <div class="flex items-center gap-3 glass rounded-2xl px-4 py-3 pop" style="animation-delay:${i * .05}s">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-base shadow-md">
          ${initials(p.username)}
        </div>
        <span class="flex-1 font-semibold truncate">${username}</span>
        ${p.id === sid() ? '<span class="text-xs text-zinc-500 font-medium">Tú</span>' : ''}
        ${p.id === state.hostId ? '<span class="text-xs bg-brand/20 text-brand-light px-2.5 py-0.5 rounded-full font-bold">Host</span>' : ''}
      </div>
    `;
  }).join('');
  renderStartButton();
}

function renderStartButton() {
  const button = byId('admin-start')?.querySelector('button');
  if (!button) return;
  const canStart = state.players.length >= 2;
  button.disabled = !canStart;
  button.textContent = canStart ? '¡Comenzar partida! 🚀' : 'Esperando más jugadores';
}

function _startRound({ roundNum, question, inventorId }) {
  stopTimer();
  state.roomStatus = 'playing';
  state.currentRound = Number(roundNum);
  state.currentQuestion = question ? String(question) : null;
  state.currentInventorId = inventorId ? String(inventorId) : null;
  state.votes = {};
  state.hasVoted = false;
  state.timerExpired = false;
  state.timerStartedAt = null;
  state.timerEndsAt = null;

  renderRoundFromState();
  maybeStartRoundTimer();
}

function renderRoundFromState() {
  byId('game-round').textContent = state.currentRound;
  byId('game-rounds').textContent = state.settings.rounds;
  byId('voted-feedback').classList.add('hidden');
  byId('voted-feedback').textContent = '✓ Voto registrado';

  const pct = ((state.currentRound - 1) / state.settings.rounds) * 100;
  byId('round-progress').style.width = pct + '%';

  renderQuestionArea();
  renderScoresHeader();
  renderVoteGrid();
  renderVoteStatus();
  showScreen('game');
  syncTimerFromState();
}

function renderQuestionArea() {
  const inventorEl = byId('question-inventor');
  const qEl = byId('game-question');
  if (!inventorEl || !qEl) return;
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
    qEl.innerHTML = `
      <span class="block text-sm text-zinc-400 font-medium mb-3">Escribe la pregunta de esta ronda para que todos puedan votar.</span>
      <span class="block glass rounded-2xl p-3">
        <input id="manual-question-input" type="text" maxlength="140" placeholder="Ej: ¿Quién sobreviviría mejor en una isla desierta?"
          class="w-full bg-zinc-800/70 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/70 placeholder-zinc-600 transition" />
        <span id="manual-question-error" class="hidden text-red-400 text-xs mt-2 text-left block"></span>
        <button id="manual-question-button" class="btn-brand mt-3 w-full py-3 rounded-xl font-bold text-sm">Usar esta pregunta</button>
      </span>
    `;
    byId('manual-question-input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') App.setCustomQuestion();
    });
    byId('manual-question-button')?.addEventListener('click', App.setCustomQuestion);
    byId('manual-question-input')?.focus();
  } else {
    qEl.textContent = `Esperando a que ${inventor?.username ?? 'el jugador elegido'} escriba la pregunta...`;
  }
}

function renderScoresHeader() {
  const header = byId('game-scores-header');
  if (!header) return;
  if (!state.settings.points) {
    header.innerHTML = '';
    return;
  }
  header.innerHTML = state.players.map(p => `
    <div class="flex flex-col items-center min-w-0 px-1">
      <span class="text-[10px] text-zinc-500 truncate max-w-[3.5rem]">${escapeHTML(p.username.slice(0, 6))}</span>
      <span class="font-black text-brand-light text-sm leading-tight">${state.scores[p.id] || 0}</span>
    </div>
  `).join('');
}

function renderVoteGrid() {
  const grid = byId('vote-grid');
  if (!grid) return;
  if (!state.currentQuestion) {
    grid.innerHTML = '<p class="col-span-2 text-center text-zinc-600 text-sm py-10">La votación se activará cuando haya una pregunta.</p>';
    return;
  }
  if (state.timerExpired) {
    grid.innerHTML = '<p class="col-span-2 text-center text-zinc-600 text-sm py-10">Tiempo agotado. Esperando resultados...</p>';
    return;
  }

  const votable = state.players.filter(p => p.id !== sid());
  grid.innerHTML = votable.length
    ? votable.map((p, i) => `
        <button class="vote-card rounded-2xl p-5 flex flex-col items-center gap-3 pop" data-id="${escapeHTML(p.id)}" style="animation-delay:${i * .06}s">
          <div class="w-14 h-14 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-2xl shadow-lg">
            ${initials(p.username)}
          </div>
          <span class="font-bold text-sm text-zinc-200">${escapeHTML(p.username)}</span>
        </button>
      `).join('')
    : '<p class="col-span-2 text-center text-zinc-600 text-sm py-10">Necesitas más jugadores para votar</p>';

  grid.querySelectorAll('.vote-card').forEach(button => {
    button.addEventListener('click', () => App.castVote(button.dataset.id));
  });
}

function renderVoteStatus() {
  const status = byId('votes-status');
  if (!status) return;
  const voted = Object.keys(state.votes).length;
  const total = state.currentQuestion ? state.players.length : 0;
  if (!state.currentQuestion) {
    status.textContent = 'Esperando pregunta para iniciar la votación';
  } else if (state.timerExpired) {
    status.textContent = `Tiempo agotado · ${voted} de ${total} votaron`;
  } else {
    status.textContent = `${voted} de ${total} han votado`;
  }
}

function _showReveal(roundNum, question) {
  stopTimer();
  state.roomStatus = 'reveal';
  byId('reveal-round').textContent = roundNum;
  const qEl = byId('reveal-question');
  qEl.textContent = question || '';
  qEl.classList.toggle('hidden', !question);

  const voteCounts = {};
  state.players.forEach(p => { voteCounts[p.id] = []; });
  Object.entries(state.votes).forEach(([voterId, votedId]) => {
    const key = String(votedId);
    if (!voteCounts[key]) voteCounts[key] = [];
    const voter = state.players.find(p => p.id === String(voterId));
    voteCounts[key].push(voter?.username ?? '?');
  });

  const sorted = [...state.players].sort((a, b) => (voteCounts[b.id]?.length || 0) - (voteCounts[a.id]?.length || 0));
  const maxVotes = Math.max(...sorted.map(p => voteCounts[p.id]?.length || 0), 1);
  const isLast = state.currentRound >= state.settings.rounds;

  byId('reveal-results').innerHTML = sorted.map((p, i) => {
    const voters = voteCounts[p.id] || [];
    const isTop = i === 0 && voters.length > 0;
    const barPct = Math.round((voters.length / maxVotes) * 100);
    const pts = state.scores[p.id] || 0;
    return `
      <div class="glass rounded-2xl p-4 pop" style="animation-delay:${i * .09}s">
        <div class="flex items-center gap-3 mb-2.5">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black shadow-md flex-shrink-0">
            ${initials(p.username)}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold truncate">${escapeHTML(p.username)}${isTop ? ' 👑' : ''}</p>
            <p class="text-xs text-zinc-500">${voters.length} voto${voters.length !== 1 ? 's' : ''}</p>
          </div>
          ${state.settings.points ? `<span class="font-black text-brand-light text-lg flex-shrink-0">${pts}pts</span>` : ''}
        </div>
        <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-brand to-violet-400 rounded-full bar-grow" style="width:${barPct}%" ></div>
        </div>
        ${!state.settings.privateVote && voters.length ? `
          <div class="mt-2 flex flex-wrap gap-1">
            ${voters.map(v => `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">${escapeHTML(v)}</span>`).join('')}
          </div>` : ''}
      </div>`;
  }).join('');

  byId('admin-next').classList.toggle('hidden', !state.isHost);
  byId('guest-next-wait').classList.toggle('hidden', state.isHost);
  if (state.isHost) byId('next-round-btn').textContent = isLast ? '🏁 Ver resultados finales' : 'Siguiente ronda →';

  showScreen('reveal');
}

function _showFinal() {
  stopTimer();
  state.roomStatus = 'final';
  launchConfetti();
  const sorted = [...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));
  byId('winner-name').textContent = sorted[0]?.username ?? '—';
  byId('final-scores').innerHTML = sorted.map((p, i) => `
    <div class="flex items-center gap-3 glass rounded-2xl px-4 py-3.5 pop" style="animation-delay:${i * .08}s">
      <span class="text-2xl flex-shrink-0">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
      <div class="w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-sm shadow-md flex-shrink-0">
        ${initials(p.username)}
      </div>
      <span class="flex-1 font-semibold truncate">${escapeHTML(p.username)}</span>
      <span class="font-black text-gradient text-lg">${state.scores[p.id] || 0}pts</span>
    </div>
  `).join('');
  byId('admin-new-game').classList.toggle('hidden', !state.isHost);
  byId('guest-end-wait').classList.toggle('hidden', state.isHost);
  showScreen('final');
}

App.init();
