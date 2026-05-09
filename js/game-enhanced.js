
const api = new GameAPI();
const GAME_ID = 12;
const SOCKET_RECONNECT_MS = 1800;
const SOCKET_MAX_RETRIES = 6;
const SESSION_KEY = 'democrazy_active_room';

const state = {
  user: null,
  room: null,
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
  fallbackChannel: null,
  pendingMessages: [],
  timerInterval: null,
  timerEndsAt: null,
  timerRemaining: 0,
  timerExpired: false,
  lastRoundToken: '',
};

const sid = () => String(state.user?.id ?? '');

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
  byId(`screen-${id}`).classList.add('active');

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
  byId(`screen-${screen}`).classList.add('active');
});

function toast(msg, icon = '') {
  const el = byId('toast');
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
  c.innerHTML = '';
  c.appendChild(img);
}

function launchConfetti() {
  const colors = ['#7C3AED', '#A78BFA', '#F59E0B', '#34D399', '#F87171', '#60A5FA', '#FB923C'];
  const container = byId('confetti-container');
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
  return p;
}

function saveActiveSession() {
  if (!state.user || !state.room) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    roomCode: state.room.code,
    roomId: state.room.id,
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
        console.warn('No se pudo cargar itty-sockets. Se usará fallback local.', error);
        return null;
      });
  }
  return socketConnectorPromise;
}

function closeSocket(manual = true) {
  state.socketManualClose = manual;
  clearTimeout(state.socketReconnectTimer);
  state.socketReconnectTimer = null;
  state.socketReady = false;
  try { state.socket?.close?.(); } catch {}
  state.socket = null;
  try { state.fallbackChannel?.close?.(); } catch {}
  state.fallbackChannel = null;
}

function setupFallbackChannel(roomCode) {
  if (!('BroadcastChannel' in window)) return false;
  try {
    state.fallbackChannel?.close?.();
    const channel = new BroadcastChannel(`democrazy-${roomCode}`);
    channel.onmessage = event => handleSocketMessage(event.data);
    state.fallbackChannel = channel;
    state.socketReady = true;
    flushPendingMessages();
    return true;
  } catch (error) {
    console.warn('Fallback BroadcastChannel no disponible', error);
    return false;
  }
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
    const fallbackReady = setupFallbackChannel(roomCode);
    if (fallbackReady) toast('Conexión local de respaldo activada', '📡');
    else toast('No se pudo abrir la conexión en tiempo real', '⚠️');
    return fallbackReady;
  }

  try {
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
        if (setupFallbackChannel(state.socketRoomCode)) toast('Conexión de respaldo activada', '📡');
        else toast('Conexión perdida. Revisa tu red.', '⚠️');
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
    return setupFallbackChannel(roomCode);
  }
}

function flushPendingMessages() {
  const queued = state.pendingMessages.splice(0);
  queued.forEach(data => emit(data));
}

function emit(data) {
  if (!data) return;
  const payload = JSON.stringify(data);
  if (state.socketReady && state.socket?.send) {
    state.socket.send(payload);
    return;
  }
  if (state.socketReady && state.fallbackChannel) {
    state.fallbackChannel.postMessage(data);
    handleSocketMessage(data);
    return;
  }
  state.pendingMessages.push(data);
}

