export {};

export interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: string | number;
}

export interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
  allowedBluetoothServiceClassIds?: Array<string | number>;
}

export interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: string;
}

export interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
}

export interface Serial extends EventTarget {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

export interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly uuid: string;
  readonly value?: DataView;
  readonly properties: {
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    indicate: boolean;
  };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}

export interface BluetoothRemoteGATTService {
  readonly uuid: string;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

export interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

export interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
}

export interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  optionalServices?: Array<string | number>;
}

export interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

declare global {
  interface Navigator {
    readonly serial?: Serial;
    readonly bluetooth?: Bluetooth;
  }
}
