/* ─── State ──────────────────────────────────────────────────────────────────── */
const state = {
  devices: { cameras: [], arms: [] },
  config:  {},
  procStatus: {},
  wsReady: false,
};

/* ─── API helpers ────────────────────────────────────────────────────────────── */
const MotorTable = {
  data: {},
  update(process, name, min, pos, max) {
    if (process !== 'calibrate') return;

    const placeholder = document.getElementById('cal-motor-placeholder');
    if (placeholder && placeholder.style.display !== 'none') {
      placeholder.style.display = 'none';
    }

    const list = document.getElementById('cal-motor-list');

    if (!this.data[name]) {
      this.data[name] = true;
      const row = document.createElement('div');
      row.className = 'motor-row';
      row.id = `motor-row-${name}`;
      row.innerHTML = `
        <div class="motor-name">${name}</div>
        <div class="motor-track-wrap">
          <div class="motor-track">
            <div class="motor-range" id="motor-range-${name}"></div>
            <div class="motor-pos" id="motor-pos-${name}"></div>
          </div>
        </div>
        <div class="motor-vals">
          <div><span class="lbl">MIN</span><span class="val-min" id="motor-vmin-${name}"></span></div>
          <div><span class="lbl">POS</span><span class="val-pos" id="motor-vpos-${name}"></span></div>
          <div><span class="lbl">MAX</span><span class="val-max" id="motor-vmax-${name}"></span></div>
        </div>
      `;
      list.appendChild(row);
    }

    document.getElementById(`motor-vmin-${name}`).textContent = min;
    document.getElementById(`motor-vpos-${name}`).textContent = pos;
    document.getElementById(`motor-vmax-${name}`).textContent = max;

    const maxVal = 4095;
    const clamp = (v) => Math.max(0, Math.min(maxVal, v));
    const cMin = clamp(min), cPos = clamp(pos), cMax = clamp(max);

    const rangeEl = document.getElementById(`motor-range-${name}`);
    const posEl = document.getElementById(`motor-pos-${name}`);

    const leftPct = (cMin / maxVal) * 100;
    const widthPct = Math.max(0, ((cMax - cMin) / maxVal) * 100);
    const posPct = (cPos / maxVal) * 100;

    rangeEl.style.left = leftPct + '%';
    rangeEl.style.width = widthPct + '%';
    posEl.style.left = posPct + '%';
  },
  clear() {
    this.data = {};
    const placeholder = document.getElementById('cal-motor-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    const list = document.getElementById('cal-motor-list');
    if (list) list.innerHTML = '';
  }
};

const api = {
  async get(path) {
    const r = await fetch(path);
    return r.json();
  },
  async post(path, body = {}) {
    const r = await fetch(path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    return r.json();
  },
};

/* ─── WebSocket ──────────────────────────────────────────────────────────────── */
const WS = {
  ws: null,
  reconnectTimer: null,

  connect() {
    const url = `ws://${location.host}/ws`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      state.wsReady = true;
      document.getElementById('ws-dot').className   = 'dot green';
      document.getElementById('ws-label').textContent = 'Connected';
    };

    this.ws.onclose = () => {
      state.wsReady = false;
      document.getElementById('ws-dot').className   = 'dot red';
      document.getElementById('ws-label').textContent = 'Disconnected';
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'output') WS.onOutput(msg);
      if (msg.type === 'status') WS.onStatus(msg);
    };
  },

  onOutput(msg) {
    const rowMatch = msg.line.match(/^([a-zA-Z0-9_]+)\s+\|\s+(-?\d+)\s+\|\s+(-?\d+)\s+\|\s+(-?\d+)\s*$/);
    const isHeader = /^NAME\s+\|\s+MIN\s+\|\s+POS/.test(msg.line);
    const isSeparator = /^-{10,}\s*$/.test(msg.line);

    if (isHeader || isSeparator || rowMatch) {
      if (rowMatch) {
        MotorTable.update(
          msg.process,
          rowMatch[1],
          parseInt(rowMatch[2], 10),
          parseInt(rowMatch[3], 10),
          parseInt(rowMatch[4], 10)
        );
      }
      return;
    }

    const logMap = {
      teleop:      'teleop-log',
      record:      'record-log',
      calibrate:   'cal-log',
      motor_setup: 'ms-log',
    };
    const el = document.getElementById(logMap[msg.process]);
    if (!el) return;
    const line = document.createElement('div');
    line.className = `line-${msg.kind}`;
    line.textContent = msg.line;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;

    // Parse episode progress from record output
    if (msg.process === 'record') RecordTab.parseEpisode(msg.line);
  },

  onStatus(msg) {
    state.procStatus = msg.processes;
    TeleopTab.syncBtn();
    RecordTab.syncBtn();
    CalibrateTab.syncBtn();
    MotorSetupTab.syncBtn();
    StatusTab.updateProcs(msg.processes);
  },
};