function handleSocketMessage(data) {
  switch (data.type) {
    case 'player_joined': {
      const p = upsertPlayer(data.player);
      if (p && state.scores[p.id] == null) state.scores[p.id] = 0;
      renderWaitingPlayers();
      if (state.isHost) emit({ type: 'room_update', players: state.players });
      break;
    }
    case 'room_update':
      state.players = (data.players ?? []).map(normPlayer);
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
      state.currentRound = 0;
      state.scores = {};
      state.players.forEach(p => { state.scores[p.id] = 0; });
      saveActiveSession();
      _startRound(data.firstRound);
      break;
    case 'question_set':
      state.currentQuestion = String(data.question || '');
      state.currentInventorId = data.inventorId ? String(data.inventorId) : state.currentInventorId;
      renderQuestionArea();
      renderVoteGrid();
      renderVoteStatus();
      break;
    case 'timer_sync':
      if (!state.isHost && data.round === state.currentRound) {
        startTimer(Number(data.remaining ?? 0), { fromHost: true });
      }
      break;
    case 'round_timeout':
      if (data.round === state.currentRound) {
        state.timerExpired = true;
        stopTimer(false);
        renderTimer(0);
        renderVoteStatus();
        if (!state.isHost) {
          toast('Tiempo agotado. Esperando resultados...', '⏱️');
        }
      }
      break;
    case 'vote_cast':
      state.votes[String(data.voterId)] = String(data.votedId);
      renderVoteStatus();
      if (state.isHost && Object.keys(state.votes).length >= state.players.length) _doReveal();
      break;
    case 'round_reveal':
      stopTimer();
      state.votes = data.votes ?? {};
      state.scores = data.scores ?? {};
      _showReveal(data.round, data.question);
      break;
    case 'next_round':
      _startRound(data.round);
      break;
    case 'game_over':
      stopTimer();
      state.scores = data.scores ?? {};
      _showFinal();
      break;
    case 'new_game':
      stopTimer();
      state.players = (data.players ?? []).map(normPlayer);
      state.currentRound = 0;
      state.votes = {};
      state.scores = {};
      state.hasVoted = false;
      renderWaitingPlayers();
      showScreen('waiting');
      history.replaceState({ screen: 'waiting' }, '', `#/sala/${state.room.code}`);
      break;
  }
}

function normalizeSettings(settings = {}) {
  return {
    rounds: Number(settings.rounds ?? 5),
    points: settings.points ?? true,
    privateVote: settings.privateVote ?? false,
    useQuestions: settings.useQuestions ?? true,
    questionVisible: settings.questionVisible ?? true,
    roundTimeLimit: Number(settings.roundTimeLimit ?? 30),
  };
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
      state.room = { code, id: String(roomData.id ?? roomData.room_id ?? '') };
      state.isHost = Boolean(getSavedSession()?.isHost);
      const rawPlayers = roomData.players ?? roomData.users ?? roomData.members ?? [];
      state.players = rawPlayers.map(normPlayer);
      upsertPlayer(currentPlayer());
      state.settings = normalizeSettings(roomData.room_settings ?? roomData.settings ?? state.settings);
      await connectSocket(code);
      emit({ type: 'player_joined', player: currentPlayer() });
      App._enterWaiting();
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
      const res = await api.createRoom(GAME_ID, sid(), settings, { status: 'waiting' });
      state.room = { code: res.room_code ?? res.code, id: String(res.room_id ?? res.id) };
      state.isHost = true;
      state.players = [currentPlayer()];
      state.settings = settings;
      await connectSocket(state.room.code);
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
      state.isHost = false;
      const roomData = await api.getRoom(code);
      state.room = { code, id: String(roomData.id ?? roomData.room_id ?? '') };
      const rawPlayers = roomData.players ?? roomData.users ?? roomData.members ?? [];
      state.players = rawPlayers.map(normPlayer);
      upsertPlayer(currentPlayer());
      state.settings = normalizeSettings(roomData.room_settings ?? roomData.settings ?? state.settings);
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
      navigator.clipboard.writeText(url);
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
    const settings = normalizeSettings({
      rounds: parseInt(byId('cfg-rounds').value) || 5,
      points: byId('cfg-points').checked,
      privateVote: byId('cfg-private').checked,
      useQuestions: byId('cfg-questions').checked,
      questionVisible: byId('cfg-visible').checked,
      roundTimeLimit: parseInt(byId('cfg-round-time')?.value ?? '30', 10) || 0,
    });
    state.settings = settings;
    await api.updateRoomState(state.room.code, { status: 'playing', roomSettings: settings });
    const firstRound = _buildRound(1);
    emit({ type: 'game_started', settings, players: state.players, firstRound });
    state.players.forEach(p => { state.scores[p.id] = 0; });
    state.currentRound = 0;
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
    emit({ type: 'question_set', round: state.currentRound, question, inventorId: state.currentInventorId });
    maybeStartRoundTimer();
    renderQuestionArea();
    renderVoteGrid();
    renderVoteStatus();
  },

  castVote(votedId) {
    if (state.hasVoted || !state.currentQuestion || state.timerExpired) return;
    state.hasVoted = true;
    const tid = String(votedId);
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
    stopTimer();
    if (state.currentRound >= state.settings.rounds) {
      const scores = { ...state.scores };
      emit({ type: 'game_over', scores });
      state.scores = scores;
      _showFinal();
      return;
    }
    const round = _buildRound(state.currentRound + 1);
    emit({ type: 'next_round', round });
    _startRound(round);
  },

  async newGame() {
    try {
      stopTimer();
      const res = await api.createRoom(GAME_ID, sid(), state.settings, { status: 'waiting' });
      state.room = { code: res.room_code ?? res.code, id: String(res.room_id ?? res.id) };
      state.isHost = true;
      state.votes = {};
      state.currentRound = 0;
      state.currentQuestion = null;
      state.currentInventorId = null;
      state.hasVoted = false;
      await connectSocket(state.room.code);
      emit({ type: 'new_game', players: state.players });
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
    state.players = [];
    byId('lobby-username').textContent = state.user.username;
    showScreen('lobby');
  },
};

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
    return { roundNum, question: questions[Math.floor(Math.random() * questions.length)], inventorId: null };
  }
  return { roundNum, question: null, inventorId: state.players[Math.floor(Math.random() * state.players.length)]?.id ?? sid() };
}

