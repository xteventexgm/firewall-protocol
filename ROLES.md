# Catálogo de roles — Firewall Protocol

Referencia de los **16 roles** del juego: equipo, descripción, habilidades y condición de victoria.  
Sincronizado con `backend-server/src/types/roles.types.ts`, `roleInfo.ts` y `VictoryChecker.ts`.

- Condiciones de fin de partida → [`WIN_CONDITIONS.md`](./WIN_CONDITIONS.md)
- Índice del proyecto → [`README.md`](./README.md)

---

## Leyenda de equipos

| Equipo | ID backend | Color | Victoria |
|--------|------------|-------|----------|
| **System** | `system` | Blue Team | Eliminar a todos los hackers vivos |
| **Black Hat** | `black_hat` | Red Team | Más hackers vivos que jugadores System |
| **Caótico** | `chaotic` | — | Victoria **solitaria** propia (salvo Zero-Day, que puede heredar bando) |

> Los caóticos **no cuentan** en el conteo hacker vs system para victoria de bando.

---

## Tabla general (todos los roles)

| Rol | Equipo | Acción nocturna | Acción diurna | Condición de victoria |
|-----|--------|-----------------|---------------|------------------------|
| **SysAdmin** | System | — | Debate y votación | Gana con **System** (0 hackers vivos) |
| **Analista SOC** | System | `scan` | Debate y votación | Gana con **System** |
| **Antivirus** | System | `protect` o `cure` | Debate y votación | Gana con **System** |
| **Pentester** | System | `pentester_kill` | Debate y votación | Gana con **System** |
| **Honeypot** | System | `honeypot_drag` | Debate y votación | Gana con **System** |
| **Deep Freeze** | System | `freeze` | Debate y votación | Gana con **System** |
| **Enrutador BGP** | System | `bgp_swap` | Debate y votación | Gana con **System** |
| **DDoS Operator** | Black Hat | `hacker_vote` | Debate y votación | Gana con **Black Hat** (H > S) |
| **Rootkit** | Black Hat | `hacker_vote` | Debate y votación | Gana con **Black Hat** |
| **Ransomware** | Black Hat | `ransomware` | Debate y votación | Gana con **Black Hat** |
| **Spyware** | Black Hat | `spy` | Debate y votación | Gana con **Black Hat** |
| **Phisher** | Black Hat | `phisher_redirect` | Debate y votación | Gana con **Black Hat** |
| **Troll** | Caótico | `troll_provoke` | Debate y votación | **Solitario:** ser expulsado por votación |
| **Gusano** | Caótico | `worm_infect` | Debate y votación | **Solitario:** único jugador vivo |
| **Minero de Cripto** | Caótico | `mine_crypto` **o** `crypto_bribe` | Debate y votación | **Solitario:** único jugador vivo |
| **Zero-Day** | Caótico | `zero_day_assume` | Debate y votación | Hereda victoria del **rol asumido**; o desempate caótico tardío |

---

## System (Blue Team) — 7 roles

Victoria compartida del bando:

> **0 hackers vivos** y al menos 1 jugador System vivo.  
> En empate prolongado (límite de días), gana System si `hackers ≤ system`.

---

### SysAdmin

| | |
|---|---|
| **Equipo** | System |
| **Descripción** | Administrador de infraestructura. Coordina parches, credenciales y votaciones. |
| **Noche** | Sin acción nocturna. |
| **Día** | Debate y votación para expulsar sospechosos. |
| **Pasiva** | — |
| **Victoria** | **System** — eliminar a todos los hackers. |

---

### Analista SOC

| | |
|---|---|
| **Equipo** | System |
| **Descripción** | Analista SIEM que correlaciona actividad de red sobre un nodo. |
| **Noche** | **`scan`** — escanea un jugador vivo. Resultado: **SEGURO** (System), **SOSPECHOSO** (caótico) o **MALICIOSO** (Black Hat). No revela el rol exacto. |
| **Día** | Debate y votación. |
| **Pasiva** | El Rootkit siempre aparece como SEGURO. Tras asunción Zero-Day, el scan refleja el rol asumido. |
| **Victoria** | **System**. |

