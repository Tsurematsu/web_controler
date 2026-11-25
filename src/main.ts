import './style.css';
import {
  HC05BluetoothController,
  type ConnectionStatus,
  type LogEntry,
  type TransportMode,
} from './bluetooth';
import {
  DEFAULT_SIGNALS,
  SINGLE_CHAR_SIGNALS,
  formatSignal,
  getActiveDirection,
  getControlVariables,
  resetControlVariables,
  setDirectionVariable,
  setOnlyDirectionVariable,
  type ControlBehavior,
  type Direction,
  type LineEnding,
  type SignalConfig,
} from './controls';
import { ARDUINO_HC05_SKETCH } from './arduinoSketch';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('No se encontró el contenedor #app');
}

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline>
          </svg>
        </div>
        <div>
          <h1>Controlador Bluetooth HC-05</h1>
          <p>Envío de señales direccionales (<code>up</code>, <code>down</code>, <code>left</code>, <code>right</code>) hacia Arduino Uno</p>
        </div>
      </div>
      <div id="status-pill" class="status-pill" data-status="disconnected">
        <span class="status-dot"></span>
        <span id="status-text">Desconectado</span>
      </div>
    </header>

    <div id="compat-notice" class="notice hidden"></div>

    <section class="card">
      <div class="card-header">
        <span class="card-title">Conexión y Permisos Bluetooth</span>
      </div>

      <div class="connection-bar">
        <div class="field">
          <label for="transport-mode">Protocolo Bluetooth</label>
          <select id="transport-mode">
            <option value="spp" selected>HC-05 Clásico — Bluetooth SPP (Web Serial)</option>
            <option value="ble">Módulo BLE (HM-10 / AT-09) — Web Bluetooth</option>
          </select>
        </div>

        <div class="field" id="baud-field">
          <label for="baud-rate">Baud Rate (HC-05)</label>
          <select id="baud-rate">
            <option value="9600" selected>9600 (Modo datos HC-05)</option>
            <option value="19200">19200</option>
            <option value="38400">38400 (Modo AT HC-05)</option>
            <option value="57600">57600</option>
            <option value="115200">115200</option>
          </select>
        </div>

        <button id="connect-btn" class="btn btn-primary" type="button">
          Conectar Bluetooth HC-05
        </button>
        <button id="disconnect-btn" class="btn btn-danger" type="button" hidden>
          Desconectar
        </button>
      </div>

      <p class="helper-text" id="protocol-help">
        El módulo <strong>HC-05</strong> utiliza Bluetooth Clásico (SPP). Empareja primero el HC-05 en tu sistema operativo (PIN habitual: <code>1234</code> o <code>0000</code>, en modo datos normal a 9600 baud) y luego pulsa <strong>Conectar Bluetooth HC-05</strong> para otorgar permisos en el navegador (Chrome / Edge / Opera).
      </p>
    </section>

    <main class="main-grid">
      <section class="card">
        <div class="card-header">
          <span class="card-title">Panel de Control Direccional</span>
          <span class="helper-text">Teclado: <span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> o Flechas</span>
        </div>

        <div class="dpad-wrapper">
          <div class="dpad" role="group" aria-label="Controles de movimiento">
            <button id="btn-up" class="pad-btn pad-up" type="button" data-direction="up" aria-label="Avanzar">
              <span class="arrow">▲</span>
              <span class="label">Avanzar</span>
              <span class="var-tag">up</span>
            </button>

            <button id="btn-left" class="pad-btn pad-left" type="button" data-direction="left" aria-label="Izquierda">
              <span class="arrow">◀</span>
              <span class="label">Izquierda</span>
              <span class="var-tag">left</span>
            </button>

            <button id="btn-stop" class="pad-btn pad-stop" type="button" aria-label="Detener">
              <span class="arrow">■</span>
              <span class="label">Detener</span>
              <span class="var-tag">stop</span>
            </button>

            <button id="btn-right" class="pad-btn pad-right" type="button" data-direction="right" aria-label="Derecha">
              <span class="arrow">▶</span>
              <span class="label">Derecha</span>
              <span class="var-tag">right</span>
            </button>

            <button id="btn-down" class="pad-btn pad-down" type="button" data-direction="down" aria-label="Retroceder">
              <span class="arrow">▼</span>
              <span class="label">Retroceder</span>
              <span class="var-tag">down</span>
            </button>
          </div>

          <div class="vars-grid" aria-live="polite">
            <div id="var-up" class="var-chip">up<span>false</span></div>
            <div id="var-down" class="var-chip">down<span>false</span></div>
            <div id="var-left" class="var-chip">left<span>false</span></div>
            <div id="var-right" class="var-chip">right<span>false</span></div>
          </div>

          <div class="control-options">
            <span>Modo de pulsación:</span>
            <div class="segmented" role="group" aria-label="Modo de pulsación">
              <button id="mode-hold" type="button" class="selected">Mantener (Hold)</button>
              <button id="mode-toggle" type="button">Fijo (Toggle)</button>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <span class="card-title">Señales y Monitor Serial</span>
          <button id="clear-log-btn" class="btn btn-secondary btn-sm" type="button">Limpiar</button>
        </div>

        <div class="preset-row">
          <button id="preset-vars" class="btn btn-secondary btn-sm" type="button">Preset: up / down / left / right</button>
          <button id="preset-chars" class="btn btn-secondary btn-sm" type="button">Preset: F / B / L / R / S</button>
        </div>

        <div class="signal-grid">
          <div class="field">
            <label for="sig-up">up (Avanzar)</label>
            <input id="sig-up" type="text" value="up" maxlength="16" />
          </div>
          <div class="field">
            <label for="sig-down">down (Retroceder)</label>
            <input id="sig-down" type="text" value="down" maxlength="16" />
          </div>
          <div class="field">
            <label for="sig-left">left (Izquierda)</label>
            <input id="sig-left" type="text" value="left" maxlength="16" />
          </div>
          <div class="field">
            <label for="sig-right">right (Derecha)</label>
            <input id="sig-right" type="text" value="right" maxlength="16" />
          </div>
          <div class="field">
            <label for="sig-stop">stop (Detener)</label>
            <input id="sig-stop" type="text" value="stop" maxlength="16" />
          </div>
          <div class="field">
            <label for="sig-eol">Fin de línea</label>
            <select id="sig-eol">
              <option value="lf" selected>\\n (LF)</option>
              <option value="crlf">\\r\\n (CRLF)</option>
              <option value="none">Ninguno</option>
            </select>
          </div>
        </div>

        <div id="console-log" class="console-box" aria-live="polite"></div>
      </section>
    </main>

    <details class="arduino-card">
      <summary>
        <span>Código de ejemplo para Arduino Uno + HC-05 (clic para desplegar)</span>
        <span class="helper-text">arduino/hc05_controller.ino</span>
      </summary>
      <div class="code-toolbar">
        <span class="helper-text">Carga este sketch en tu Arduino Uno para recibir <code>up</code>, <code>down</code>, <code>left</code>, <code>right</code> y <code>stop</code> por el módulo HC-05.</span>
        <button id="copy-sketch-btn" class="btn btn-secondary btn-sm" type="button">Copiar código Arduino</button>
      </div>
      <pre class="code-block"><code id="arduino-code"></code></pre>
    </details>
  </div>
