# Condiciones de victoria y derrota — Firewall Protocol

Referencia para jugar, diseñar partidas y testear. Refleja la implementación en `backend-server/src/game/VictoryChecker.ts` y `balance.ts`.

Índice del proyecto: [`README.md`](./README.md) · Cambios: [`CHANGELOG.md`](./CHANGELOG.md)

---

## Resumen rápido

| Bando | Cómo gana | Cómo pierde |
|-------|-----------|-------------|
| **System** (azul) | 0 hackers **y** 0 caóticos vivos (con ≥1 system vivo) | Black Hat cumple su condición |
| **Black Hat** (rojo) | 0 system vivos, ≥1 hacker, y si quedan caóticos entonces **hackers > caóticos** | 0 hackers vivos |
| **Caótico — solitarios** | Condición propia del rol (ver abajo) | No alcanzan su win antes de que gane un bando u otro solitario |
| **Caótico — Zero-Day** | Hereda victoria de bando al asumir rol; o desempate caótico tardío | Igual que el bando asumido, o eliminado antes |

> **Los caóticos cuentan como tercer bando.** System debe eliminar hackers **y** caóticos. Black Hat debe eliminar todo el System y dominar a los caóticos si aún quedan.

---

## Orden de evaluación (`checkAnyWin`)

El servidor comprueba en este orden; la **primera condición que se cumple** termina la partida:

1. **Victoria solitaria** (`checkSoloWin`)
2. **Victoria de bando** (`checkTeamWin`)
3. **Desempate por límite de días** (`checkStalemateBreak`)

---

## Cuándo se comprueba el fin de partida

| Momento | Fase / acción | Contexto especial |
|---------|---------------|-------------------|
| **Al eliminar por voto** | Durante `resolveVotes` en VOTACIÓN | `justVotedOut` → victoria del Troll; victoria de bando inmediata |
| Tras **honeypot drag** | Misma resolución de voto | Si el arrastre elimina al último hacker, fin inmediato |
| Tras resolver **NOCHE** | `advancePhase` desde NOCHE | Tras kills, infecciones, silencios |
| En **VERIFICACION** | Host avanza fase | Primero `checkAnyWin`; si no hay ganador, pasa a NOCHE |
| Recuperación | Cualquier fase ≠ NOCHE | Partidas atascadas (ej. solo Gusano vivo en DÍA) |

> **Importante:** al cumplirse la condición de victoria en votación, la partida pasa a `FIN` **sin** requerir una segunda fase de verificación manual.

Evento socket al terminar: `gameOver(roomId, winner, soloWinner)`.

- Victoria de bando: `winner` = `'system'` \| `'black_hat'`, `soloWinner` = `null`
- Victoria solitaria: `winner` = `null`, `soloWinner` = `{ playerId, role, reason }`

---

## Victoria de bando — System (azul)

### Condición de victoria

```
hackers_vivos === 0  AND  caóticos_vivos === 0  AND  system_vivos >= 1
```

### Casos que cuentan como victoria System

| # | Situación | Ejemplo (vivos) | Notas |
|---|-----------|-----------------|-------|
| S1 | Sin hackers ni caóticos | 0H, 3S, 0C | Victoria System |
| S1b | Hackers eliminados pero quedan caóticos | 0H, 3S, 1C | **Continúa** — deben eliminar caóticos |
| S2 | Zero-Day asumió rol System y no quedan hackers | 0H, 2S (uno es ex–Zero-Day) | Tras `zero_day_assume`, cuenta como System |
| S3 | Desempate por días — sin hackers, con System | 0H, 2S, 1C al día 8+ | `dayNumber >= stalemateDayLimit` |
| S4 | Desempate por días — empate o ventaja System | 1H, 2S al día límite | En empate numérico gana System (contención) |
| S5 | Desempate por días — System por delante | 1H, 3S al día límite | System gana por desempate |

### Derrota System

