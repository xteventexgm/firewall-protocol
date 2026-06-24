# Catálogo de roles — Firewall Protocol

Referencia de los **44 roles** del juego: equipo, acción nocturna y victoria.  
Sincronizado con `backend-server/src/types/roles.types.ts`, `player-metadata.types.ts`, `roleInfo.ts` y `VictoryChecker.ts`.

- Condiciones de fin de partida → [`WIN_CONDITIONS.md`](./WIN_CONDITIONS.md)
- Índice del proyecto → [`README.md`](./README.md)

**Reparto:** en cada partida se asignan roles **sin repetir** dentro de cada bando hasta agotar el catálogo disponible para ese tamaño de mesa (ver `balance.ts`).

---

## Leyenda de equipos

| Equipo | ID | Victoria de bando |
|--------|-----|-------------------|
| **System** | `system` | 0 hackers vivos, 0 caóticos vivos, ≥1 System vivo |
| **Black Hat** | `black_hat` | 0 System vivos; si quedan caóticos, hackers > caóticos |
| **Caótico** | `chaotic` | Victoria **solitaria** propia (salvo Zero-Day, que puede heredar bando) |

> Los caóticos **no** suman al conteo hacker vs system para victoria de bando.

---

## Resumen — 44 roles

### System (16)

| Rol | Acción nocturna | Victoria |
|-----|-----------------|----------|
| **SysAdmin** | — (día: parche emergencia 1×/partida) | System |
| **Analista SOC** | `scan` | System |
| **Antivirus** | `protect` o `cure` | System |
| **Pentester** | `pentester_kill` | System |
| **Honeypot** | `honeypot_drag` | System |
| **Deep Freeze** | `freeze` | System |
| **Enrutador BGP** | `bgp_swap` | System |
| **Detector IDS** | `ids_watch` | System |
| **Parcheador** | `patch_harden` | System |
| **Analista Forense** | `forensic_trace` | System |
| **Nodo de Respaldo** | `backup_mark` (1×/partida) | System |
| **Cazador de Amenazas** | `threat_hunt` | System |
| **Respondedor de Incidentes** | `incident_clear` | System |
| **Cortafuegos WAF** | `waf_block` | System |
| **Intel de Amenazas** | `intel_pulse` (1×/partida) | System |
| **Monitor de Integridad** | `ally_verify` | System |

### Black Hat (14)

| Rol | Acción nocturna | Victoria |
|-----|-----------------|----------|
| **DDoS Operator** | `hacker_vote` (voto ×2) | Black Hat |
| **Rootkit** | `hacker_vote` | Black Hat |
| **Ransomware** | `ransomware` | Black Hat |
| **Spyware** | `spy` | Black Hat |
| **Phisher** | `phisher_redirect` | Black Hat |
| **Fuerza Bruta** | `brute_force` (1×/partida) | Black Hat |
| **Sniffer** | `team_probe` | Black Hat |
| **Kit de Exploits** | `exploit_strip` | Black Hat |
| **Implante Backdoor** | `backdoor_plant` | Black Hat |
| **Movimiento Lateral** | `lateral_probe` | Black Hat |
| **Keylogger** | `vote_trace` | Black Hat |
| **Escáner de Vulnerabilidades** | `vuln_scan` | Black Hat |
| **Robador de Credenciales** | `cred_probe` | Black Hat |
| **Proxy MitM** | `mitm_hijack` | Black Hat |

### Caótico (14)

| Rol | Acción nocturna | Victoria |
|-----|-----------------|----------|
| **Troll** | `troll_provoke` | Solitaria: expulsado por votación |
| **Gusano** | `worm_infect` | Solitaria: único vivo |
| **Minero de Cripto** | `mine_crypto` o `crypto_bribe` | Solitaria: único vivo |
| **Zero-Day** | `zero_day_assume` (1×/partida) | Hereda bando asumido / solitaria |
| **Filtrador** | `data_leak` | Sin bando; desempate tardío |
| **Sombra** | `shadow_mask` | Sin bando; desempate tardío |
| **Bomba Lógica** | `logic_bomb` | Sin bando; desempate tardío |
| **Envenenador DNS** | `dns_spoof` | Sin bando; desempate tardío |
| **Nota de Rescate** | `ransom_note` | Sin bando; desempate tardío |
| **Dropper** | `rigged_payload` | Sin bando; desempate tardío |
| **Saboteador** | `jam_hacker` | Sin bando; desempate tardío |
| **Ruido Blanco** | `noise_burst` | Sin bando; desempate tardío |
| **Espejismo** | `mirage_cloak` | Sin bando; desempate tardío |
| **Router del Caos** | `chaos_route` | Sin bando; desempate tardío |

---

## System (Blue Team) — detalle

Victoria compartida: **0 hackers vivos**, **0 caóticos vivos**, al menos un System en pie.