function _doReveal() {
  stopTimer(false);
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

  emit({ type: 'round_reveal', round: state.currentRound, question: state.currentQuestion, votes: state.votes, scores: state.scores });
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
  startTimer(limit);
  if (state.isHost) emit({ type: 'timer_sync', round: state.currentRound, remaining: limit });
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
  state.timerEndsAt = Date.now() + limit * 1000;
  renderTimer(limit);

  state.timerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
    state.timerRemaining = remaining;
    renderTimer(remaining);

    if (state.isHost && remaining > 0 && remaining % 5 === 0) {
      emit({ type: 'timer_sync', round: state.currentRound, remaining });
    }

    if (remaining <= 0) {
      stopTimer(false);
      state.timerExpired = true;
      emit({ type: 'round_timeout', round: state.currentRound });
      if (state.isHost) {
        if (Object.keys(state.votes).length > 0) _doReveal();
        else {
          toast('Ronda sin votos. Pasando a resultados.', '⏱️');
          _doReveal();
        }
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

function renderWaitingPlayers() {
  const c = byId('waiting-players');
  byId('waiting-count').textContent = state.players.length;
  c.innerHTML = state.players.map((p, i) => {
    const username = escapeHTML(p.username);
    return `
      <div class="flex items-center gap-3 glass rounded-2xl px-4 py-3 pop" style="animation-delay:${i * .05}s">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-base shadow-md">
          ${initials(p.username)}
        </div>
        <span class="flex-1 font-semibold truncate">${username}</span>
        ${p.id === sid() ? '<span class="text-xs text-zinc-500 font-medium">Tú</span>' : ''}
        ${i === 0 ? '<span class="text-xs bg-brand/20 text-brand-light px-2.5 py-0.5 rounded-full font-bold">Host</span>' : ''}
      </div>
    `;
  }).join('');
}

function _startRound({ roundNum, question, inventorId }) {
  stopTimer();
  state.currentRound = roundNum;
  state.currentQuestion = question ? String(question) : null;
  state.currentInventorId = inventorId ? String(inventorId) : null;
  state.votes = {};
  state.hasVoted = false;
  state.timerExpired = false;
  state.lastRoundToken = `${roundNum}-${Date.now()}`;

  byId('game-round').textContent = roundNum;
  byId('game-rounds').textContent = state.settings.rounds;
  byId('voted-feedback').classList.add('hidden');
  byId('voted-feedback').textContent = '✓ Voto registrado';

  const pct = ((roundNum - 1) / state.settings.rounds) * 100;
  byId('round-progress').style.width = pct + '%';

  renderQuestionArea();
  renderScoresHeader();
  renderVoteGrid();
  renderVoteStatus();
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
  const voted = Object.keys(state.votes).length;
  const total = state.currentQuestion ? state.players.length : 0;
  if (!state.currentQuestion) {
    byId('votes-status').textContent = 'Esperando pregunta para iniciar la votación';
  } else if (state.timerExpired) {
    byId('votes-status').textContent = `Tiempo agotado · ${voted} de ${total} votaron`;
  } else {
    byId('votes-status').textContent = `${voted} de ${total} han votado`;
  }
}

function _showReveal(roundNum, question) {
  stopTimer();
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