---

### Antivirus

| | |
|---|---|
| **Equipo** | System |
| **Descripción** | EDR del Sistema: protección y remediación nocturna. |
| **Noche** | **`protect`** — bloquea un kill directo sobre el objetivo esta noche. **`cure`** — elimina una infección activa (p. ej. Gusano). **Una sola acción por noche** (protect **o** cure, nunca ambas). |
| **Día** | Debate y votación. |
| **Pasiva** | No repetir el mismo objetivo dos noches seguidas con la misma acción. `protect` no frena infección madura (solo `cure`). |
| **Victoria** | **System**. |

---

### Pentester

| | |
|---|---|
| **Equipo** | System |
| **Descripción** | Red team autorizado con permiso de eliminación ofensiva limitada. |
| **Noche** | **`pentester_kill`** — elimina a un jugador vivo. **1 uso** en mesas ≤7 jugadores, **2 usos** en mesas 8+. |
| **Día** | Debate y votación. |
| **Pasiva** | Si eliminas a un aliado **System**, mueres por culpa (`Pentester died of guilt`). |
| **Victoria** | **System**. |

---

### Honeypot

| | |
|---|---|
| **Equipo** | System |
| **Descripción** | Señuelo defensivo que atrae y castiga ataques. |
| **Noche** | **`honeypot_drag`** — marcas un nodo como objetivo de trampa. |
| **Día** | Debate y votación. |
| **Pasiva** | Si **mueres de noche** (kill o consenso hacker), arrastras contigo al nodo marcado. La trampa **ignora protección Antivirus**. Funciona también si te expulsan de día. |
| **Victoria** | **System**. |

---

### Deep Freeze

| | |
|---|---|
| **Equipo** | System |
| **Descripción** | Contención EDR: aislamiento de endpoint. |
| **Noche** | **`freeze`** — el objetivo no ejecuta acciones nocturnas esta ronda (respeta redirección BGP). |
| **Día** | Debate y votación. |
| **Pasiva** | — |
| **Victoria** | **System**. |

---

### Enrutador BGP

| | |
|---|---|
| **Equipo** | System |
| **Descripción** | Mitigación de enrutamiento para desviar ataques. |
| **Noche** | **`bgp_swap`** — intercambia el destino de **dos nodos** vivos (`target` + `swapWith`). Los ataques dirigidos a uno afectan al otro. |
| **Día** | Debate y votación. |
| **Pasiva** | — |
| **Victoria** | **System**. |

---

## Black Hat (Red Team) — 5 roles

Victoria compartida del bando:

> **Hackers vivos > System vivos** (estrictamente mayor; empate numérico no basta).  
> Los caóticos vivos no impiden la victoria si se cumple la condición.

Al iniciar la partida, todos los hackers reciben el evento privado **`hacker_team`** con la lista de compañeros.

---

### DDoS Operator

| | |
|---|---|
| **Equipo** | Black Hat |
| **Descripción** | Operador de botnet; refuerza el consenso nocturno del equipo rojo. |
| **Noche** | **`hacker_vote`** — vota objetivo del consenso hacker. Tu voto cuenta **×2**. |
| **Día** | Debate y votación. |
| **Pasiva** | Si hay consenso hacker sobre un objetivo y **sobrevive** el ataque, queda **silenciado** el día siguiente (no actúa ni vota). Conoces al resto de hackers. |
| **Victoria** | **Black Hat**. |

---

### Rootkit

| | |
|---|---|
| **Equipo** | Black Hat |
| **Descripción** | Implant persistente oculto ante análisis superficial. |
| **Noche** | **`hacker_vote`** — participa en el consenso hacker (mayoría simple ponderada). |
| **Día** | Debate y votación. |
| **Pasiva** | Los escaneos SOC te clasifican siempre como **SEGURO**. Conoces al resto de hackers. |
| **Victoria** | **Black Hat**. |