### SysAdmin
Administrador de infraestructura. Sin acción nocturna. En **VOTACIÓN**, parche de emergencia **1×/partida**: anula por completo el voto de un jugador.

### Analista SOC
`scan`: clasifica un nodo — SEGURO (System), SOSPECHOSO (caótico) o MALICIOSO (Black Hat). No revela rol exacto. Rootkit y nodos enmascarados (Sombra, etc.) pueden aparecer SEGURO.

### Antivirus
Una acción por noche: `protect` (bloquea kill directo o consenso hacker) **o** `cure` (elimina infección de Gusano). No repetir mismo nodo dos noches seguidas con la misma acción. Kit de Exploits puede anular protect esa noche.

### Pentester
`pentester_kill`: kill autorizado (1 uso en mesas ≤7, 2 en 8+). Si matas a un aliado System, mueres por culpa.

### Honeypot
`honeypot_drag`: marcas un nodo. Si mueres de noche, arrastras al marcado (ignora protect Antivirus).

### Deep Freeze
`freeze`: el objetivo no ejecuta acciones nocturnas esta ronda.

### Enrutador BGP
`bgp_swap`: intercambias destinos de dos nodos; ataques a uno impactan al otro.

### Detector IDS
`ids_watch`: vigilas un nodo; si recibe visitas hostiles esa noche, alerta privada con conteo (sin roles).

### Parcheador
`patch_harden`: el objetivo no puede morir por **consenso hacker** esta noche (kills directos sí aplican).

### Analista Forense
`forensic_trace`: desglose de bajas de la última noche por bando y si el nodo estuvo entre víctimas.

### Nodo de Respaldo
`backup_mark` **1×/partida**: si el marcado moriría esta noche por ataque, sobrevive una vez. No bloquea infección madura.

### Cazador de Amenazas
`threat_hunt`: AMENAZA (hacker/caótico) o LIMPIO (System/enmascarado). Sin rol exacto.

### Respondedor de Incidentes
`incident_clear`: levanta silencio de Ransomware/DDoS sobre un jugador.

### Cortafuegos WAF
`waf_block`: el objetivo no puede ser infectado por Gusano esta noche.

### Intel de Amenazas
`intel_pulse` **1×/partida**: conteo privado de vivos por bando.

### Monitor de Integridad
`ally_verify`: ¿el objetivo es del **mismo bando** que tú? (sí/no).

---

## Black Hat (Red Team) — detalle

Victoria compartida: **0 System vivos**; si quedan caóticos, **hackers > caóticos**.

Todos los hackers reciben `hacker_team` con la lista de compañeros.

### DDoS Operator
`hacker_vote` con peso **×2**. Si el objetivo del consenso sobrevive, queda silenciado al día siguiente.

### Rootkit
`hacker_vote`. Siempre aparece SEGURO en escaneos SOC.

### Ransomware
`ransomware`: silencia hasta el día siguiente. Cooldown tras cada uso según tamaño de sala.

### Spyware
`spy`: visitantes al objetivo y tipo de actividad (sin roles).

### Phisher
`phisher_redirect`: redirige el voto diurno de A hacia B en la próxima VOTACIÓN.

### Fuerza Bruta
`brute_force`: kill directo **una vez por partida** (sin consenso).

### Sniffer
`team_probe`: equipo del objetivo (System / Black Hat / Caótico).

### Kit de Exploits
`exploit_strip`: protect del Antivirus no aplica sobre el objetivo esta noche.

### Implante Backdoor
`backdoor_plant`: +1 peso en consenso hacker contra el objetivo.

### Movimiento Lateral
`lateral_probe`: ¿el objetivo es System? (sí/no).

### Keylogger
`vote_trace`: a quién votó el objetivo en la última votación.

### Escáner de Vulnerabilidades
`vuln_scan`: ¿comprometido? (infectado o silenciado).

### Robador de Credenciales
`cred_probe`: DEFENSA_CRÍTICA vs PERFIL_ESTÁNDAR.

### Proxy MitM
`mitm_hijack`: fuerzas el `hacker_vote` de un hacker hacia tu objetivo.

### Consenso hacker
Mayoría estricta del peso de votos (`hacker_vote`; DDoS ×2, Backdoor +1 al objetivo). Kill sujeto a protect, inmunidad Gusano, escudos Minero, etc.

---

## Caótico — detalle

Sin victoria de **equipo** caótico. Cada rol compite por condición solitaria o desempate tardío (`chaotic_stalemate_break`).

### Troll
`troll_provoke`: mensaje anónimo en feed. **Gana solo si te expulsan por votación.**

### Gusano
`worm_infect`: infección (2 noches sin cure). Primera kill directa contra ti falla (inmunidad consumible). **Gana si eres el único vivo.**

### Minero de Cripto
`mine_crypto` (+1 escudo, máx. 3) o `crypto_bribe` (gasta 1 escudo → kill). Escudos iniciales 2 (≤7p) o 3 (8+). **Gana si eres el único vivo.**

