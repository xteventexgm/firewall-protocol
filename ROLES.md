# Catalogo Oficial de Roles - Firewall Protocol

> Documento auto-generado basado en el codigo fuente.

## ??? System (Blue Team)

### SysAdmin
**Descripcion**: Administrador del sistema

**Guia del Jugador**:
Sin acción por la noche. Durante el día, puedes usar tu Parche de emergencia (1 vez por partida): eliges a un jugador y su voto no contará para expulsar a nadie. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Analista SOC
**Descripcion**: Investigador de jugadores

**Guia del Jugador**:
Cada noche puedes investigar a un jugador. Recibirás un reporte secreto: SEGURO, SOSPECHOSO o MALICIOSO. Ojo: algunos roles avanzados pueden burlar tu escaneo. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Antivirus
**Descripcion**: Protege o cura aliados

**Guia del Jugador**:
Cada noche puedes elegir una acción: Proteger a alguien de ser eliminado, o Curar a alguien de una infección. No puedes elegir a la misma persona dos noches seguidas con la misma acción. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Pentester
**Descripcion**: Atacante aliado

**Guia del Jugador**:
Puedes eliminar a un jugador por la noche (usos limitados según el tamaño de la sala). ¡Ten cuidado! Si eliminas a un jugador de tu propio bando, tú también serás eliminado por el sistema. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Honeypot
**Descripcion**: Trampa mortal

**Guia del Jugador**:
Cada noche marcas a un jugador como tu trampa. Si los hackers te eliminan a ti esa noche, la persona que marcaste será eliminada junto contigo, sin importar si estaba protegida. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Deep Freeze
**Descripcion**: Congela turnos nocturnos

**Guia del Jugador**:
Cada noche congelas a un jugador. Todas las acciones que intente hacer esa noche serán canceladas. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Enrutador BGP
**Descripcion**: Intercambia destinos

**Guia del Jugador**:
Cada noche intercambias a dos jugadores. Cualquier acción nocturna dirigida al primero, afectará al segundo, y viceversa. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Detector IDS
**Descripcion**: Vigila a un jugador

**Guia del Jugador**:
Vigilas a un jugador cada noche. Si alguien más lo visita para atacarlo o afectarlo, recibirás una alerta secreta indicando cuántas visitas tuvo (pero no quiénes fueron). Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Parcheador
**Descripcion**: Inmunidad al voto hacker

**Guia del Jugador**:
Eliges a un jugador cada noche. Esa persona no podrá ser eliminada por la votación grupal de los hackers (pero sí por ataques letales individuales). Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Analista Forense
**Descripcion**: Rastreador de víctimas

**Guia del Jugador**:
Eliges a un jugador y recibes un reporte de la noche anterior: sabrás de qué bando eran las víctimas y si el jugador que elegiste estuvo involucrado en ellas. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Nodo de Respaldo
**Descripcion**: Otorga una vida extra

**Guia del Jugador**:
Una vez por partida, marcas a un jugador. Si iba a ser eliminado por un ataque esa noche, sobrevive gastando el respaldo. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Cazador de Amenazas
**Descripcion**: Detector de enemigos

**Guia del Jugador**:
Investigas a un jugador de noche. Sabrás si es una AMENAZA o si está LIMPIO. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Respondedor de Incidentes
**Descripcion**: Quita el silencio

**Guia del Jugador**:
Si un jugador fue silenciado (no puede votar ni hablar), lo liberas para que pueda actuar normalmente al día siguiente. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Cortafuegos WAF
**Descripcion**: Bloquea infecciones

**Guia del Jugador**:
Eliges a un jugador cada noche. Nadie podrá infectarlo esa noche (pero los ataques letales sí le afectarán). Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Intel de Amenazas
**Descripcion**: Conoce a los enemigos vivos

**Guia del Jugador**:
Una vez por partida, revelas el conteo exacto de cuántos atacantes, entidades anómalas y defensores siguen vivos en la red. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

### Monitor de Integridad
**Descripcion**: Verifica lealtad

**Guia del Jugador**:
Cada noche compruebas si un jugador comparte tus mismos objetivos de victoria o no. Útil para encontrar aliados en secreto. Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.

---

## ?? Black Hat (Red Team)

### DDoS Operator
**Descripcion**: Voto doble hacker

**Guia del Jugador**:
Participas en la votación nocturna con los demás hackers. ¡Tu voto vale doble! Si logran mayoría y el jugador no es eliminado, quedará silenciado al día siguiente. Conoces quiénes son los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Rootkit
**Descripcion**: Hacker invisible

**Guia del Jugador**:
Participas en la votación nocturna con los demás hackers. Tienes una ventaja pasiva: las investigaciones siempre dirán que estás SEGURO. Conoces quiénes son los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Ransomware
**Descripcion**: Silencia jugadores

**Guia del Jugador**:
En lugar de votar con los hackers, puedes elegir silenciar a un jugador. Al día siguiente no podrá hablar ni votar. Tienes que esperar unas noches para volver a usarlo. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Spyware
**Descripcion**: Espía visitas

**Guia del Jugador**:
En lugar de votar, eliges espiar a un jugador. Al día siguiente sabrás quiénes lo visitaron y qué tipo de acción le hicieron (pero no sus roles exactos). Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Phisher
**Descripcion**: Control mental de votos

**Guia del Jugador**:
En lugar de votar en la noche, puedes obligar a un jugador a que vote por quien tú decidas en la expulsión grupal del día siguiente. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Fuerza Bruta
**Descripcion**: Asesino a sueldo

**Guia del Jugador**:
Una vez por partida, en lugar de unirte a la votación nocturna grupal, puedes intentar eliminar a un jugador por tu cuenta. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Sniffer
**Descripcion**: Identifica bandos