/* ─── Tab switching ──────────────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cam-preview-wrap img').forEach(img => { img.removeAttribute('src'); });
    document.querySelectorAll('.cam-preview-wrap').forEach(w => w.innerHTML = '<span class="play-hint">▶ Click to preview</span>');
    
    const tf = document.getElementById('teleop-feeds'); 
    if (tf) { tf.querySelectorAll('img').forEach(img => img.removeAttribute('src')); tf.innerHTML = ''; }
    
    const rf = document.getElementById('record-feeds'); 
    if (rf) { rf.querySelectorAll('img').forEach(img => img.removeAttribute('src')); rf.innerHTML = ''; }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

    // Lazy-load on tab open
    if (btn.dataset.tab === 'status')       StatusTab.refresh();
    if (btn.dataset.tab === 'device-setup') { DeviceSetupTab.refresh(); DeviceSetupTab.loadStreamSettings(); }
    if (btn.dataset.tab === 'calibrate')    { CalibrateTab.refreshArms(); CalibrateTab.checkFile(); CalibrateTab.refreshFiles(); }
    if (btn.dataset.tab === 'motor-setup')  MotorSetupTab.refreshArms();
    if (btn.dataset.tab === 'teleop')       TeleopTab.showFeeds();
    if (btn.dataset.tab === 'record')       RecordTab.showFeeds();
  });
});

/* ─── Load initial config ────────────────────────────────────────────────────── */
async function loadConfig() {
  state.config = await api.get('/api/config');
  TeleopTab.applyConfig(state.config);
  RecordTab.applyConfig(state.config);
}

