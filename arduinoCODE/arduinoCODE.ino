/*
 * Controlador Arduino Uno + HC-05 + Motor Control Shield (L293D / 74HC595)
 * Compatible con la aplicación web de control Bluetooth (directorio padre).
 *
 * Protocolo de la web (9600 baud, fin de línea \n o \r\n):
 *   - Preset por defecto: up, down, left, right, stop
 *   - Preset 1 carácter:  F, B, L, R, S
 *   - Respuestas hacia la web: READY, OK:up, OK:down, OK:left, OK:right, OK:stop
 *
 * Conexiones HC-05 -> Arduino Uno:
 *   VCC    -> 5V
 *   GND    -> GND
 *   TXD    -> Uno D10 (RX de SoftwareSerial)
 *   RXD    -> Uno D9  (TX de SoftwareSerial; usar divisor de voltaje 1kΩ/2kΩ a 3.3V)
 *   EN/KEY -> Sin conectar (modo datos normal a 9600 baud)
 *
 * Conexiones Motor Control Shield (L293D) -> Arduino Uno:
 *   Uno D4  -> Shield pin 4  (DIR_CLK   - 74HC595 SHCP)
 *   Uno D7  -> Shield pin 7  (DIR_EN    - 74HC595 OE, activo en LOW)
 *   Uno D8  -> Shield pin 8  (DIR_SER   - 74HC595 DS)
 *   Uno D12 -> Shield pin 12 (DIR_LATCH - 74HC595 STCP)
 *   Uno D11 -> Shield pin 11 (PWM de M1 - Motor Izquierdo)
 *   Uno D5  -> Shield pin 5  (PWM de M3 - Motor Derecho)
 *   + GND común y alimentación 5V / fuente externa de motores en el shield.
 */

#include <SoftwareSerial.h>

// ===================== PINES HC-05 =====================
// SoftwareSerial(rxPin, txPin):
//   rxPin (D10) recibe desde TXD del HC-05
//   txPin (D9)  envía hacia RXD del HC-05
const uint8_t BT_RX_PIN = 10; // Conectado a HC-05 TXD
const uint8_t BT_TX_PIN = 9;  // Conectado a HC-05 RXD

SoftwareSerial btSerial(BT_RX_PIN, BT_TX_PIN);

// ============ PINES MOTOR CONTROL SHIELD (74HC595 + L293D) ============
const uint8_t DIR_CLK   = 4;  // Shield pin 4  (DIR_CLK)
const uint8_t DIR_EN    = 7;  // Shield pin 7  (DIR_EN, LOW = habilitado)
const uint8_t DIR_SER   = 8;  // Shield pin 8  (DIR_SER)
const uint8_t DIR_LATCH = 12; // Shield pin 12 (DIR_LATCH)

const uint8_t PWM_M1    = 11; // Shield pin 11 (PWM de M1)
const uint8_t PWM_M3    = 5;  // Shield pin 5  (PWM de M3)

// Posiciones de bits en el registro de desplazamiento 74HC595 del shield L293D
const uint8_t MOTOR1_A = 2;
const uint8_t MOTOR1_B = 3;
const uint8_t MOTOR3_A = 5;
const uint8_t MOTOR3_B = 7;

// ===================== AJUSTES DE MOTORES =====================
const uint8_t VELOCIDAD_AVANCE = 200; // 0 a 255
const uint8_t VELOCIDAD_GIRO   = 180; // 0 a 255

// Cambia a true si algún motor gira al revés respecto a tu montaje físico
const bool INVERTIR_M1 = false; // M1 = Motor Izquierdo
const bool INVERTIR_M3 = false; // M3 = Motor Derecho

// Estados de dirección de motor (usamos uint8_t para máxima compatibilidad con Arduino IDE)
const uint8_t MOTOR_DETENER  = 0;
const uint8_t MOTOR_ADELANTE = 1;
const uint8_t MOTOR_ATRAS    = 2;

// Estado actual de los 8 bits del 74HC595
uint8_t latchState = 0;

// Variables de estado de dirección (sincronizadas con la web)
bool up    = false;
bool down  = false;
bool left  = false;
bool right = false;

// Buffers de recepción serial independientes (HC-05 y USB)
String cmdBT  = "";
String cmdUSB = "";
const uint8_t MAX_CMD_LEN = 32;

// ===================== FUNCIONES DEL SHIELD =====================
void actualizarShiftRegister() {
  digitalWrite(DIR_LATCH, LOW);
  shiftOut(DIR_SER, DIR_CLK, MSBFIRST, latchState);
  digitalWrite(DIR_LATCH, HIGH);
}

void setBitMotor(uint8_t bitA, uint8_t bitB, uint8_t dir, bool invertir) {
  if (invertir) {
    if (dir == MOTOR_ADELANTE) {
      dir = MOTOR_ATRAS;
    } else if (dir == MOTOR_ATRAS) {
      dir = MOTOR_ADELANTE;
    }
  }

  switch (dir) {
    case MOTOR_ADELANTE:
      bitSet(latchState, bitA);
      bitClear(latchState, bitB);
      break;
    case MOTOR_ATRAS:
      bitClear(latchState, bitA);
      bitSet(latchState, bitB);
      break;
    case MOTOR_DETENER:
    default:
      bitClear(latchState, bitA);
      bitClear(latchState, bitB);
      break;
  }
}

