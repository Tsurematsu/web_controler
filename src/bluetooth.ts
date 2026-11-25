import type {
  BluetoothDevice,
  BluetoothRemoteGATTCharacteristic,
  SerialPort,
} from './types/web-apis';

export type TransportMode = 'spp' | 'ble';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LogEntry {
  direction: 'tx' | 'rx' | 'info' | 'error';
  message: string;
  timestamp: string;
}

export interface TransportCallbacks {
  onStatusChange: (status: ConnectionStatus, deviceName: string | null) => void;
  onLog: (entry: LogEntry) => void;
}

// UUID estándar del perfil SPP (Serial Port Profile) usado por el módulo Bluetooth Clásico HC-05
const HC05_SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

// Servicios UART BLE comunes (HM-10 / HC-08 / AT-09 / Nordic UART / Bluno)
const BLE_UART_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '0000dfb0-0000-1000-8000-00805f9b34fb',
];

function nowTime(): string {
  return new Date().toLocaleTimeString('es-ES', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export class HC05BluetoothController {
  private mode: TransportMode = 'spp';
  private status: ConnectionStatus = 'disconnected';
  private deviceName: string | null = null;

  // Web Serial (HC-05 SPP)
  private serialPort: SerialPort | null = null;
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private serialReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readingSerial = false;

  // Web Bluetooth (BLE)
  private bleDevice: BluetoothDevice | null = null;
  private bleWriteChar: BluetoothRemoteGATTCharacteristic | null = null;

  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly callbacks: TransportCallbacks;

  constructor(callbacks: TransportCallbacks) {
    this.callbacks = callbacks;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getMode(): TransportMode {
    return this.mode;
  }

  public getDeviceName(): string | null {
    return this.deviceName;
  }

  public static getBrowserSupport(): { serial: boolean; bluetooth: boolean; secureContext: boolean } {
    return {
      serial: typeof navigator !== 'undefined' && 'serial' in navigator && Boolean(navigator.serial),
      bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator && Boolean(navigator.bluetooth),
      secureContext: typeof window !== 'undefined' && window.isSecureContext,
    };
  }

  private emitLog(direction: LogEntry['direction'], message: string): void {
    this.callbacks.onLog({ direction, message, timestamp: nowTime() });
  }

  private setStatus(status: ConnectionStatus, deviceName: string | null = this.deviceName): void {
    this.status = status;
    this.deviceName = deviceName;
    this.callbacks.onStatusChange(status, deviceName);
  }

  public async connect(mode: TransportMode, baudRate: number): Promise<boolean> {
    if (this.status === 'connected' || this.status === 'connecting') {
      await this.disconnect();
    }

    this.mode = mode;
    this.setStatus('connecting', null);

    try {
      if (mode === 'spp') {
        return await this.connectSerialSPP(baudRate);
      }
      return await this.connectBLE();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('No port selected') || errMsg.includes('User cancelled')) {
        this.emitLog('info', 'Selección de dispositivo cancelada por el usuario.');
        this.setStatus('disconnected', null);
      } else {
        this.emitLog('error', `Error de conexión: ${errMsg}`);
        this.setStatus('error', null);
      }
      return false;
    }
  }

  private async connectSerialSPP(baudRate: number): Promise<boolean> {
    if (!navigator.serial) {
      throw new Error(
        'Tu navegador no soporta Web Serial API para Bluetooth SPP (HC-05). Usa Chrome, Edge u Opera en escritorio.'
      );
    }

    this.emitLog('info', 'Solicitando permiso al navegador para conectar módulo HC-05 (Bluetooth SPP)...');

    let port: SerialPort;
    try {
      port = await navigator.serial.requestPort({
        allowedBluetoothServiceClassIds: [HC05_SPP_UUID],
      });
    } catch (err) {
      // Compatibilidad con versiones de Chromium que no soportan allowedBluetoothServiceClassIds
      if (err instanceof TypeError) {
        port = await navigator.serial.requestPort();
      } else {
        throw err;
      }
    }

    await port.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });

    this.serialPort = port;
    if (port.writable) {
      this.serialWriter = port.writable.getWriter();
    }

    const info = port.getInfo();
    const label = info.bluetoothServiceClassId
      ? `HC-05 Bluetooth SPP (${baudRate} baud)`
      : `Puerto Serial / HC-05 (${baudRate} baud)`;

    port.addEventListener('disconnect', this.handleUnexpectedDisconnect);

    this.setStatus('connected', label);
    this.emitLog('info', `Conectado correctamente a ${label}.`);

    this.startSerialReadLoop(port);
    return true;
  }

  private async startSerialReadLoop(port: SerialPort): Promise<void> {
    if (!port.readable) return;
    this.readingSerial = true;
    let buffer = '';

    try {
      this.serialReader = port.readable.getReader();
      while (this.readingSerial) {
        const { value, done } = await this.serialReader.read();
        if (done) break;
        if (value) {
          buffer += this.decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.emitLog('rx', trimmed);
            }
          }
        }
      }
    } catch (err) {
      if (this.readingSerial) {
        const msg = err instanceof Error ? err.message : String(err);
        this.emitLog('error', `Lectura serial interrumpida: ${msg}`);
      }
    } finally {
      try {
        this.serialReader?.releaseLock();
      } catch {
        // Ignorar si ya fue liberado
      }
      this.serialReader = null;
    }
  }

  private async connectBLE(): Promise<boolean> {
    if (!navigator.bluetooth) {
      throw new Error(
        'Tu navegador no soporta Web Bluetooth API. Usa Chrome, Edge o Bluefy (iOS) en HTTPS o localhost.'
      );
    }

    this.emitLog('info', 'Solicitando permiso Web Bluetooth (BLE)...');
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_UART_SERVICES,
    });

    if (!device.gatt) {
      throw new Error('El dispositivo seleccionado no expone un servidor GATT BLE.');
    }

    device.addEventListener('gattserverdisconnected', this.handleUnexpectedDisconnect);

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    let writableChar: BluetoothRemoteGATTCharacteristic | null = null;
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (!writableChar && (char.properties.writeWithoutResponse || char.properties.write)) {
          writableChar = char;
        }
        if (char.properties.notify) {
          try {
            await char.startNotifications();
            char.addEventListener('characteristicvaluechanged', (ev: Event) => {
              const target = ev.target as BluetoothRemoteGATTCharacteristic;
              if (target.value) {
                const text = this.decoder.decode(target.value).trim();
                if (text) this.emitLog('rx', text);
              }
            });
          } catch {
            // Algunas características no permiten notificaciones
          }
        }
      }
    }

    if (!writableChar) {
      server.disconnect();
      throw new Error(
        'No se encontró característica UART escribible en el dispositivo BLE. Recuerda que el HC-05 clásico usa modo Bluetooth SPP (Web Serial).'
      );
    }

    this.bleDevice = device;
    this.bleWriteChar = writableChar;
    const label = device.name ? `${device.name} (BLE)` : 'Dispositivo BLE';
    this.setStatus('connected', label);
    this.emitLog('info', `Conectado a ${label}.`);
    return true;
  }

  private readonly handleUnexpectedDisconnect = (): void => {
    this.emitLog('error', 'Conexión Bluetooth perdida.');
    void this.disconnect(true);
  };

  public async send(payload: string): Promise<boolean> {
    if (this.status !== 'connected') {
      return false;
    }

    const bytes = this.encoder.encode(payload);
    try {
      if (this.mode === 'spp' && this.serialWriter) {
        await this.serialWriter.write(bytes);
      } else if (this.mode === 'ble' && this.bleWriteChar) {
        if (this.bleWriteChar.properties.writeWithoutResponse && this.bleWriteChar.writeValueWithoutResponse) {
          await this.bleWriteChar.writeValueWithoutResponse(bytes);
        } else {
          await this.bleWriteChar.writeValue(bytes);
        }
      } else {
        return false;
      }

      this.emitLog('tx', payload.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.emitLog('error', `No se pudo enviar "${payload.trim()}": ${msg}`);
      return false;
    }
  }

  public async disconnect(silent = false): Promise<void> {
    this.readingSerial = false;

    if (this.serialReader) {
      try {
        await this.serialReader.cancel();
      } catch {
        // Ignorar
      }
      this.serialReader = null;
    }

    if (this.serialWriter) {
      try {
        await this.serialWriter.close();
      } catch {
        try {
          this.serialWriter.releaseLock();
        } catch {
          // Ignorar
        }
      }
      this.serialWriter = null;
    }

    if (this.serialPort) {
      this.serialPort.removeEventListener('disconnect', this.handleUnexpectedDisconnect);
      try {
        await this.serialPort.close();
      } catch {
        // Ignorar
      }
      this.serialPort = null;
    }

    if (this.bleDevice) {
      this.bleDevice.removeEventListener('gattserverdisconnected', this.handleUnexpectedDisconnect);
      if (this.bleDevice.gatt?.connected) {
        this.bleDevice.gatt.disconnect();
      }
      this.bleDevice = null;
      this.bleWriteChar = null;
    }

    this.setStatus('disconnected', null);
    if (!silent) {
      this.emitLog('info', 'Desconectado del módulo Bluetooth.');
    }
  }
}