| # | Situación | Ejemplo (vivos) |
|---|-----------|-----------------|
| SD1 | Hackers superan numéricamente | 2H, 1S |
| SD2 | Desempate por días — hackers por delante | 2H, 1S al día límite |
| SD3 | Victoria solitaria ajena antes (Troll, Gusano, Minero) | — |

### Roles que ganan con System

SysAdmin, Analista SOC, Antivirus, Pentester, Honeypot, Deep Freeze, Enrutador BGP.

---

## Victoria de bando — Black Hat (rojo)

### Condición de victoria

```
system_vivos === 0  AND  hackers_vivos >= 1  AND  (caóticos_vivos === 0  OR  hackers_vivos > caóticos_vivos)
```

Ya **no** basta con `hackers > system` (ej. 5H/4S/2C **continúa**).

### Casos que cuentan como victoria Black Hat

| # | Situación | Ejemplo (vivos) | Notas |
|---|-----------|-----------------|-------|
| B1 | System eliminado, dominio sobre caóticos | 3H, 0S, 1C | Válido (3 > 1) |
| B1b | System eliminado pero caóticos dominan | 2H, 0S, 3C | **Continúa** |
| B2 | Un solo hacker vs cero system | 1H, 0S, 2C | Válido si todos los azules murieron |
| B3 | Zero-Day asumió rol hacker y hay mayoría | 2H (uno ex–Zero-Day), 1S | Cuenta en `hackers_vivos` |
| B4 | Desempate por días — hackers por delante | 2H, 1S al día límite | Solo si `dayNumber >= límite` |

### Derrota Black Hat

| # | Situación | Ejemplo (vivos) |
|---|-----------|-----------------|
| BD1 | Cero hackers vivos | 0H, 2S |
| BD2 | Empate numérico sin llegar al límite de días | 1H, 1S, 1C → partida continúa |
| BD3 | Desempate por días con empate o ventaja System | 1H, 1S al día 8/10 |
| BD4 | Victoria solitaria ajena | Gusano último en pie, etc. |

### Roles que ganan con Black Hat

DDoS Operator, Rootkit, Ransomware, Spyware, Phisher.

---

## Victorias solitarias — Caóticos

Solo hay **4 roles caóticos**. Tres tienen win solitario “natural”; Zero-Day depende del rol asumido o del desempate tardío.

### Troll — expulsión por votación

| Campo | Valor |
|-------|-------|
| **Condición** | El Troll es **votado y eliminado** en fase VOTACION |
| **Cuándo se evalúa** | Inmediatamente tras el voto, con `justVotedOut` |
| **`reason` socket** | `troll_banned` |
| **Único en pie** | No gana por quedar solo; debe ser **expulsado** |

**Test manual:** VOTACION → mayoría vota al Troll → `gameOver` con `soloWinner.role = Troll`.

---

### Gusano — último en pie

| Campo | Valor |
|-------|-------|
| **Condición** | Exactamente **1 jugador vivo** y su rol es Gusano |
| **Cuándo se evalúa** | Tras noche, voto o avance de fase |
| **`reason` socket** | `worm_last_standing` |
| **Prioridad** | Se evalúa **antes** que victoria de bando |

**Test manual:** Eliminar a todos excepto al Gusano → cualquier `checkAnyWin` posterior debe cerrar con solitario Gusano.

**Notas de juego:** Primera kill directa nocturna falla (`isWormImmune`). Infección madura a las 2 noches; solo `cure` la frena (no `protect`).

---

### Minero de Cripto — último en pie

| Campo | Valor |
|-------|-------|
| **Condición** | Exactamente **1 jugador vivo** y su rol es Minero de Cripto |
| **Cuándo se evalúa** | Tras noche, voto o avance de fase |
| **`reason` socket** | `miner_survived` |
| **Sin acción nocturna** | Debe sobrevivir hasta quedar solo |

**Test manual:** Mesa reducida a 1 Minero → victoria solitaria aunque queden 0 hackers y 0 system.