function saveConfig() {
  api.post('/api/config', state.config);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   STATUS TAB
══════════════════════════════════════════════════════════════════════════════ */
const StatusTab = {
  async refresh() {
    const data = await api.get('/api/devices');
    state.devices = data;
    this.renderCameras(data.cameras);
    this.renderArms(data.arms);
  },

  renderCameras(cameras) {
    const el = document.getElementById('status-cameras');
    if (!cameras.length) { el.innerHTML = '<div class="device-item"><span class="dname">No cameras detected</span></div>'; return; }
    el.innerHTML = cameras.map(c => {
      const hasLink = !!c.symlink;
      return `<div class="device-item">
        <span class="dot ${hasLink ? 'green' : 'yellow'}"></span>
        <div>
          <div class="dname">${c.symlink || c.device}</div>
          <div class="dsub">/dev/${c.device} · port ${c.kernels || '?'} · ${c.model}</div>
        </div>
        <span class="dbadge ${hasLink ? 'badge-ok' : 'badge-warn'}">${hasLink ? 'linked' : 'no link'}</span>
      </div>`;
    }).join('');
  },

  renderArms(arms) {
    const el = document.getElementById('status-arms');
    if (!arms.length) { el.innerHTML = '<div class="device-item"><span class="dname">No arm ports detected</span></div>'; return; }
    el.innerHTML = arms.map(a => {
      const hasLink = !!a.symlink;
      return `<div class="device-item">
        <span class="dot ${hasLink ? 'green' : 'yellow'}"></span>
        <div>
          <div class="dname">${a.symlink || a.device}</div>
          <div class="dsub">/dev/${a.device}</div>
        </div>
        <span class="dbadge ${hasLink ? 'badge-ok' : 'badge-warn'}">${hasLink ? 'linked' : 'no link'}</span>
      </div>`;
    }).join('');
  },

  updateProcs(procs) {
    const el = document.getElementById('status-procs');
    const allProcs = ['teleop', 'record', 'calibrate', 'motor_setup'];
    el.innerHTML = allProcs.map(name => {
      const running = !!procs[name];
      return `<div class="device-item">
        <span class="dot ${running ? 'green pulse' : 'gray'}"></span>
        <div class="dname">${name}</div>
        <span class="dbadge ${running ? 'badge-run' : 'badge-idle'}">${running ? 'running' : 'idle'}</span>
      </div>`;
    }).join('');
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   TELEOP TAB
══════════════════════════════════════════════════════════════════════════════ */
const TeleopTab = {
  mode: 'single',

  setMode(m) {
    this.mode = m;
    document.getElementById('teleop-mode-single').classList.toggle('active', m === 'single');
    document.getElementById('teleop-mode-bi').classList.toggle('active',     m === 'bi');
    document.getElementById('teleop-single-cfg').classList.toggle('hidden',  m !== 'single');
    document.getElementById('teleop-bi-cfg').classList.toggle('hidden',      m !== 'bi');
  },

  applyConfig(cfg) {
    this.mode = cfg.robot_mode || 'single';
    this.setMode(this.mode);
    setVal('teleop-follower-port',  cfg.follower_port);
    setVal('teleop-robot-id',       cfg.robot_id);
    setVal('teleop-leader-port',    cfg.leader_port);
    setVal('teleop-teleop-id',      cfg.teleop_id);
    setVal('teleop-left-follower',  cfg.left_follower_port);
    setVal('teleop-right-follower', cfg.right_follower_port);
    setVal('teleop-left-leader',    cfg.left_leader_port);
    setVal('teleop-right-leader',   cfg.right_leader_port);
    if (cfg.cameras) {
      setVal('tc-front1', cfg.cameras.front_1 || '');
      setVal('tc-top1',   cfg.cameras.top_1   || '');
      setVal('tc-top2',   cfg.cameras.top_2   || '');
    }
  },

  buildConfig() {
    const cfg = {
      robot_mode:          this.mode,
      follower_port:       getVal('teleop-follower-port'),
      robot_id:            getVal('teleop-robot-id'),
      leader_port:         getVal('teleop-leader-port'),
      teleop_id:           getVal('teleop-teleop-id'),
      left_follower_port:  getVal('teleop-left-follower'),
      right_follower_port: getVal('teleop-right-follower'),
      left_leader_port:    getVal('teleop-left-leader'),
      right_leader_port:   getVal('teleop-right-leader'),
    };
    Object.assign(state.config, cfg);
    saveConfig();
    return cfg;
  },

  async start() {
    const cfg = this.buildConfig();
    this.clearLog();
    const res = await api.post('/api/teleop/start', cfg);
    if (!res.ok) { appendLog('teleop-log', `[ERROR] ${res.error}`, 'error'); return; }
    this.showFeeds();
  },

  async stop() {
    await api.post('/api/process/teleop/stop');
  },

  showFeeds() {
    const cameras = [
      { name: 'front_1', path: getVal('tc-front1') },
      { name: 'top_1',   path: getVal('tc-top1')   },
      { name: 'top_2',   path: getVal('tc-top2')   },
    ].filter(c => c.path);
    renderFeeds('teleop-feeds', cameras);
  },

  clearLog() { document.getElementById('teleop-log').innerHTML = ''; },

  syncBtn() {
    const running = state.procStatus.teleop;
    document.getElementById('teleop-start-btn').classList.toggle('hidden', running);
    document.getElementById('teleop-stop-btn').classList.toggle('hidden',  !running);
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   RECORD TAB
══════════════════════════════════════════════════════════════════════════════ */
const RecordTab = {
  mode: 'single',

  setMode(m) {
    this.mode = m;
    document.getElementById('record-mode-single').classList.toggle('active', m === 'single');
    document.getElementById('record-mode-bi').classList.toggle('active',     m === 'bi');
    document.getElementById('record-single-cfg').classList.toggle('hidden',  m !== 'single');
    document.getElementById('record-bi-cfg').classList.toggle('hidden',      m !== 'bi');
  },

  applyConfig(cfg) {
    this.mode = cfg.robot_mode || 'single';
    this.setMode(this.mode);
    setVal('record-follower-port',  cfg.follower_port);
    setVal('record-robot-id',       cfg.robot_id);
    setVal('record-leader-port',    cfg.leader_port);
    setVal('record-teleop-id',      cfg.teleop_id);
    setVal('record-left-follower',  cfg.left_follower_port);
    setVal('record-right-follower', cfg.right_follower_port);
    setVal('record-left-leader',    cfg.left_leader_port);
    setVal('record-right-leader',   cfg.right_leader_port);
    setVal('record-task',     cfg.record_task     || '');
    setVal('record-episodes', cfg.record_episodes || 50);
    setVal('record-repo',     cfg.record_repo_id  || 'user/my-dataset');
    document.getElementById('record-ep-total').textContent = cfg.record_episodes || '—';
    if (cfg.cameras) {
      setVal('rc-front1', cfg.cameras.front_1 || '');
      setVal('rc-top1',   cfg.cameras.top_1   || '');
      setVal('rc-top2',   cfg.cameras.top_2   || '');
    }
  },

  buildConfig() {
    const ep = parseInt(getVal('record-episodes')) || 50;
    const cfg = {
      robot_mode:    this.mode,
      follower_port: getVal('record-follower-port'),
      robot_id:      getVal('record-robot-id'),
      leader_port:   getVal('record-leader-port'),
      teleop_id:     getVal('record-teleop-id'),
      left_follower_port:  getVal('record-left-follower'),
      right_follower_port: getVal('record-right-follower'),
      left_leader_port:    getVal('record-left-leader'),
      right_leader_port:   getVal('record-right-leader'),
      record_task:         getVal('record-task'),
      record_episodes:     ep,
      record_repo_id:      getVal('record-repo'),
      cameras: {
        front_1: getVal('rc-front1'),
        top_1:   getVal('rc-top1'),
        top_2:   getVal('rc-top2'),
      },
    };
    document.getElementById('record-ep-total').textContent = ep;
    Object.assign(state.config, cfg);
    saveConfig();
    return cfg;
  },

  async start() {
    const cfg = this.buildConfig();
    this.clearLog();
    const res = await api.post('/api/record/start', cfg);
    if (!res.ok) { appendLog('record-log', `[ERROR] ${res.error}`, 'error'); return; }
    this.showFeeds();
  },

  async stop() {
    await api.post('/api/process/record/stop');
  },

  // Send keyboard shortcut as stdin key name
  async sendKey(key) {
    await api.post('/api/process/record/input', { text: key });
  },

  showFeeds() {
    const cameras = [
      { name: 'front_1', path: getVal('rc-front1') || state.config.cameras?.front_1 || '' },
      { name: 'top_1',   path: getVal('rc-top1')   || state.config.cameras?.top_1   || '' },
      { name: 'top_2',   path: getVal('rc-top2')   || state.config.cameras?.top_2   || '' },
    ].filter(c => c.path);
    renderFeeds('record-feeds', cameras);
  },

  parseEpisode(line) {
    // Match patterns like "Episode 3/50" or "episode_index=3"
    let m = line.match(/[Ee]pisode[\s_](?:index=)?(\d+)/);
    if (m) {
      const current = parseInt(m[1]);
      const total   = parseInt(document.getElementById('record-ep-total').textContent) || 0;
      document.getElementById('record-ep-current').textContent = current;
      if (total > 0) {
        const pct = (current / total * 100).toFixed(1);
        const bar = document.getElementById('record-ep-bar');
        if (bar) bar.style.width = pct + '%';
      }
    }
  },

  clearLog() { document.getElementById('record-log').innerHTML = ''; },

  syncBtn() {
    const running = state.procStatus.record;
    document.getElementById('record-start-btn').classList.toggle('hidden', running);
    document.getElementById('record-stop-btn').classList.toggle('hidden',  !running);
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   CALIBRATE TAB
══════════════════════════════════════════════════════════════════════════════ */
const CalibrateTab = {
  checkTimer: null,
  cachedFiles: [],

  async checkFile() {
    clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(async () => {
      const type = getVal('cal-type');
      const id = getVal('cal-id');
      if (!type || !id) return;
      
      const res = await api.get(`/api/calibrate/file?robot_type=${type}&robot_id=${id}`);
      const statusEl = document.getElementById('cal-file-status');
      const metaEl = document.getElementById('cal-file-meta');
      
      if (res.exists) {
        statusEl.textContent = 'Found';
        statusEl.className = 'dbadge badge-ok';
        metaEl.innerHTML = `${res.path}<br/>Modified: ${res.modified} (${res.size} bytes)`;
      } else {
        statusEl.textContent = 'Missing';
        statusEl.className = 'dbadge badge-warn';
        metaEl.innerHTML = `Will create new file:<br/>${res.path}`;
      }
    }, 300);
  },

  async start() {
    const body = {
      robot_type: getVal('cal-type'),
      robot_id:   getVal('cal-id'),
      port:       getVal('cal-port'),
    };
    this.clearLog();
    const res = await api.post('/api/calibrate/start', body);
    if (!res.ok) appendLog('cal-log', `[ERROR] ${res.error}`, 'error');
  },

  async stop() {
    await api.post('/api/process/calibrate/stop');
    setTimeout(() => {
      this.checkFile();
      this.refreshFiles();
    }, 1500);
  },

  async sendInput() {
    const el  = document.getElementById('cal-stdin');
    await api.post('/api/process/calibrate/input', { text: el.value });
    appendLog('cal-log', `> ${el.value}`, 'info');
    el.value = '';
  },

  clearLog() { 
    document.getElementById('cal-log').innerHTML = ''; 
    MotorTable.clear();
  },

  syncBtn() {
    const running = state.procStatus.calibrate;
    document.getElementById('cal-start-btn').classList.toggle('hidden', running);
    document.getElementById('cal-stop-btn').classList.toggle('hidden',  !running);
  },

  async refreshArms() {
    const data = await api.get('/api/devices');
    const el   = document.getElementById('cal-arms-list');
    renderArmList(el, data.arms);
    // Auto-fill port with first detected arm
    if (data.arms.length && !getVal('cal-port')) {
      setVal('cal-port', data.arms[0].path);
    }
  },

  async refreshFiles() {
    const res = await api.get('/api/calibrate/list');
    this.cachedFiles = res.files || [];
    this.renderFiles();
  },

  renderFiles() {
    const el = document.getElementById('cal-file-list');
    const filter = document.getElementById('cal-file-filter')?.value || 'all';

    if (!this.cachedFiles.length) {
      el.innerHTML = '<div class="device-item"><span class="dname muted" style="color:var(--text2)">No calibration files found</span></div>';
      return;
    }

    const filtered = filter === 'all' 
      ? this.cachedFiles 
      : this.cachedFiles.filter(f => f.guessed_type === filter);

    if (!filtered.length) {
      el.innerHTML = '<div class="device-item"><span class="dname muted" style="color:var(--text2)">No files for selected type</span></div>';
      return;
    }

    let html = '';
    if (filter === 'all') {
      const groups = {};
      for (const f of filtered) {
        if (!groups[f.guessed_type]) groups[f.guessed_type] = [];
        groups[f.guessed_type].push(f);
      }
      for (const [gtype, files] of Object.entries(groups)) {
        html += `<div style="font-size:10px; color:var(--text2); margin:12px 0 6px 4px; text-transform:uppercase; letter-spacing:0.8px; font-weight:600;">${gtype}</div>`;
        html += files.map(f => this._fileCard(f)).join('');
      }
    } else {
      html += filtered.map(f => this._fileCard(f)).join('');
    }
    el.innerHTML = html;
  },

  _fileCard(f) {
    return `
      <div class="device-item" style="cursor:pointer; flex-wrap:wrap; position:relative; margin-bottom:4px; padding-right:50px;" onclick="CalibrateTab.selectFile('${f.id}', '${f.guessed_type}')">
        <span class="dot green"></span>
        <div style="flex:1;">
          <div class="dname">${f.id}</div>
          <div class="dsub">${f.modified}</div>
        </div>
        <div style="position:absolute; right:12px; top:12px; display:flex; gap:4px;">
          <button class="btn-xs" style="color:var(--red); border:1px solid rgba(248,81,73,0.3);" onclick="event.stopPropagation(); CalibrateTab.deleteFile('${f.id}', '${f.guessed_type}')">Del</button>
        </div>
      </div>
    `;
  },

  selectFile(id, guessedType) {
    setVal('cal-id', id);
    setVal('cal-type', guessedType);
    this.checkFile();
  },

  async deleteFile(id, guessedType) {
    if (!confirm(`Are you sure you want to delete calibration file for '${id}'?`)) return;
    
    const res = await fetch(`/api/calibrate/file?robot_type=${guessedType}&robot_id=${id}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      await this.refreshFiles();
      this.checkFile();
    } else {
      const data = await res.json();
      alert(`Failed to delete: ${data.error}`);
    }
  }
};

document.getElementById('cal-stdin').addEventListener('keydown', e => {
  if (e.key === 'Enter') CalibrateTab.sendInput();
});

/* ═══════════════════════════════════════════════════════════════════════════════
   DEVICE SETUP TAB
══════════════════════════════════════════════════════════════════════════════ */
const DeviceSetupTab = {
  cameras:     [],
  assignments: {},   // kernels → role

  async refresh() {
    const data = await api.get('/api/devices');
    state.devices = data;
    this.cameras = data.cameras;
    // Restore assignments from current symlinks
    this.assignments = {};
    for (const cam of data.cameras) {
      this.assignments[cam.kernels] = cam.symlink || '(none)';
    }
    this.renderGrid();
  },

  renderGrid() {
    const el = document.getElementById('device-cameras-grid');
    if (!this.cameras.length) {
      el.innerHTML = '<p class="muted">No cameras detected.</p>';
      return;
    }
    el.innerHTML = this.cameras.map((cam, i) => {
      const roles  = ['(none)', 'top_cam_1', 'top_cam_2', 'top_cam_3', 'follower_cam_1', 'follower_cam_2'];
      const curRole = this.assignments[cam.kernels] || '(none)';
      const opts    = roles.map(r => `<option value="${r}" ${r === curRole ? 'selected' : ''}>${r}</option>`).join('');
      return `<div class="cam-card">
        <div class="cam-preview-wrap" id="cam-wrap-${i}" onclick="DeviceSetupTab.togglePreview(${i}, '${cam.device}')">
          <span class="play-hint">▶ Click to preview</span>
        </div>
        <div class="cam-info">
          <div class="cam-name">/dev/${cam.device}</div>
          <div class="cam-meta">port: ${cam.kernels || '?'} · ${cam.model}</div>
          <label>Assign role</label>
          <select onchange="DeviceSetupTab.assign('${cam.kernels}', this.value)">${opts}</select>
        </div>
      </div>`;
    }).join('');
  },

  togglePreview(idx, device) {
    const wrap = document.getElementById(`cam-wrap-${idx}`);
    const existing = wrap.querySelector('img');
    if (existing) {
      // Stop stream
      existing.src = '';
      wrap.innerHTML = '<span class="play-hint">▶ Click to preview</span>';
    } else {
      wrap.innerHTML = `<img src="/stream/${device}" alt="stream" />`;
    }
  },

  assign(kernels, role) {
    if (kernels) this.assignments[kernels] = role;
  },

  toggleRulesPanel() {
    const panel = document.getElementById('rules-advanced-panel');
    const icon = document.getElementById('rules-toggle-icon');
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      icon.textContent = '▼';
      this.previewRules();
    } else {
      panel.style.display = 'none';
      icon.textContent = '▶';
    }
  },

  async previewRules() {
    const res = await api.post('/api/rules/preview', { assignments: this.assignments });
    document.getElementById('rules-preview').textContent = res.content;
    document.getElementById('rules-status').textContent  = '';
    document.getElementById('rules-status').className    = 'rules-status';
  },

  async applyRules() {
    await this.previewRules();
    const el  = document.getElementById('rules-status');
    el.textContent = 'Applying…';
    const res = await api.post('/api/rules/apply', { assignments: this.assignments });
    if (res.ok) {
      el.textContent = '✓ Assignments applied successfully (udev reloaded).';
      el.className   = 'rules-status ok';
      el.style.color = 'var(--green)';
      setTimeout(() => { el.textContent = ''; this.refresh(); }, 2500);
    } else {
      el.textContent = `✗ Error: ${res.error}`;
      el.className   = 'rules-status err';
      el.style.color = 'var(--red)';
    }
  },

  async showCurrent() {
    const res = await api.get('/api/rules/current');
    document.getElementById('rules-preview').textContent = res.content;
    document.getElementById('rules-status').textContent  = '';
    document.getElementById('rules-status').className    = 'rules-status';
  },

  async loadStreamSettings() {
    const s = await api.get('/api/camera_settings');
    document.getElementById('cam-codec').value = s.codec || 'MJPG';
    document.getElementById('cam-resolution').value = `${s.width}x${s.height}`;
    document.getElementById('cam-fps').value = String(s.fps || 30);
    const q = s.jpeg_quality || 70;
    document.getElementById('cam-jpeg-quality').value = q;
    document.getElementById('cam-quality-val').textContent = q;
  },

  async applyStreamSettings() {
    const [w, h] = document.getElementById('cam-resolution').value.split('x').map(Number);
    const body = {
      codec:        document.getElementById('cam-codec').value,
      width:        w,
      height:       h,
      fps:          parseInt(document.getElementById('cam-fps').value, 10),
      jpeg_quality: parseInt(document.getElementById('cam-jpeg-quality').value, 10),
    };
    const el = document.getElementById('cam-settings-status');
    el.textContent = 'Applying…';
    const res = await api.post('/api/camera_settings', body);
    if (res.ok) {
      el.textContent = '✓ Applied — streams restarting';
      setTimeout(() => { el.textContent = ''; }, 3000);
    } else {
      el.textContent = '✗ Failed';
    }
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MOTOR SETUP TAB
══════════════════════════════════════════════════════════════════════════════ */
const MotorSetupTab = {
  async start() {
    const body = {
      robot_type: getVal('ms-type'),
      port:       getVal('ms-port'),
    };
    this.clearLog();
    const res = await api.post('/api/motor_setup/start', body);
    if (!res.ok) appendLog('ms-log', `[ERROR] ${res.error}`, 'error');
  },

  async stop() {
    await api.post('/api/process/motor_setup/stop');
  },

  async sendInput() {
    const el = document.getElementById('ms-stdin');
    await api.post('/api/process/motor_setup/input', { text: el.value });
    appendLog('ms-log', `> ${el.value}`, 'info');
    el.value = '';
  },

  clearLog() { document.getElementById('ms-log').innerHTML = ''; },

  syncBtn() {
    const running = state.procStatus.motor_setup;
    document.getElementById('ms-start-btn').classList.toggle('hidden', running);
    document.getElementById('ms-stop-btn').classList.toggle('hidden',  !running);
  },

  async refreshArms() {
    const data = await api.get('/api/devices');
    const el   = document.getElementById('cal-arms-list');
    renderArmList(el, data.arms);
    if (data.arms.length && !getVal('cal-port')) {
      setVal('cal-port', data.arms[0].path);
    }
  },

  async refreshFiles() {
    const res = await api.get('/api/calibrate/list');
    const el = document.getElementById('cal-file-list');
    if (!res.files || !res.files.length) {
      el.innerHTML = '<div class="device-item"><span class="dname muted">No calibration files found</span></div>';
      return;
    }
    el.innerHTML = res.files.map(f => `
      <div class="device-item" style="cursor:pointer; flex-wrap:wrap; position:relative;" onclick="CalibrateTab.selectFile('${f.id}', '${f.guessed_type}')">
        <span class="dot green"></span>
        <div style="flex:1;">
          <div class="dname">${f.id}</div>
          <div class="dsub">${f.modified}</div>
        </div>
        <button class="btn-xs" style="position:absolute; right:12px; top:12px;">Load</button>
      </div>
    `).join('');
  },

  selectFile(id, guessedType) {
    setVal('cal-id', id);
    setVal('cal-type', guessedType);
    this.checkFile();
  }
};

document.getElementById('ms-stdin').addEventListener('keydown', e => {
  if (e.key === 'Enter') MotorSetupTab.sendInput();
});

/* ─── Shared helpers ─────────────────────────────────────────────────────────── */
function getVal(id) {
  return document.getElementById(id)?.value ?? '';
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

function appendLog(logId, text, kind = 'stdout') {
  const el = document.getElementById(logId);
  if (!el) return;
  const line = document.createElement('div');
  line.className  = `line-${kind}`;
  line.textContent = text;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function renderFeeds(containerId, cameras) {
  const el = document.getElementById(containerId);
  if (!cameras.length) { el.innerHTML = ''; return; }
  el.innerHTML = cameras.map(c => {
    const vidName = c.path.replace('/dev/', '');
    return `<div class="feed-card">
      <img src="/stream/${vidName}" alt="${c.name}" loading="lazy" />
      <div class="feed-label">${c.name} — /dev/${vidName}</div>
    </div>`;
  }).join('');
}

function renderArmList(el, arms) {
  if (!arms.length) { el.innerHTML = '<div class="device-item"><span class="dname" style="color:var(--text2)">No arm ports found</span></div>'; return; }
  el.innerHTML = arms.map(a =>
    `<div class="device-item" onclick="setVal('${el.closest('section').id === 'tab-calibrate' ? 'cal-port' : 'ms-port'}', '${a.path}')" style="cursor:pointer">
      <span class="dot ${a.symlink ? 'green' : 'yellow'}"></span>
      <div>
        <div class="dname">${a.symlink || a.device}</div>
        <div class="dsub">${a.path}</div>
      </div>
    </div>`
  ).join('');
}

/* ─── Init ───────────────────────────────────────────────────────────────────── */
(async () => {
  WS.connect();
  await loadConfig();
  StatusTab.refresh();
})();