`;

// Referencias DOM
const statusPill = document.querySelector<HTMLDivElement>('#status-pill')!;
const statusText = document.querySelector<HTMLSpanElement>('#status-text')!;
const compatNotice = document.querySelector<HTMLDivElement>('#compat-notice')!;
const transportModeSelect = document.querySelector<HTMLSelectElement>('#transport-mode')!;
const baudField = document.querySelector<HTMLDivElement>('#baud-field')!;
const baudRateSelect = document.querySelector<HTMLSelectElement>('#baud-rate')!;
const protocolHelp = document.querySelector<HTMLParagraphElement>('#protocol-help')!;
const connectBtn = document.querySelector<HTMLButtonElement>('#connect-btn')!;
const disconnectBtn = document.querySelector<HTMLButtonElement>('#disconnect-btn')!;
const clearLogBtn = document.querySelector<HTMLButtonElement>('#clear-log-btn')!;
const consoleLog = document.querySelector<HTMLDivElement>('#console-log')!;
const modeHoldBtn = document.querySelector<HTMLButtonElement>('#mode-hold')!;
const modeToggleBtn = document.querySelector<HTMLButtonElement>('#mode-toggle')!;
const presetVarsBtn = document.querySelector<HTMLButtonElement>('#preset-vars')!;
const presetCharsBtn = document.querySelector<HTMLButtonElement>('#preset-chars')!;
const copySketchBtn = document.querySelector<HTMLButtonElement>('#copy-sketch-btn')!;
const arduinoCodeEl = document.querySelector<HTMLElement>('#arduino-code')!;

const btnStop = document.querySelector<HTMLButtonElement>('#btn-stop')!;
const dirButtons: Record<Direction, HTMLButtonElement> = {
  up: document.querySelector<HTMLButtonElement>('#btn-up')!,
  down: document.querySelector<HTMLButtonElement>('#btn-down')!,
  left: document.querySelector<HTMLButtonElement>('#btn-left')!,
  right: document.querySelector<HTMLButtonElement>('#btn-right')!,
};

const varChips: Record<Direction, HTMLDivElement> = {
  up: document.querySelector<HTMLDivElement>('#var-up')!,
  down: document.querySelector<HTMLDivElement>('#var-down')!,
  left: document.querySelector<HTMLDivElement>('#var-left')!,
  right: document.querySelector<HTMLDivElement>('#var-right')!,
};

const sigInputs = {
  up: document.querySelector<HTMLInputElement>('#sig-up')!,
  down: document.querySelector<HTMLInputElement>('#sig-down')!,
  left: document.querySelector<HTMLInputElement>('#sig-left')!,
  right: document.querySelector<HTMLInputElement>('#sig-right')!,
  stop: document.querySelector<HTMLInputElement>('#sig-stop')!,
  eol: document.querySelector<HTMLSelectElement>('#sig-eol')!,
};

arduinoCodeEl.textContent = ARDUINO_HC05_SKETCH;

let behavior: ControlBehavior = 'hold';
let signalConfig: SignalConfig = { ...DEFAULT_SIGNALS };
let lastDispatchedAction: Direction | 'stop' | null = null;

function appendLog(entry: LogEntry): void {
  const row = document.createElement('div');
  row.className = `log-line log-${entry.direction}`;

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = `[${entry.timestamp}]`;

  const tag = document.createElement('span');
  tag.className = 'log-tag';
  tag.textContent = entry.direction.toUpperCase();

  const msg = document.createElement('span');
  msg.textContent = entry.message;

  row.append(time, tag, msg);
  consoleLog.appendChild(row);
  consoleLog.scrollTop = consoleLog.scrollHeight;

  // Limitar historial a 150 líneas
  while (consoleLog.children.length > 150) {
    consoleLog.removeChild(consoleLog.firstChild!);
  }
}

function updateStatusUI(status: ConnectionStatus, deviceName: string | null): void {
  statusPill.dataset.status = status;
  if (status === 'connected') {
    statusText.textContent = deviceName ?? 'Conectado';
    connectBtn.hidden = true;
    disconnectBtn.hidden = false;
  } else if (status === 'connecting') {
    statusText.textContent = 'Conectando...';
    connectBtn.disabled = true;
  } else if (status === 'error') {
    statusText.textContent = 'Error de conexión';
    connectBtn.hidden = false;
    connectBtn.disabled = false;
    disconnectBtn.hidden = true;
  } else {
    statusText.textContent = 'Desconectado';
    connectBtn.hidden = false;
    connectBtn.disabled = false;
    disconnectBtn.hidden = true;
  }
}

const btController = new HC05BluetoothController({
  onStatusChange: updateStatusUI,
  onLog: appendLog,
});

function checkBrowserSupport(): void {
  const support = HC05BluetoothController.getBrowserSupport();
  const warnings: string[] = [];

  if (!support.secureContext) {
    warnings.push(
      'Esta página no está en un contexto seguro (HTTPS o localhost). Los navegadores bloquean los permisos de Bluetooth y Serial en HTTP.'
    );
  }
  if (!support.serial && !support.bluetooth) {
    warnings.push(
      'Tu navegador actual no expone Web Serial ni Web Bluetooth. Abre esta página en Google Chrome, Microsoft Edge u Opera.'
    );
  }

  if (warnings.length > 0) {
    compatNotice.innerHTML = `<strong>Aviso de compatibilidad:</strong> ${warnings.join(' ')}`;
    compatNotice.classList.remove('hidden');
  }
}

function syncVariablesUI(): void {
  const vars = getControlVariables();
  (['up', 'down', 'left', 'right'] as Direction[]).forEach((dir) => {
    const active = vars[dir];
    dirButtons[dir].classList.toggle('active', active);
    varChips[dir].classList.toggle('on', active);
    const valSpan = varChips[dir].querySelector('span');
    if (valSpan) {
      valSpan.textContent = String(active);
    }
  });
}

function readSignalConfigFromUI(): SignalConfig {
  const eolMap: Record<string, LineEnding> = {
    lf: '\n',
    crlf: '\r\n',
    none: '',
  };
  return {
    up: sigInputs.up.value || 'up',
    down: sigInputs.down.value || 'down',
    left: sigInputs.left.value || 'left',
    right: sigInputs.right.value || 'right',
    stop: sigInputs.stop.value || 'stop',
    lineEnding: eolMap[sigInputs.eol.value] ?? '\n',
  };
}

function applySignalPreset(preset: SignalConfig): void {
  signalConfig = { ...preset };
  sigInputs.up.value = preset.up;
  sigInputs.down.value = preset.down;
  sigInputs.left.value = preset.left;
  sigInputs.right.value = preset.right;
  sigInputs.stop.value = preset.stop;
  sigInputs.eol.value = preset.lineEnding === '\r\n' ? 'crlf' : preset.lineEnding === '' ? 'none' : 'lf';
}

async function dispatchAction(action: Direction | 'stop', force = false): Promise<void> {
  if (!force && lastDispatchedAction === action) return;
  lastDispatchedAction = action;

  signalConfig = readSignalConfigFromUI();
  const payload = formatSignal(action, signalConfig);

  if (btController.getStatus() === 'connected') {
    await btController.send(payload);
  } else {
    appendLog({
      direction: 'info',
      message: `[Sin conexión] Variable ${action === 'stop' ? 'stop (todas en false)' : `${action} = true`} → señal lista: "${payload.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
    });
  }
}