### Zero-Day
`zero_day_assume` **1×/partida**: asumes rol de jugador eliminado. Ganas con el bando del rol asumido o solitario si aplica.

### Filtrador
`data_leak`: filtra el **equipo** de un jugador al feed público (anónimo).

### Sombra
`shadow_mask`: un nodo aparece SEGURO en scan SOC esta noche.

### Bomba Lógica
`logic_bomb`: si el objetivo actúa la noche siguiente, muere antes de resolver su acción.

### Envenenador DNS
`dns_spoof`: en la próxima votación, el voto del objetivo se desvía al azar a otro nodo. Tú apareces SEGURO en scan esa noche.

### Nota de Rescate
`ransom_note`: silencia + mensaje anónimo en feed.

### Dropper
`rigged_payload`: la próxima noche el objetivo ignora protect, cure y respaldo. Escudos caóticos (máx. 2).

### Saboteador
`jam_hacker`: inmune a consenso hacker esta noche, SEGURO en scan, sobrevive un linchamiento al día siguiente.

### Ruido Blanco
`noise_burst`: mensaje anónimo de ruido (sin victoria solitaria).

### Espejismo
`mirage_cloak`: te enmascaras — scan SOC te ve SEGURO esta noche.

### Router del Caos
`chaos_route`: ataques al origen impactan al colateral (unidireccional, distinto de BGP).

---

## Acciones nocturnas — índice completo

| Tipo | Rol(es) |
|------|---------|
| `scan` | Analista SOC |
| `protect` / `cure` | Antivirus |
| `pentester_kill` | Pentester |
| `honeypot_drag` | Honeypot |
| `freeze` | Deep Freeze |
| `bgp_swap` | Enrutador BGP |
| `ids_watch` | Detector IDS |
| `patch_harden` | Parcheador |
| `forensic_trace` | Analista Forense |
| `backup_mark` | Nodo de Respaldo |
| `threat_hunt` | Cazador de Amenazas |
| `incident_clear` | Respondedor de Incidentes |
| `waf_block` | Cortafuegos WAF |
| `intel_pulse` | Intel de Amenazas |
| `ally_verify` | Monitor de Integridad |
| `hacker_vote` | DDoS, Rootkit |
| `ransomware` | Ransomware |
| `spy` | Spyware |
| `phisher_redirect` | Phisher |
| `brute_force` | Fuerza Bruta |
| `team_probe` | Sniffer |
| `exploit_strip` | Kit de Exploits |
| `backdoor_plant` | Implante Backdoor |
| `lateral_probe` | Movimiento Lateral |
| `vote_trace` | Keylogger |
| `vuln_scan` | Escáner de Vulnerabilidades |
| `cred_probe` | Robador de Credenciales |
| `mitm_hijack` | Proxy MitM |
| `worm_infect` | Gusano |
| `zero_day_assume` | Zero-Day |
| `troll_provoke` | Troll |
| `mine_crypto` / `crypto_bribe` | Minero de Cripto |
| `data_leak` | Filtrador |
| `shadow_mask` | Sombra |
| `logic_bomb` | Bomba Lógica |
| `dns_spoof` | Envenenador DNS |
| `ransom_note` | Nota de Rescate |
| `rigged_payload` | Dropper |
| `jam_hacker` | Saboteador |
| `noise_burst` | Ruido Blanco |
| `mirage_cloak` | Espejismo |
| `chaos_route` | Router del Caos |

---

## Escalado por tamaño de mesa

| Parámetro | Mesas ≤7 | Mesas 8+ |
|-----------|----------|----------|
| Usos Pentester | 1 | 2 |
| Escudos Minero (inicio) | 2 | 3 |
| Escudos Minero (tope) | 3 | 3 |
| Cooldown Ransomware | 2 noches (≤9p) | 1 noche (10+p) |
| Hackers | 1 cada 4 jugadores | 1 cada 3 (desde 9p) |
| Caóticos | 1 cada 5 jugadores | igual |
| Límite días (desempate) | 8 | 10 |

---

## Archivos fuente

| Archivo | Contenido |
|---------|-----------|
| `backend-server/src/types/roles.types.ts` | Catálogo 44 roles y `playerGuide` |
| `backend-server/src/types/player-metadata.types.ts` | `ROLE_NIGHT_ACTIONS` |
| `backend-server/src/game/roleInfo.ts` | Textos al móvil (`role_assigned`) |
| `backend-server/src/game/RuleEngine.ts` | Resolución de habilidades |
| `backend-server/src/game/VictoryChecker.ts` | Victorias |
| `backend-server/src/game/balance.ts` | Reparto y ratios |
| `WIN_CONDITIONS.md` | Matriz win/lose |

---

*44 roles · 3 equipos · catálogo ampliado GDD — sincronizado con backend Firewall Protocol.*