---

### Ransomware

| | |
|---|---|
| **Equipo** | Black Hat |
| **Descripción** | Cifrado operativo que paraliza nodos objetivo. |
| **Noche** | **`ransomware`** — silencias a un jugador hasta el **día siguiente** (no actúa de noche ni vota de día). |
| **Día** | Debate y votación. |
| **Pasiva** | **Enfriamiento** tras cada uso: **2 noches** en mesas ≤9 jugadores, **1 noche** en mesas 10+. Conoces al resto de hackers. |
| **Victoria** | **Black Hat**. |

---

### Spyware

| | |
|---|---|
| **Equipo** | Black Hat |
| **Descripción** | Interceptación de tráfico hacia un nodo objetivo. |
| **Noche** | **`spy`** — observas qué jugadores **visitaron** al objetivo y el **tipo de actividad** (`visitorActivities`). No revela roles. |
| **Día** | Debate y votación. |
| **Pasiva** | Conoces al resto de hackers. |
| **Victoria** | **Black Hat**. |

---

### Phisher

| | |
|---|---|
| **Equipo** | Black Hat |
| **Descripción** | Ingeniería social para manipular votaciones diurnas. |
| **Noche** | **`phisher_redirect`** — configuras redirección: el voto diurno del jugador A se aplica al objetivo B. |
| **Día** | Debate y votación. |
| **Pasiva** | La redirección se aplica en fase **VOTACION** y se limpia tras resolver votos. Conoces al resto de hackers. |
| **Victoria** | **Black Hat**. |

---

### Consenso hacker (DDoS, Rootkit y cualquier hacker)

Acción compartida **`hacker_vote`**:

- Cada hacker vivo vota un objetivo (DDoS ×2).
- Se necesita **mayoría estricta** del peso total (`votos > hackers_vivos / 2`).
- El objetivo consensuado recibe un kill directo nocturno (sujeto a protect, inmunidad Gusano, escudos Minero, etc.).

---

## Caótico — 4 roles

No comparten victoria de bando. Pueden **bloquear** empates hacker/system hasta el límite de días (ver `WIN_CONDITIONS.md`).

---

### Troll

| | |
|---|---|
| **Equipo** | Caótico |
| **Descripción** | Actor de desinformación; gana si la mesa cae en su provocación. |
| **Noche** | **`troll_provoke`** — deja un mensaje anónimo en el feed público del amanecer (elige entre frases predefinidas). |
| **Día** | Debate y votación. |
| **Pasiva** | — |
| **Victoria** | **Solitaria** — ser **expulsado por votación** diurna (`reason: troll_banned`). No gana por quedar único en pie. |

---

### Gusano

| | |
|---|---|
| **Equipo** | Caótico |
| **Descripción** | Malware autónomo de propagación lenta. |
| **Noche** | **`worm_infect`** / **`worm_kill`** — infectas a un jugador vivo (alias equivalentes). |
| **Día** | Debate y votación. |
| **Pasiva** | **Inmunidad:** la primera eliminación directa nocturna contra ti falla (se consume). **Infección:** el nodo cae tras **2 noches sin cura** (`cure` del Antivirus; `protect` no basta). Infección madura ignora escudos del Minero. |
| **Victoria** | **Solitaria** — ser el **único jugador vivo** (`reason: worm_last_standing`). Prioridad alta en desempate caótico tardío. |

---

### Minero de Cripto

| | |
|---|---|
| **Equipo** | Caótico |
| **Descripción** | Cryptojacking activo con economía de escudos. |
| **Noche** | **`mine_crypto`** (minar un nodo vivo → +1 escudo, máx. **3** acumulables; la víctima no recibe aviso) **o** **`crypto_bribe`** (gasta **1 escudo** → kill directo; falla si tienes 0 escudos). Una acción por noche. |
| **Día** | Debate y votación. |
| **Pasiva** | **Escudos iniciales:** **2** en mesas ≤7 jugadores, **3** en mesas 8+. Bloquean kills **directos** (consenso, Pentester, soborno ajeno, etc.). Las **infecciones maduras** sí te eliminan. |
| **Victoria** | **Solitaria** — ser el **único jugador vivo** (`reason: miner_survived`). Puede perder si un bando gana antes con otros vivos en mesa. |