void configurarMotores(
  uint8_t dirM1, uint8_t velM1,
  uint8_t dirM3, uint8_t velM3
) {
  setBitMotor(MOTOR1_A, MOTOR1_B, dirM1, INVERTIR_M1);
  setBitMotor(MOTOR3_A, MOTOR3_B, dirM3, INVERTIR_M3);
  actualizarShiftRegister();

  analogWrite(PWM_M1, dirM1 == MOTOR_DETENER ? 0 : velM1);
  analogWrite(PWM_M3, dirM3 == MOTOR_DETENER ? 0 : velM3);
}

void avanzar() {
  configurarMotores(MOTOR_ADELANTE, VELOCIDAD_AVANCE, MOTOR_ADELANTE, VELOCIDAD_AVANCE);
}

void retroceder() {
  configurarMotores(MOTOR_ATRAS, VELOCIDAD_AVANCE, MOTOR_ATRAS, VELOCIDAD_AVANCE);
}

void girarIzquierda() {
  configurarMotores(MOTOR_ATRAS, VELOCIDAD_GIRO, MOTOR_ADELANTE, VELOCIDAD_GIRO);
}

void girarDerecha() {
  configurarMotores(MOTOR_ADELANTE, VELOCIDAD_GIRO, MOTOR_ATRAS, VELOCIDAD_GIRO);
}

void detener() {
  configurarMotores(MOTOR_DETENER, 0, MOTOR_DETENER, 0);
}

// ===================== PROCESAMIENTO DE COMANDOS =====================
void procesarComando(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) {
    return;
  }

  String cmdLower = cmd;
  cmdLower.toLowerCase();

  up    = (cmdLower == "up"    || cmdLower == "f");
  down  = (cmdLower == "down"  || cmdLower == "b");
  left  = (cmdLower == "left"  || cmdLower == "l");
  right = (cmdLower == "right" || cmdLower == "r");

  if (up) {
    avanzar();
    btSerial.println("OK:up");
    Serial.println("CMD -> up");
  } else if (down) {
    retroceder();
    btSerial.println("OK:down");
    Serial.println("CMD -> down");
  } else if (left) {
    girarIzquierda();
    btSerial.println("OK:left");
    Serial.println("CMD -> left");
  } else if (right) {
    girarDerecha();
    btSerial.println("OK:right");
    Serial.println("CMD -> right");
  } else if (cmdLower == "stop" || cmdLower == "s") {
    detener();
    btSerial.println("OK:stop");
    Serial.println("CMD -> stop");
  } else {
    // Por seguridad, ante cualquier comando desconocido detenemos los motores
    detener();
    btSerial.println("OK:stop");
    Serial.print("CMD desconocido (detenido): ");
    Serial.println(cmd);
  }
}

void leerPuerto(Stream &puerto, String &buffer) {
  while (puerto.available()) {
    char c = puerto.read();
    if (c == '\n' || c == '\r') {
      if (buffer.length() > 0) {
        procesarComando(buffer);
        buffer = "";
      }
    } else if (buffer.length() < MAX_CMD_LEN) {
      buffer += c;
    }
  }
}

// ===================== SETUP Y LOOP =====================
void setup() {
  // Deshabilitar salidas del 74HC595 durante la inicialización para evitar arranques bruscos
  pinMode(DIR_EN, OUTPUT);
  digitalWrite(DIR_EN, HIGH);

  pinMode(DIR_CLK, OUTPUT);
  pinMode(DIR_SER, OUTPUT);
  pinMode(DIR_LATCH, OUTPUT);
  pinMode(PWM_M1, OUTPUT);
  pinMode(PWM_M3, OUTPUT);

  // Inicializar motores detenidos antes de habilitar el shield
  latchState = 0;
  actualizarShiftRegister();
  analogWrite(PWM_M1, 0);
  analogWrite(PWM_M3, 0);

  // Habilitar salidas del 74HC595 (DIR_EN activo en LOW)
  digitalWrite(DIR_EN, LOW);

  // Inicializar puertos seriales (9600 baud = valor por defecto de HC-05 y la web)
  Serial.begin(9600);
  btSerial.begin(9600);

  cmdBT.reserve(MAX_CMD_LEN);
  cmdUSB.reserve(MAX_CMD_LEN);

  Serial.println("Arduino Uno + HC-05 + Motor Shield (M1 & M3) listo.");
  btSerial.println("READY");
}

void loop() {
  // Lee comandos desde el módulo Bluetooth HC-05
  leerPuerto(btSerial, cmdBT);

  // También permite probar los mismos comandos desde el Monitor Serial USB
  leerPuerto(Serial, cmdUSB);
}