function activateDirection(direction: Direction): void {
  if (behavior === 'toggle') {
    const current = getControlVariables()[direction];
    if (current) {
      resetControlVariables();
      syncVariablesUI();
      void dispatchAction('stop', true);
    } else {
      setOnlyDirectionVariable(direction);
      syncVariablesUI();
      void dispatchAction(direction, true);
    }
    return;
  }

  // Modo Hold: mantiene el estado de la variable activa mientras se presiona
  setDirectionVariable(direction, true);
  syncVariablesUI();
  void dispatchAction(direction, true);
}

function releaseDirection(direction: Direction): void {
  if (behavior !== 'hold') return;
  const current = getControlVariables()[direction];
  if (!current) return;

  setDirectionVariable(direction, false);
  syncVariablesUI();

  const remaining = getActiveDirection();
  if (remaining) {
    void dispatchAction(remaining, true);
  } else {
    void dispatchAction('stop', true);
  }
}

function triggerStop(): void {
  resetControlVariables();
  syncVariablesUI();
  btnStop.classList.add('active');
  setTimeout(() => btnStop.classList.remove('active'), 160);
  void dispatchAction('stop', true);
}

// Eventos de conexión
transportModeSelect.addEventListener('change', () => {
  const mode = transportModeSelect.value as TransportMode;
  baudField.hidden = mode !== 'spp';
  if (mode === 'spp') {
    protocolHelp.innerHTML =
      'El módulo <strong>HC-05</strong> utiliza Bluetooth Clásico (SPP). Empareja primero el HC-05 en tu sistema operativo (PIN habitual: <code>1234</code> o <code>0000</code>, en modo datos normal a 9600 baud) y luego pulsa <strong>Conectar Bluetooth HC-05</strong> para otorgar permisos en el navegador (Chrome / Edge / Opera).';
  } else {
    protocolHelp.innerHTML =
      'El modo <strong>Web Bluetooth (BLE)</strong> solicita permisos GATT para módulos Bluetooth Low Energy (HM-10, HC-08, AT-09, ESP32). Nota: el HC-05 clásico no usa BLE.';
  }
});

