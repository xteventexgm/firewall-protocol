# Especificaciones de Audio (M11 - SFX)

Para complementar la inmersión del M11, el sistema está configurado para intentar reproducir los siguientes archivos `.mp3`. Debes generar o conseguir audios que cumplan con las características mencionadas y guardarlos en las rutas especificadas. 

Mientras no existan, el sistema utilizará un "fallback procedural" (pitidos electrónicos generados mediante código) para que el juego siga siendo funcional.

## 1. Aplicación Mobile (`mobile-terminal`)
Ruta base: `mobile-terminal/src/assets/sfx/`

| Archivo | Subcarpeta | Descripción / Sensación |
|---------|-----------|-------------------------|
| `ui-click.mp3` | `ui/` | **Selección / Toque en interfaz:** Un sonido corto, nítido y cibernético. Similar a pulsar un botón de cristal o teclear en un terminal futurista. Duración sugerida: < 0.3s |
| `ui-confirm.mp3` | `ui/` | **Confirmación / Reconexión:** Un tono ascendente, positivo y seguro. Debe transmitir que una acción se completó con éxito o que se recuperó la conexión. Duración sugerida: 0.5s - 1s |
| `scan-safe.mp3` | `phase/` | **Resultado Escáner (Seguro):** Un tono limpio, claro y armónico (ej. una campanilla digital suave). Debe transmitir alivio al descubrir que el objetivo es Inocente. Duración sugerida: 1s - 2s |
| `scan-malicious.mp3` | `phase/` | **Resultado Escáner (Malicioso):** Un sonido distorsionado, grave o con estática, similar a una alarma de bajo volumen. Debe transmitir alerta o amenaza al descubrir que el objetivo es un Virus o Hacker. Duración sugerida: 1s - 2s |
| `vote-tie.mp3` | `combat/` | **Empate en Votación:** Un sonido disonante, mecánico o similar a un "error de sistema" de tono medio. Debe dar la sensación de que el sistema no pudo procesar un resultado claro. Duración sugerida: 1.5s - 2.5s |

---

## 2. Aplicación Web Dashboard (`web-dashboard`)
Ruta base: `web-dashboard/src/assets/sfx/`

| Archivo | Subcarpeta | Descripción / Sensación |
|---------|-----------|-------------------------|
| `scan-safe.mp3` | `phase/` | Puede ser idéntico al del móvil o una versión ligeramente más amplificada. |
| `scan-malicious.mp3` | `phase/` | Puede ser idéntico al del móvil. |
| `vote-tie.mp3` | `combat/` | Puede ser idéntico al del móvil. |

---

### Instrucciones para guardar:
1. Crea las carpetas `ui`, `phase` y `combat` dentro de `assets/sfx/` en ambos proyectos.
2. Nombra los archivos exactamente como se indica en la columna "Archivo" (todo en minúsculas y con guiones).
3. Asegúrate de que el formato sea `.mp3` para garantizar la máxima compatibilidad en la web y en Ionic.
