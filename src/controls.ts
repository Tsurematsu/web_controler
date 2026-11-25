export type Direction = 'up' | 'down' | 'left' | 'right';
export type ControlBehavior = 'hold' | 'toggle';
export type LineEnding = '\n' | '\r\n' | '';

export interface ControlVariables {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface SignalConfig {
  up: string;
  down: string;
  left: string;
  right: string;
  stop: string;
  lineEnding: LineEnding;
}

export const DEFAULT_SIGNALS: SignalConfig = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  stop: 'stop',
  lineEnding: '\n',
};

export const SINGLE_CHAR_SIGNALS: SignalConfig = {
  up: 'F',
  down: 'B',
  left: 'L',
  right: 'R',
  stop: 'S',
  lineEnding: '\n',
};

// Variables de estado de los controles direccionales
export let up = false;
export let down = false;
export let left = false;
export let right = false;

export function getControlVariables(): ControlVariables {
  return { up, down, left, right };
}

export function setDirectionVariable(direction: Direction, active: boolean): ControlVariables {
  switch (direction) {
    case 'up':
      up = active;
      break;
    case 'down':
      down = active;
      break;
    case 'left':
      left = active;
      break;
    case 'right':
      right = active;
      break;
  }
  return getControlVariables();
}

export function setOnlyDirectionVariable(direction: Direction | null): ControlVariables {
  up = direction === 'up';
  down = direction === 'down';
  left = direction === 'left';
  right = direction === 'right';
  return getControlVariables();
}

export function resetControlVariables(): ControlVariables {
  up = false;
  down = false;
  left = false;
  right = false;
  return getControlVariables();
}

export function getActiveDirection(): Direction | null {
  if (up) return 'up';
  if (down) return 'down';
  if (left) return 'left';
  if (right) return 'right';
  return null;
}

export function formatSignal(action: Direction | 'stop', config: SignalConfig): string {
  return `${config[action]}${config.lineEnding}`;
}