connectBtn.addEventListener('click', () => {
  const mode = transportModeSelect.value as TransportMode;
  const baudRate = Number(baudRateSelect.value) || 9600;
  void btController.connect(mode, baudRate);
});

disconnectBtn.addEventListener('click', () => {
  resetControlVariables();
  syncVariablesUI();
  lastDispatchedAction = null;
  void btController.disconnect();
});

clearLogBtn.addEventListener('click', () => {
  consoleLog.innerHTML = '';
});

// Eventos D-Pad (soporte táctil y ratón con Pointer Events)
(['up', 'down', 'left', 'right'] as Direction[]).forEach((direction) => {
  const btn = dirButtons[direction];

  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    try {
      btn.setPointerCapture(ev.pointerId);
    } catch {
      // Ignorar si no es capturable
    }
    activateDirection(direction);
  });

  const handleRelease = (ev: PointerEvent) => {
    ev.preventDefault();
    releaseDirection(direction);
  };

  btn.addEventListener('pointerup', handleRelease);
  btn.addEventListener('pointercancel', handleRelease);
  btn.addEventListener('lostpointercapture', () => releaseDirection(direction));
  btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
});

btnStop.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  triggerStop();
});

// Soporte de teclado (WASD y Flechas)
const keyToDirection: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

window.addEventListener('keydown', (ev) => {
  const target = ev.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
    return;
  }

  if (ev.code === 'Space') {
    ev.preventDefault();
    triggerStop();
    return;
  }

  const direction = keyToDirection[ev.code];
  if (!direction) return;
  ev.preventDefault();
  if (ev.repeat) return;
  activateDirection(direction);
});

