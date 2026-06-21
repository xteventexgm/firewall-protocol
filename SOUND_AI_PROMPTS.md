# Prompts para generar SFX con IA — Firewall Protocol

Usa estos prompts en herramientas como **ElevenLabs Sound Effects**, **Stable Audio**, **Suno** (modo SFX), **Adobe Firefly Audio** o **Meta AudioCraft**. Exporta en **MP3 44.1 kHz**, mono, **2–4 s** para SFX cortos y **15–45 s** para loops.

**Estilo global del juego:** cyberpunk, terminal militar, datacenter oscuro, UI digital fría. Sin voces habladas salvo glitch distorsionado muy breve.

Los archivos generados se colocan en `web-dashboard/public/sfx/` y `mobile-terminal/src/assets/sfx/` según la categoría. Ver también [`README.md`](README.md) y [`CHANGELOG.md`](CHANGELOG.md).

---

## UI (`ui/`)

### `button-click.mp3`
```
Short UI click sound for a cyberpunk strategy game dashboard. Digital soft tap, subtle high-frequency tick, clean and minimal, no reverb tail. Duration 0.05-0.12 seconds. Mono, dry, futuristic HUD interface.
```

### `button-confirm.mp3`
```
Positive UI confirmation beep for a sci-fi firewall control panel. Two-tone ascending digital chime (520Hz then 780Hz), crisp, satisfying, not musical. Duration 0.15-0.25 seconds. Mono, slight stereo width ok, cybernetic terminal aesthetic.
```

### `toast-warning.mp3`
```
Warning notification sound for a security operations center UI. Double square-wave alert beep, amber alert feeling, urgent but not alarming. Duration 0.2-0.35 seconds. Digital, compressed, no voice.
```

---

## Ambiente (`ambient/`)

### `lobby-loop.mp3`
```
Seamless loopable ambient soundscape: quiet data center server room at night. Low fan hum, distant electrical buzz, occasional soft relay click. Calm, tense undertone, cyberpunk. No melody. 20-30 seconds seamless loop. Very low dynamics, background layer only.
```

### `night-loop.mp3`
```
Seamless loopable dark ambient tension for a stealth night phase in a hacker deduction game. Sub-bass pulse 60-80Hz, faint digital static, sparse distant beeps like encrypted traffic. Ominous, minimal, no drums. 25-40 seconds seamless loop. Volume should sit under UI sounds.
```

---

## Fases (`phase/`)

### `game-start.mp3`
```
Cinematic game session start sting for cyberpunk SOC dashboard. Rising synthetic sweep from 200Hz to 800Hz, brief digital boot sequence clicks, ends with authoritative low thump. Feels like "firewall protocol initialized". Duration 1.5-2.5 seconds. Not orchestral — electronic military terminal.
```

### `night-begin.mp3`
```
Transition sound entering night stealth mode. Deep descending whoosh plus low sawtooth drone fading in, like lights dimming in a server bunker. Duration 0.8-1.5 seconds. Dark, suspenseful, digital.
```

### `day-begin.mp3`
```
Dawn transition sound for cyber security game. Bright ascending sweep 300Hz to 900Hz, soft white-noise wash clearing like morning audit scan complete. Hopeful but still technical. Duration 0.6-1.2 seconds.
```

### `vote-cast.mp3`
```
Vote registered sound for digital democracy / IP ban vote. Short green-terminal blip, single square pulse at 520Hz, very short decay. Duration 0.05-0.1 seconds. Clean HUD feedback.
```

### `timer-warning.mp3`
```
10 second countdown warning for phase timer. Rhythmic double beep pattern, increasing urgency, SOC alert style. Duration 0.8-1.2 seconds (plays once, not a loop). Digital, amber alert.
```

---

## Combate (`combat/`)

### `action-sent.mp3`
```
Mobile terminal command submitted sound (used only outside NIGHT phase). Quick data packet send: rising blip 640Hz with tiny static tail, like encrypted payload dispatched. Duration 0.08-0.15 seconds. Sci-fi, precise.
```