**Nota:** Si gana un **bando** antes (ej. 1H + 1 Minero → Black Hat gana), el Minero **pierde** aunque tenga escudos.

---

### Zero-Day — sin win solitario propio

| Campo | Valor |
|-------|-------|
| **Win natural** | Ninguno mientras mantenga rol Zero-Day |
| **Tras `zero_day_assume`** | Hereda equipo y habilidades del muerto; gana con **System** o **Black Hat** según rol asumido |
| **Win solitario indirecto** | Si asume Gusano o Minero y queda **último en pie** → aplica regla del rol asumido |
| **Desempate caótico** | Ver sección siguiente |

**Test manual assume → bando:** Zero-Day asume Pentester eliminado → 0 hackers, ≥1 system → victoria System.

**Test manual assume → bando rojo:** Zero-Day asume Rootkit → 2H, 1S → victoria Black Hat.

---

### Desempate caótico — `chaotic_stalemate_break`

Solo aplica si:

- `dayNumber >= stalemateDayLimit` (8 días en mesas ≤7 jugadores iniciales, 10 en mesas 8+)
- **0 hackers vivos**
- **0 system vivos**
- Quedan solo caóticos (o mezcla sin H ni S)

**Prioridad de ganador** (primer rol presente en vivos):

1. Gusano  
2. Minero de Cripto  
3. Troll  
4. Zero-Day  

| Campo | Valor |
|-------|-------|
| **`reason` socket** | `chaotic_stalemate_break` |

**Test manual:** Simular día 8+, 0H/0S, vivos = Troll + Zero-Day → gana **Troll** (prioridad 3 vs 4).

---

## Límite de días (desempate forzado)

| Mesa inicial | Días máximos (`dayNumber`) |
|--------------|----------------------------|
| 5–7 jugadores | **8** |
| 8–15 jugadores | **10** |

Tras el límite, si no hubo win solitario ni de bando antes:

| Hackers vs System (vivos) | Ganador |
|---------------------------|---------|
| `H > S` | Black Hat |
| `H <= S` (empate o System adelante) | System |
| `H = 0`, `S = 0`, solo caóticos | Solitario por prioridad caótica |
| `H = 0`, `S > 0` | System |

---

## Partida **no** termina (sigue en curso)

Útil para tests de regresión — estos estados **no** deben emitir `gameOver`:

| # | Vivientes (H / S / C) | Día | Por qué continúa |
|---|------------------------|-----|------------------|
| N1 | 1 / 1 / 1 | < límite | Empate H=S (`1 > 1` es falso) |
| N2 | 1 / 3 / 1 | < límite | Aún hay hackers vivos |
| N3 | 2 / 2 / 0 | < límite | Empate H=S |
| N4 | 0 / 0 / 2 | < límite | Solo caóticos; falta límite de días o solitario |
| N5 | 1 / 1 / 0 | < límite | Empate puro sin caóticos que desbloqueen |

**Contraste — sí terminan:**

| Vivientes | Resultado |
|-----------|-----------|
| 1H, 0S, 2C | Black Hat (`1 > 0`) |
| 0H, 1S, 2C | System (`0 hackers`) |
| 1H, 1S, 0C, día 8 (mesa ≤7p) | System por desempate |

---

## Matriz de referencia — conteo H vs S (sin límite de días)

Caóticos **C** no entran en la tabla. Solo importa H y S.

| H \ S | 0 | 1 | 2 | 3 |
|-------|---|---|---|---|
| **0** | —¹ | **System gana** | **System gana** | **System gana** |
| **1** | **BH gana** | Continúa (empate) | Continúa | Continúa |
| **2** | **BH gana** | **BH gana** | Continúa (empate) | Continúa |
| **3** | **BH gana** | **BH gana** | **BH gana** | Continúa (empate) |

¹ Si H=0 y S=0: solo caóticos → continúa hasta límite de días o solitario.

---

## Quién pierde cuando gana cada uno

### Gana System