window.addEventListener('keyup', (ev) => {
  const direction = keyToDirection[ev.code];
  if (!direction) return;
  ev.preventDefault();
  releaseDirection(direction);
});

// Si la ventana pierde el foco en modo Hold, detener por seguridad
window.addEventListener('blur', () => {
  if (behavior === 'hold' && getActiveDirection() !== null) {
    triggerStop();
  }
});

// Modo Hold / Toggle
modeHoldBtn.addEventListener('click', () => {
  behavior = 'hold';
  modeHoldBtn.classList.add('selected');
  modeToggleBtn.classList.remove('selected');
  resetControlVariables();
  syncVariablesUI();
});

modeToggleBtn.addEventListener('click', () => {
  behavior = 'toggle';
  modeToggleBtn.classList.add('selected');
  modeHoldBtn.classList.remove('selected');
});

// Presets de señal
presetVarsBtn.addEventListener('click', () => {
  applySignalPreset(DEFAULT_SIGNALS);
  appendLog({
    direction: 'info',
    message: 'Señales configuradas a: up, down, left, right, stop.',
    timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
  });
});

presetCharsBtn.addEventListener('click', () => {
  applySignalPreset(SINGLE_CHAR_SIGNALS);
  appendLog({
    direction: 'info',
    message: 'Señales configuradas a caracteres únicos: F, B, L, R, S.',
    timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
  });
});

// Copiar sketch Arduino
copySketchBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ARDUINO_HC05_SKETCH);
    copySketchBtn.textContent = '¡Copiado!';
    setTimeout(() => {
      copySketchBtn.textContent = 'Copiar código Arduino';
    }, 1800);
  } catch {
    appendLog({
      direction: 'error',
      message: 'No se pudo copiar al portapapeles. Selecciona el código manualmente.',
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
    });
  }
});

// Inicialización
checkBrowserSupport();
syncVariablesUI();
appendLog({
  direction: 'info',
  message: 'Interfaz lista. Pulsa "Conectar Bluetooth HC-05" para solicitar permisos del navegador.',
  timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
});