### `incident-kill.mp3`
```
Night incident report: node eliminated. Impact hit plus short glitch burst and low frequency thud, red alert SOC. Feels like "host offline". Duration 0.4-0.8 seconds. Dramatic but not horror.
```

### `node-down.mp3`
```
Player eliminated / connection refused sound. Error tone descending 400Hz to 120Hz with digital crackle and hard cut. Terminal error aesthetic. Duration 0.5-0.9 seconds. Mobile death feedback.
```

### `honeypot-drag.mp3` (opcional)
```
Honeypot trap chain reaction sound. Metallic snap followed by cascading digital chain links breaking, sinister but brief. Duration 0.5-0.9 seconds. Cyber trap triggered.
```

---

## Social (`social/`)

### `chat-message.mp3`
```
Incoming chat message notification. Soft high ping 700Hz, minimal, like IRC message received in secure channel. Duration 0.03-0.08 seconds. Very subtle.
```

---

## Victoria (`victory/`)

### `win-system.mp3`
```
Victory fanfare for Blue Team / System defenders winning. Clean ascending arpeggio, military digital horns synthesized, triumphant but restrained, cyber security ops success. Duration 2-3.5 seconds. No lyrics.
```

### `win-hacker.mp3`
```
Victory sound for Red Team / hackers winning. Distorted descending glitch, broken encryption unlock, unsettling digital laugh fragment (0.2s max), static burst. Malicious, chaotic. Duration 2-3 seconds.
```

### `win-solo.mp3`
```
Solo chaotic role victory (lone survivor). Ominous solo pulse, glitch stutter, lonely echo in empty server room, ambiguous triumph. Duration 2-3 seconds. Eerie cyberpunk.
```

### `defeat.mp3` (opcional)
```
Generic defeat / session lost sting. Flatline beep flattening to silence, single long low tone dying out. Duration 1.5-2.5 seconds. Somber digital.
```

---

## Checklist de generación

| # | Archivo | Carpeta |
|---|---------|---------|
| 1 | button-click.mp3 | ui/ |
| 2 | button-confirm.mp3 | ui/ |
| 3 | toast-warning.mp3 | ui/ |
| 4 | lobby-loop.mp3 | ambient/ |
| 5 | night-loop.mp3 | ambient/ |
| 6 | game-start.mp3 | phase/ |
| 7 | night-begin.mp3 | phase/ |
| 8 | day-begin.mp3 | phase/ |
| 9 | vote-cast.mp3 | phase/ |
| 10 | timer-warning.mp3 | phase/ |
| 11 | action-sent.mp3 | combat/ |
| 12 | incident-kill.mp3 | combat/ |
| 13 | node-down.mp3 | combat/ |
| 14 | chat-message.mp3 | social/ |
| 15 | win-system.mp3 | victory/ |
| 16 | win-hacker.mp3 | victory/ |
| 17 | win-solo.mp3 | victory/ |

**Opcionales:** honeypot-drag.mp3, defeat.mp3

> **No generar** `miner/mine-crypto.mp3` ni `miner/crypto-bribe.mp3` — sin SFX por rol.

---

## Post-producción recomendada

1. Normalizar a **-14 LUFS** (SFX cortos) / **-20 LUFS** (ambientes).
2. Recortar silencio inicial/final (< 50 ms).
3. Para loops: verificar que inicio y fin encajen sin click (crossfade 10 ms).
4. Copiar a `web-dashboard/public/sfx/` y `mobile-terminal/src/assets/sfx/` con **nombres exactos**.

---

## Prompt maestro (si la IA pide contexto de proyecto)

```
I'm building "Firewall Protocol", a cyberpunk social deduction game (Mafia/Werewolf in a SOC network). All sounds must feel like a military cyber operations center: digital, cold, precise — not fantasy medieval, not cartoon. Palette: cyan (#00f0ff), green terminal (#00ff88), red alert (#ff2d55). Generate [SPECIFIC SOUND FROM TABLE ABOVE].
```