| Pierden |
|---------|
| Todos los Black Hat (objetivo cumplido) |
| Caóticos solitarios que no activaron su win |
| Zero-Day sin asumir o asumiendo rol System en mesa ya perdida |

### Gana Black Hat

| Pierden |
|---------|
| Todo el System |
| Caóticos que no ganaron en solitario |
| Zero-Day caótico sin camino propio |

### Gana solitario (Troll / Gusano / Minero / desempate caótico)

| Pierden |
|---------|
| **Todos** los demás bandos y jugadores |
| Es una victoria **exclusiva** — no hay segundo lugar |

---

## Casos borde documentados para QA

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| QA-01 | Troll votado en VOTACION | `soloWinner`, `reason: troll_banned` |
| QA-02 | Gusano único vivo tras noche | `soloWinner`, `reason: worm_last_standing` |
| QA-03 | Minero único vivo | `soloWinner`, `reason: miner_survived` |
| QA-04 | 0H, 3S, Gusano vivo | `winner: system` (caótico irrelevante) |
| QA-05 | 2H, 1S, Minero vivo | `winner: black_hat` |
| QA-06 | 1H, 1S, cualquier C | Partida continúa |
| QA-07 | 1H, 1S, día 8 (mesa 7p) | `winner: system` (desempate) |
| QA-08 | 2H, 1S, día 10 (mesa 10p) | `winner: black_hat` (desempate) |
| QA-09 | 0H, 0S, Troll+Zero-Day, día 8+ | `soloWinner` Troll, `chaotic_stalemate_break` |
| QA-10 | Zero-Day asume Antivirus, luego 0H | `winner: system` |
| QA-11 | Zero-Day asume DDoS, 2H 1S | `winner: black_hat` |
| QA-12 | Zero-Day asume Gusano, queda solo | `soloWinner` Gusano |
| QA-13 | Pentester último vivo (system) | `winner: system` (0H, 1S) |
| QA-14 | Rootkit último vivo (hacker) | `winner: black_hat` (1H, 0S) |
| QA-15 | Empate voto + Troll no votado | No win Troll; según H/S o continúa |

---

## Reparto inicial (contexto para tests)

| Jugadores | Hackers (≈) | Caóticos (≈) | System (≈) |
|-----------|-------------|--------------|------------|
| 5 | 1 | 1 | 3 |
| 6 | 1 | 1 | 4 |
| 7 | 1 | 1 | 5 |
| 8 | 2 | 1 | 5 |
| 9 | 3 | 1 | 5 |
| 10 | 3 | 2 | 5 |
| 12 | 4 | 2 | 6 |
| 15 | 5 | 3 | 7 |

Fórmulas: `hackers = max(1, floor(n / playersPerBlackHat))` con ratio 4 (≤8p) o 3 (9+p); `caóticos = floor(n / 5)`; resto System.

---

## Códigos `reason` en `soloWinner`

| `reason` | Rol típico | Significado |
|----------|------------|-------------|
| `troll_banned` | Troll | Expulsado por votación diurna |
| `worm_last_standing` | Gusano | Único superviviente |
| `miner_survived` | Minero de Cripto | Único superviviente |
| `chaotic_stalemate_break` | Cualquier caótico | Desempate tras límite de días, solo caóticos |

---

## Archivos fuente

| Archivo | Responsabilidad |
|---------|-----------------|
| `backend-server/src/game/VictoryChecker.ts` | Toda la lógica de fin de partida |
| `backend-server/src/game/balance.ts` | `stalemateDayLimit`, escalado de mesa |
| `backend-server/src/game/Room.ts` | Cuándo se invoca `checkAnyWin` |
| `backend-server/src/types/roles.types.ts` | Equipos y roles |
| `backend-server/SOCKET_CONTRACT.md` | Evento `gameOver` |

---

*Última sincronización con backend: VictoryChecker + balance (desempate por días, infección Gusano 2 noches, Zero-Day con metadata heredada).*
