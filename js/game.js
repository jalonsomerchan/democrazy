import { connect } from 'https://esm.sh/itty-sockets';

const api = new GameAPI();
const GAME_ID = 12;

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  user: null,
  room: null,
  isHost: false,
  players: [],
  settings: { rounds: 5, points: true, privateVote: false, useQuestions: true, questionVisible: true },
  currentRound: 0,
  currentQuestion: null,
  votes: {},
  scores: {},
  hasVoted: false,
  socket: null,
};

const sid = () => state.user?.username ?? '';

// ─── Routing ──────────────────────────────────────────────────────────────────
const SCREEN_ROUTES = {
  login:   '#/',
  lobby:   '#/lobby',
  waiting: '#/sala',
  game:    '#/juego',
  reveal:  '#/resultados',
  final:   '#/final',
};

function showScreen(id, replace = false) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');

  const hash = SCREEN_ROUTES[id] ?? '#/';
  if (replace) history.replaceState({ screen: id }, '', hash);
  else         history.pushState({ screen: id }, '', hash);
}

window.addEventListener('popstate', e => {
  const screen = e.state?.screen;
  if (!screen || !document.getElementById(`screen-${screen}`)) return;

  // Guard invalid back-navigations
  if (screen === 'lobby' && !state.user) {
    showScreen('login', true); return;
  }
  if (['waiting','game','reveal','final'].includes(screen) && !state.room) {
    showScreen(state.user ? 'lobby' : 'login', true); return;
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screen}`).classList.add('active');
});

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, icon = '') {
  const el = document.getElementById('toast');
  el.innerHTML = icon ? `<span>${icon}</span><span>${msg}</span>` : msg;
  el.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2800);
}

// ─── QR ───────────────────────────────────────────────────────────────────────
function renderQR(url) {
  const img = document.createElement('img');
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  img.className = 'rounded-lg';
  img.width = img.height = 180;
  const c = document.getElementById('qr-container');
  c.innerHTML = '';
  c.appendChild(img);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function launchConfetti() {
  const colors = ['#7C3AED','#A78BFA','#F59E0B','#34D399','#F87171','#60A5FA','#FB923C'];
  const container = document.getElementById('confetti-container');
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
  setTimeout(() => { container.innerHTML = ''; }, 6000);
}

// ─── Player avatar color ──────────────────────────────────────────────────────
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

// ─── Normalize player ─────────────────────────────────────────────────────────
function normPlayer(p) {
  const username = p.username ?? p.name ?? '?';
  return { id: username, username };
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectSocket(roomCode) {
  state.socket?.close?.();
  state.socket = connect(`democrazy-${roomCode}`);
  state.socket.on('message', ({ message }) => {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      handleSocketMessage(data);
    } catch(e) { console.warn('socket parse error', e); }
  });
}

function emit(data) {
  state.socket?.send?.(JSON.stringify(data));
}

// ─── Socket handler ───────────────────────────────────────────────────────────
function handleSocketMessage(data) {
  switch (data.type) {
    case 'player_joined': {
      const p = normPlayer(data.player);
      if (!state.players.find(x => x.id === p.id)) state.players.push(p);
      renderWaitingPlayers();
      if (state.isHost) emit({ type: 'room_update', players: state.players });
      break;
    }
    case 'room_update':
      state.players = data.players.map(normPlayer);
      renderWaitingPlayers();
      break;
    case 'player_left':
      state.players = state.players.filter(p => p.id !== String(data.playerId));
      renderWaitingPlayers();
      break;
    case 'game_started':
      state.settings = data.settings;
      state.players = data.players.map(normPlayer);
      state.currentRound = 0;
      state.scores = {};
      state.players.forEach(p => { state.scores[p.id] = 0; });
      _startRound(data.firstRound);
      break;
    case 'vote_cast': {
      state.votes[String(data.voterId)] = String(data.votedId);
      renderVoteStatus();
      if (state.isHost && Object.keys(state.votes).length >= state.players.length) _doReveal();
      break;
    }
    case 'round_reveal':
      state.votes = data.votes;
      state.scores = data.scores;
      _showReveal(data.round, data.question);
      break;
    case 'next_round':
      _startRound(data.round);
      break;
    case 'game_over':
      state.scores = data.scores;
      _showFinal();
      break;
    case 'new_game':
      state.players = data.players.map(normPlayer);
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

// ─── App ──────────────────────────────────────────────────────────────────────
window.App = {

  init() {
    // Restore user from localStorage
    const saved = localStorage.getItem('democrazy_user');
    if (saved) {
      const u = JSON.parse(saved);
      u.id = String(u.id);
      state.user = u;
      document.getElementById('existing-avatar').textContent = u.username[0].toUpperCase();
      document.getElementById('existing-name').textContent = u.username;
      document.getElementById('existing-user-card').classList.remove('hidden');
      document.getElementById('new-user-toggle').classList.remove('hidden');
      document.getElementById('new-user-form').classList.add('hidden');
    }

    // Handle ?sala=CODE invite link
    const code = new URLSearchParams(location.search).get('sala');
    if (code) sessionStorage.setItem('pending_room', code.toUpperCase());

    // Set initial history state
    history.replaceState({ screen: 'login' }, '', '#/');
  },

  useExistingUser() { App._enterLobby(); },

  showNewUserForm() {
    document.getElementById('new-user-form').classList.remove('hidden');
    document.getElementById('new-user-toggle').classList.add('hidden');
    document.getElementById('existing-user-card').classList.add('hidden');
    document.getElementById('input-username').focus();
  },

  async createUser() {
    const username = document.getElementById('input-username').value.trim();
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    if (!username || username.length < 2) {
      errEl.textContent = 'El nombre debe tener al menos 2 caracteres.';
      errEl.classList.remove('hidden');
      document.getElementById('input-username').classList.add('shake');
      setTimeout(() => document.getElementById('input-username').classList.remove('shake'), 400);
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
    localStorage.removeItem('democrazy_user');
    state.user = null;
    document.getElementById('existing-user-card').classList.add('hidden');
    document.getElementById('new-user-toggle').classList.add('hidden');
    document.getElementById('new-user-form').classList.remove('hidden');
    showScreen('login');
  },

  _enterLobby() {
    document.getElementById('lobby-username').textContent = state.user.username;
    showScreen('lobby');
    const pending = sessionStorage.getItem('pending_room');
    if (pending) {
      sessionStorage.removeItem('pending_room');
      document.getElementById('input-room-code').value = pending;
      App.joinRoom();
    }
  },

  async createRoom() {
    const btn = document.getElementById('screen-lobby').querySelector('.btn-brand');
    btn.textContent = 'Creando...'; btn.disabled = true;
    try {
      const settings = { rounds: 5, points: true, privateVote: false, useQuestions: true, questionVisible: true };
      const res = await api.createRoom(GAME_ID, state.user.id, settings, { status: 'waiting' });
      state.room = { code: res.room_code ?? res.code, id: String(res.room_id ?? res.id) };
      state.isHost = true;
      state.players = [{ id: state.user.username, username: state.user.username }];
      state.settings = settings;
      connectSocket(state.room.code);
      App._enterWaiting();
    } catch (e) {
      toast('Error al crear sala: ' + e.message, '⚠️');
      console.error(e);
    } finally {
      btn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg> Crear sala';
      btn.disabled = false;
    }
  },

  async joinRoom() {
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    const errEl = document.getElementById('join-error');
    errEl.classList.add('hidden');
    if (code.length < 4) return;
    try {
      await api.joinRoom(code, state.user.id);
      state.isHost = false;
      const roomData = await api.getRoom(code);
      state.room = { code, id: roomData.id };
      const rawPlayers = roomData.players ?? roomData.users ?? roomData.members ?? [];
      state.players = rawPlayers.map(normPlayer);
      if (!state.players.find(p => p.id === sid())) {
        state.players.push({ id: state.user.username, username: state.user.username });
      }
      state.settings = roomData.room_settings ?? roomData.settings ?? state.settings;
      connectSocket(code);
      emit({ type: 'player_joined', player: { id: state.user.username, username: state.user.username } });
      App._enterWaiting();
    } catch (e) {
      errEl.textContent = e.message || 'Sala no encontrada.';
      errEl.classList.remove('hidden');
      console.error(e);
    }
  },

  _enterWaiting() {
    document.getElementById('waiting-code').textContent = state.room.code;
    document.getElementById('qr-code-label').textContent = state.room.code;
    document.getElementById('admin-settings').classList.toggle('hidden', !state.isHost);
    document.getElementById('admin-start').classList.toggle('hidden', !state.isHost);
    document.getElementById('guest-wait').classList.toggle('hidden', state.isHost);
    if (state.isHost) {
      const s = state.settings;
      document.getElementById('cfg-rounds').value = s.rounds;
      document.getElementById('cfg-rounds-display').textContent = s.rounds;
      document.getElementById('cfg-points').checked = s.points;
      document.getElementById('cfg-private').checked = s.privateVote;
      document.getElementById('cfg-questions').checked = s.useQuestions;
      document.getElementById('cfg-visible').checked = s.questionVisible ?? true;
      App.updateVisibleHint();
    }
    renderWaitingPlayers();
    const shareUrl = `${location.origin}${location.pathname}?sala=${state.room.code}`;
    renderQR(shareUrl);
    showScreen('waiting');
    history.replaceState({ screen: 'waiting' }, '', `#/sala/${state.room.code}`);
  },

  toggleQR() { document.getElementById('qr-panel').classList.toggle('hidden'); },

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
    const input = document.getElementById('cfg-rounds');
    const display = document.getElementById('cfg-rounds-display');
    const val = Math.min(20, Math.max(1, (parseInt(input.value) || 5) + delta));
    input.value = val;
    display.textContent = val;
    display.classList.add('scale-125');
    setTimeout(() => display.classList.remove('scale-125'), 200);
  },

  updateVisibleHint() {
    const checked = document.getElementById('cfg-visible').checked;
    document.getElementById('cfg-visible-hint').textContent = checked
      ? 'Todos ven la pregunta'
      : 'Solo el admin ve la pregunta';
  },

  async startGame() {
    const settings = {
      rounds:          parseInt(document.getElementById('cfg-rounds').value) || 5,
      points:          document.getElementById('cfg-points').checked,
      privateVote:     document.getElementById('cfg-private').checked,
      useQuestions:    document.getElementById('cfg-questions').checked,
      questionVisible: document.getElementById('cfg-visible').checked,
    };
    state.settings = settings;
    await api.updateRoomState(state.room.code, { status: 'playing', roomSettings: settings });
    const firstRound = _buildRound(1);
    emit({ type: 'game_started', settings, players: state.players, firstRound });
    state.players.forEach(p => { state.scores[p.id] = 0; });
    state.currentRound = 0;
    _startRound(firstRound);
  },

  castVote(votedId) {
    if (state.hasVoted) return;
    state.hasVoted = true;
    const tid = String(votedId);
    state.votes[sid()] = tid;

    document.querySelectorAll('.vote-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.id === tid);
      c.classList.add('voted');
    });
    document.getElementById('voted-feedback').classList.remove('hidden');
    renderVoteStatus();
    emit({ type: 'vote_cast', voterId: sid(), votedId: tid });
    if (state.isHost && Object.keys(state.votes).length >= state.players.length) _doReveal();
  },

  nextRound() {
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
      const res = await api.createRoom(GAME_ID, state.user.id, state.settings, { status: 'waiting' });
      state.room = { code: res.room_code ?? res.code, id: String(res.room_id ?? res.id) };
      state.isHost = true;
      state.votes = {};
      state.currentRound = 0;
      state.hasVoted = false;
      connectSocket(state.room.code);
      emit({ type: 'new_game', players: state.players });
      App._enterWaiting();
    } catch(e) { toast('Error: ' + e.message, '⚠️'); }
  },

  exitToLobby() {
    state.socket?.close?.();
    state.socket = null;
    state.room = null;
    state.isHost = false;
    state.players = [];
    document.getElementById('lobby-username').textContent = state.user.username;
    showScreen('lobby');
  },
};