**Guia del Jugador**:
En lugar de votar de noche, puedes investigar a un jugador. El sistema te revelará a qué bando pertenece de forma general. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Kit de Exploits
**Descripcion**: Rompe protecciones

**Guia del Jugador**:
En lugar de votar de noche, puedes marcar a un jugador. Si alguna defensa intenta protegerlo esa misma noche, la protección fallará. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Implante Backdoor
**Descripcion**: Voto extra en contra

**Guia del Jugador**:
En lugar de votar, puedes marcar a un jugador. Si el resto de los hackers votan por él, recibirán un punto de votación extra para asegurar su eliminación. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Movimiento Lateral
**Descripcion**: Detector de aliados

**Guia del Jugador**:
En lugar de votar, investigas a un jugador. Sabrás si pertenece a la red de defensores o no. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Keylogger
**Descripcion**: Vigila votos pasados

**Guia del Jugador**:
En lugar de votar de noche, puedes ver por quién votó un jugador en la expulsión del día anterior. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Escáner de Vulnerabilidades
**Descripcion**: Detecta debilitados

**Guia del Jugador**:
En lugar de votar, investigas a un jugador. Sabrás si ese jugador está comprometido (infectado o silenciado). Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Robador de Credenciales
**Descripcion**: Detecta roles críticos

**Guia del Jugador**:
En lugar de votar, investigas a un jugador. Descubrirás si su perfil de sistema es una DEFENSA_CRÍTICA o un PERFIL_ESTÁNDAR. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

### Proxy MitM
**Descripcion**: Secuestra votos hackers

**Guia del Jugador**:
En lugar de votar tú mismo, eliges a otro hacker y cambias su voto para que ataque a quien tú decidas. Conoces a los demás hackers. Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).

---

## ?? Caoticos (Green/Purple Team)

### Troll
**Descripcion**: Victoria por expulsión

**Guia del Jugador**:
Tu único objetivo es que los demás jugadores voten para expulsarte durante el día. Si lo logras, ganas la partida automáticamente. Por la noche puedes dejar un mensaje anónimo para engañar o molestar a los demás.

---

### Gusano
**Descripcion**: Infección progresiva

**Guia del Jugador**:
Por la noche infectas a un jugador. Si no lo curan, será eliminado después de dos noches. Además, tienes inmunidad contra el primer ataque que te hagan por la noche. Ganas si quedas como el único jugador vivo.

---

### Minero de Cripto
**Descripcion**: Escudos y sobornos

**Guia del Jugador**:
Cada noche puedes elegir: Minar (ganas un escudo protector, máximo 3 escudos, no puedes minar al mismo jugador dos noches seguidas) o Sobornar (gasta un escudo para eliminar a un jugador inmediatamente). Ganas si eres el último en pie.

---

### Zero-Day
**Descripcion**: Roba identidades muertas

**Guia del Jugador**:
Una vez por partida, eliges a un jugador que ya fue eliminado y robas su rol, sus habilidades y su bando. A partir de ese momento, juegas como si fueras él. Las investigaciones mostrarán tu nuevo rol.

---

### Filtrador
**Descripcion**: Revela bandos

**Guia del Jugador**:
Cada noche puedes elegir a un jugador y filtrar su afiliación de red. Esta información aparecerá anónimamente al amanecer para que todos la vean. Ganas generando caos y sobreviviendo hasta el final.

---

### Sombra
**Descripcion**: Disfraza a un aliado

**Guia del Jugador**:
Eliges a un jugador cada noche. Si alguien lo investiga, aparecerá como SEGURO, ocultando su verdadera naturaleza. Tu propia identidad sigue oculta.

---

### Bomba Lógica
**Descripcion**: Trampa mortal

**Guia del Jugador**:
Por la noche, colocas una trampa en un jugador. Si ese jugador usa una habilidad nocturna en el turno siguiente, explotará y será eliminado antes de poder hacer su acción.

---

### Envenenador DNS
**Descripcion**: Caos en los votos diurnos

**Guia del Jugador**:
Eliges a un jugador por la noche. Al día siguiente, su voto de expulsión se desviará hacia una persona aleatoria sin que se dé cuenta. Además, tú apareces como SEGURO si te investigan en la misma noche en la que usas esto.

---

### Nota de Rescate
**Descripcion**: Silencia a un jugador

**Guia del Jugador**:
Silencias a un jugador por la noche para que no pueda actuar ni votar al día siguiente. Además, el sistema publicará un mensaje tuyo de forma anónima.

---

### Dropper
**Descripcion**: Ignora protecciones

**Guia del Jugador**:
Eliges a un jugador. En la noche siguiente, nadie podrá protegerlo, curarlo ni revivirlo si es atacado. Tú empiezas con un escudo de protección, y ganas otro escudo extra (hasta 2) cada vez que usas tu habilidad.

---

### Saboteador
**Descripcion**: Supervivencia máxima

**Guia del Jugador**:
Te escondes durante la noche: las investigaciones te verán como SEGURO, los hackers no pueden votarte y sobrevivirás a una expulsión diurna aunque todos voten contra ti.

---

### Ruido Blanco
**Descripcion**: Mensajes falsos

**Guia del Jugador**:
Durante la noche, dejas un mensaje anónimo en el foro público para confundir al resto de jugadores.

---

### Espejismo
**Descripcion**: Engaño visual

**Guia del Jugador**:
Te ocultas a ti mismo por la noche. Si alguien te investiga, aparecerás como SEGURO en sus reportes.

---

### Router del Caos
**Descripcion**: Desvía ataques

**Guia del Jugador**:
Eliges a dos personas: el jugador Origen y el jugador Destino. Si alguien ataca al Origen por la noche, el ataque se desviará mágicamente hacia el Destino.

---

