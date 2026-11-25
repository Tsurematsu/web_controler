export const ARDUINO_HC05_SKETCH = `/*
 * Receptor Arduino Uno + Módulo Bluetooth HC-05 (Modo Datos / Esclavo)
 * Recibe las señales: up, down, left, right y stop (terminadas en \\n)
 *
 * Conexiones HC-05 -> Arduino Uno:
 *   VCC   -> 5V
 *   GND   -> GND
 *   TXD   -> Pin 10 (RX de SoftwareSerial)
 *   RXD   -> Pin 11 (TX de SoftwareSerial, usar divisor de voltaje 1kΩ/2kΩ a 3.3V)
 *   EN/KEY -> Sin conectar (modo datos normal; 9600 baud)
 *   STATE  -> Opcional (indica estado de conexión)
 *
 * Ejemplo con puente H L298N (ajusta los pines a tu circuito):
 */

#include <SoftwareSerial.h>

SoftwareSerial btSerial(10, 11); // RX = 10, TX = 11

// Pines del puente H (L298N)
const int IN1 = 4; // Motor Izquierdo Adelante
const int IN2 = 5; // Motor Izquierdo Atrás
const int IN3 = 6; // Motor Derecho Adelante
const int IN4 = 7; // Motor Derecho Atrás

// Variables de estado de dirección
bool up = false;
bool down = false;
bool left = false;
bool right = false;

String comando = "";

void setup() {
  Serial.begin(9600);
  btSerial.begin(9600); // Baud rate por defecto del HC-05 en modo datos

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  detener();
  Serial.println("Arduino Uno listo - Esperando comandos HC-05...");
  btSerial.println("READY");
}

void loop() {
  while (btSerial.available()) {
    char c = btSerial.read();
    if (c == '\\n' || c == '\\r') {
      comando.trim();
      if (comando.length() > 0) {
        procesarComando(comando);
      }
      comando = "";
    } else {
      comando += c;
    }
  }
}

void procesarComando(String cmd) {
  up = (cmd == "up" || cmd == "F");
  down = (cmd == "down" || cmd == "B");
  left = (cmd == "left" || cmd == "L");
  right = (cmd == "right" || cmd == "R");

  if (up) {
    avanzar();
    btSerial.println("OK:up");
  } else if (down) {
    retroceder();
    btSerial.println("OK:down");
  } else if (left) {
    girarIzquierda();
    btSerial.println("OK:left");
  } else if (right) {
    girarDerecha();
    btSerial.println("OK:right");
  } else {
    detener();
    btSerial.println("OK:stop");
  }
}

void avanzar() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

void retroceder() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}

void girarIzquierda() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

void girarDerecha() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}

void detener() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}
`;