// ─── Game logic ───────────────────────────────────────────────────────────────
function _buildRound(roundNum) {
  if (state.settings.useQuestions) {
    return { roundNum, question: questions[Math.floor(Math.random() * questions.length)], inventorId: null };
  }
  return { roundNum, question: null, inventorId: state.players[Math.floor(Math.random() * state.players.length)].id };
}

function _doReveal() {
  const voteCounts = {};
  state.players.forEach(p => { voteCounts[p.id] = 0; });
  Object.values(state.votes).forEach(vid => { voteCounts[String(vid)] = (voteCounts[String(vid)] || 0) + 1; });

  if (state.settings.points) {
    const maxVotes = Math.max(...Object.values(voteCounts));
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

// ─── Render ───────────────────────────────────────────────────────────────────
function renderWaitingPlayers() {
  const c = document.getElementById('waiting-players');
  document.getElementById('waiting-count').textContent = state.players.length;
  c.innerHTML = state.players.map((p, i) => `
    <div class="flex items-center gap-3 glass rounded-2xl px-4 py-3 pop" style="animation-delay:${i * .05}s">
      <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-base shadow-md">
        ${p.username[0].toUpperCase()}
      </div>
      <span class="flex-1 font-semibold truncate">${p.username}</span>
      ${p.id === sid() ? '<span class="text-xs text-zinc-500 font-medium">Tú</span>' : ''}
      ${i === 0 ? '<span class="text-xs bg-brand/20 text-brand-light px-2.5 py-0.5 rounded-full font-bold">Host</span>' : ''}
    </div>
  `).join('');
}

function _startRound({ roundNum, question, inventorId }) {
  state.currentRound = roundNum;
  state.currentQuestion = question;
  state.votes = {};
  state.hasVoted = false;

  document.getElementById('game-round').textContent = roundNum;
  document.getElementById('game-rounds').textContent = state.settings.rounds;
  document.getElementById('voted-feedback').classList.add('hidden');

  // Round progress bar
  const pct = ((roundNum - 1) / state.settings.rounds) * 100;
  document.getElementById('round-progress').style.width = pct + '%';

  const inventorEl = document.getElementById('question-inventor');
  const qEl = document.getElementById('game-question');
  const canSeeQuestion = state.settings.questionVisible || state.isHost;

  if (question) {
    inventorEl.classList.add('hidden');
    qEl.classList.remove('hidden');
    qEl.textContent = canSeeQuestion ? question : '🔒 El admin conoce la pregunta';
  } else {
    const inventor = state.players.find(p => p.id === String(inventorId));
    qEl.textContent = '';
    inventorEl.classList.remove('hidden');
    document.getElementById('inventor-name').textContent = inventor?.username ?? '?';
  }

  if (state.settings.points) {
    document.getElementById('game-scores-header').innerHTML = state.players.map(p => `
      <div class="flex flex-col items-center min-w-0 px-1">
        <span class="text-[10px] text-zinc-500 truncate max-w-[3.5rem]">${p.username.slice(0, 6)}</span>
        <span class="font-black text-brand-light text-sm leading-tight">${state.scores[p.id] || 0}</span>
      </div>
    `).join('');
  }

  const votable = state.players.filter(p => p.id !== sid());
  document.getElementById('vote-grid').innerHTML = votable.length
    ? votable.map((p, i) => `
        <button class="vote-card rounded-2xl p-5 flex flex-col items-center gap-3 pop" data-id="${p.id}"
          onclick="App.castVote('${p.id}')" style="animation-delay:${i * .06}s">
          <div class="w-14 h-14 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-2xl shadow-lg">
            ${p.username[0].toUpperCase()}
          </div>
          <span class="font-bold text-sm text-zinc-200">${p.username}</span>
        </button>
      `).join('')
    : '<p class="col-span-2 text-center text-zinc-600 text-sm py-10">Necesitas más jugadores para votar</p>';

  renderVoteStatus();
  showScreen('game');
}

function renderVoteStatus() {
  const voted = Object.keys(state.votes).length;
  const total = state.players.length;
  document.getElementById('votes-status').textContent = `${voted} de ${total} han votado`;
}

function _showReveal(roundNum, question) {
  document.getElementById('reveal-round').textContent = roundNum;
  const qEl = document.getElementById('reveal-question');
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

  document.getElementById('reveal-results').innerHTML = sorted.map((p, i) => {
    const voters = voteCounts[p.id] || [];
    const isTop = i === 0 && voters.length > 0;
    const barPct = Math.round((voters.length / maxVotes) * 100);
    const pts = state.scores[p.id] || 0;
    return `
      <div class="glass rounded-2xl p-4 pop" style="animation-delay:${i * .09}s">
        <div class="flex items-center gap-3 mb-2.5">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black shadow-md flex-shrink-0">
            ${p.username[0].toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold truncate">${p.username}${isTop ? ' 👑' : ''}</p>
            <p class="text-xs text-zinc-500">${voters.length} voto${voters.length !== 1 ? 's' : ''}</p>
          </div>
          ${state.settings.points ? `<span class="font-black text-brand-light text-lg flex-shrink-0">${pts}pts</span>` : ''}
        </div>
        <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-brand to-violet-400 rounded-full bar-grow" style="width:${barPct}%" ></div>
        </div>
        ${!state.settings.privateVote && voters.length ? `
          <div class="mt-2 flex flex-wrap gap-1">
            ${voters.map(v => `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">${v}</span>`).join('')}
          </div>` : ''}
      </div>`;
  }).join('');

  document.getElementById('admin-next').classList.toggle('hidden', !state.isHost);
  document.getElementById('guest-next-wait').classList.toggle('hidden', state.isHost);
  if (state.isHost) document.getElementById('next-round-btn').textContent = isLast ? '🏁 Ver resultados finales' : 'Siguiente ronda →';

  showScreen('reveal');
}

function _showFinal() {
  launchConfetti();
  const sorted = [...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));
  document.getElementById('winner-name').textContent = sorted[0]?.username ?? '—';
  document.getElementById('final-scores').innerHTML = sorted.map((p, i) => `
    <div class="flex items-center gap-3 glass rounded-2xl px-4 py-3.5 pop" style="animation-delay:${i * .08}s">
      <span class="text-2xl flex-shrink-0">${['🥇','🥈','🥉'][i] ?? `${i + 1}.`}</span>
      <div class="w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(p.username)} flex items-center justify-center font-black text-sm shadow-md flex-shrink-0">
        ${p.username[0].toUpperCase()}
      </div>
      <span class="flex-1 font-semibold truncate">${p.username}</span>
      <span class="font-black text-gradient text-lg">${state.scores[p.id] || 0}pts</span>
    </div>
  `).join('');
  document.getElementById('admin-new-game').classList.toggle('hidden', !state.isHost);
  document.getElementById('guest-end-wait').classList.toggle('hidden', state.isHost);
  showScreen('final');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
App.init();