---

### Zero-Day

| | |
|---|---|
| **Equipo** | Caótico *(cambia al asumir)* |
| **Descripción** | Exploit crítico de un solo uso que copia un rol eliminado. |
| **Noche** | **`zero_day_assume`** — **una vez por partida**, asumes el rol de un jugador **ya eliminado**. Heredas equipo, habilidades y metadata del rol (usos Pentester, escudos Minero, etc.). |
| **Día** | Debate y votación. |
| **Pasiva** | Tras asumir, los escaneos SOC reflejan tu **rol asumido**. Sin win solitario propio mientras sigues siendo Zero-Day puro. |
| **Victoria** | **Heredada:** gana con **System** o **Black Hat** según el rol asumido. Si asumes Gusano/Minero y quedas solo, aplica su victoria solitaria. Si solo quedan caóticos tras límite de días, puede ganar por `chaotic_stalemate_break` (prioridad 4ª). |

---

## Resumen de acciones nocturnas por tipo

| Tipo | Rol(es) | Efecto |
|------|---------|--------|
| `scan` | Analista SOC | Clasifica objetivo: safe / suspicious / malicious |
| `protect` | Antivirus | Bloquea kill directo sobre objetivo |
| `cure` | Antivirus | Elimina infección activa |
| `pentester_kill` | Pentester | Kill directo (usos limitados) |
| `honeypot_drag` | Honeypot | Marca nodo para arrastre al morir |
| `freeze` | Deep Freeze | Anula acciones nocturnas del objetivo |
| `bgp_swap` | Enrutador BGP | Intercambia destino de dos nodos |
| `hacker_vote` | DDoS, Rootkit | Voto consenso hacker (DDoS ×2) |
| `ransomware` | Ransomware | Silencia objetivo hasta día siguiente |
| `spy` | Spyware | Revela visitantes y actividades al objetivo |
| `phisher_redirect` | Phisher | Redirige voto diurno de A → B |
| `worm_infect` | Gusano | Aplica infección (2 noches hasta kill) |
| `zero_day_assume` | Zero-Day | Copia rol de jugador muerto (1×/partida) |
| `troll_provoke` | Troll | Mensaje anónimo en feed público |
| `mine_crypto` | Minero de Cripto | +1 escudo (máx. 3); objetivo no recibe aviso |
| `crypto_bribe` | Minero de Cripto | Gasta 1 escudo → kill directo |

---

## Escalado por tamaño de mesa

| Parámetro | Mesas ≤7 | Mesas 8+ |
|-----------|----------|----------|
| Usos Pentester | 1 | 2 |
| Escudos Minero (inicio) | 2 | 3 |
| Escudos Minero (tope acumulable) | 3 | 3 |
| Cooldown Ransomware (≤9 / 10+) | 2 noches | 1 noche (solo 10+) |
| Hackers (ratio) | 1 cada 4 jugadores | 1 cada 3 (desde 9p) |
| Límite días (desempate) | 8 | 10 |

Detalle en `backend-server/src/game/balance.ts`.

---

## Archivos fuente

| Archivo | Contenido |
|---------|-----------|
| `backend-server/src/types/roles.types.ts` | Catálogo y `playerGuide` |
| `backend-server/src/types/player-metadata.types.ts` | Mapa acción ↔ rol |
| `backend-server/src/game/roleInfo.ts` | Textos enviados al móvil |
| `backend-server/src/game/RuleEngine.ts` | Resolución de habilidades |
| `backend-server/src/game/VictoryChecker.ts` | Condiciones de victoria |
| `WIN_CONDITIONS.md` | Matriz completa win/lose y casos QA |

---

*16 roles · 3 equipos · sincronizado con backend Firewall Protocol.*
