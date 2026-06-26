/**
 * Plantillas HTML para correos y páginas web de verificación.
 * Paleta alineada con mobile-terminal (cyber HUD).
 */

const C = {
  bg: '#050a12',
  panel: '#0d1520',
  panelDeep: '#080e18',
  border: '#1a3a4a',
  accent: '#00f0ff',
  green: '#39ff14',
  greenDim: '#22c55e',
  danger: '#ff2d55',
  warn: '#ffb800',
  text: '#e8f4f8',
  muted: '#4a6a7a',
  soft: '#9ab0bc',
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function brandIconUrl(publicBaseUrl: string): string {
  return `${publicBaseUrl.replace(/\/$/, '')}/api/auth/brand/icon.png`;
}

/** Barra HUD superior (correo + web) */
function hudBar(label: string, statusColor: string, statusText: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 12px;background:${C.panelDeep};border:1px solid ${C.border};border-radius:6px 6px 0 0;font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${C.muted};">
          ◈ ${escapeHtml(label)}
        </td>
        <td align="right" style="padding:8px 12px;background:${C.panelDeep};border:1px solid ${C.border};border-left:none;border-radius:0 6px 0 0;font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.1em;color:${statusColor};">
          ● ${escapeHtml(statusText)}
        </td>
      </tr>
    </table>`;
}

function shell(
  content: string,
  preheader: string,
  options: {
    embedLogo?: boolean;
    publicBaseUrl?: string;
    hudLabel?: string;
    hudStatus?: string;
    hudStatusColor?: string;
    webPage?: boolean;
  } = {},
): string {
  const embedLogo = options.embedLogo !== false;
  const publicBase = options.publicBaseUrl?.replace(/\/$/, '') || '';
  const iconUrl = publicBase ? brandIconUrl(publicBase) : '';
  const favicon = iconUrl
    ? `<link rel="icon" type="image/png" href="${escapeHtml(iconUrl)}" />`
    : '';

  const hudLabel = options.hudLabel || 'SYS // FIREWALL_PROTOCOL';
  const hudStatus = options.hudStatus || 'ONLINE';
  const hudStatusColor = options.hudStatusColor || C.green;

  const logoBlock = embedLogo
    ? `<tr>
            <td style="padding:0 0 16px;text-align:center;">
              <img src="cid:fp-logo" alt="Firewall Protocol" width="104" height="104"
                style="display:block;margin:0 auto;border-radius:22px;border:2px solid rgba(0,240,255,0.45);box-shadow:0 0 32px rgba(0,240,255,0.3),0 0 64px rgba(57,255,20,0.12);" />
            </td>
          </tr>`
    : iconUrl
      ? `<tr>
            <td style="padding:0 0 16px;text-align:center;">
              <img src="${escapeHtml(iconUrl)}" alt="Firewall Protocol" width="104" height="104"
                style="display:block;margin:0 auto;border-radius:22px;border:2px solid rgba(0,240,255,0.45);box-shadow:0 0 32px rgba(0,240,255,0.3),0 0 64px rgba(57,255,20,0.12);" />
            </td>
          </tr>`
      : '';

  const webStyles = options.webPage
    ? `<style>
        @keyframes fp-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @keyframes fp-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .fp-glow { animation: fp-pulse 2.4s ease-in-out infinite; }
        .fp-scanline {
          position:fixed;inset:0;pointer-events:none;z-index:0;
          background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,240,255,0.015) 2px,rgba(0,240,255,0.015) 4px);
        }
        .fp-scanline::after {
          content:'';position:absolute;left:0;right:0;height:120px;
          background:linear-gradient(180deg,transparent,rgba(0,240,255,0.04),transparent);
          animation:fp-scan 6s linear infinite;
        }
      </style>`
    : '';

  const bodyExtra = options.webPage
    ? `<div class="fp-scanline"></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Firewall Protocol</title>
  ${favicon}
  ${webStyles}
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${bodyExtra}
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
    style="position:relative;z-index:1;background-color:${C.bg};background-image:radial-gradient(ellipse at 50% -10%,#0f2430 0%,${C.bg} 50%),linear-gradient(90deg,rgba(0,240,255,0.03) 1px,transparent 1px),linear-gradient(rgba(0,240,255,0.03) 1px,transparent 1px);background-size:100% 100%,24px 24px,24px 24px;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;border-collapse:separate;">
          ${logoBlock}
          <tr>
            <td style="background:linear-gradient(180deg,${C.panel} 0%,${C.panelDeep} 100%);border:1px solid rgba(0,240,255,0.32);border-radius:12px;padding:0;box-shadow:0 0 48px rgba(0,240,255,0.1),inset 0 1px 0 rgba(255,255,255,0.05);overflow:hidden;">
              <div style="height:3px;background:linear-gradient(90deg,${C.green} 0%,${C.accent} 50%,${C.green} 100%);"></div>
              <div style="padding:22px 22px 24px;">
                ${hudBar(hudLabel, hudStatusColor, hudStatus)}
                ${content}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 0;text-align:center;font-family:Consolas,'Courier New',monospace;font-size:10px;line-height:1.6;color:${C.muted};letter-spacing:0.08em;">
              <span style="color:${C.accent};font-weight:600;">▸ FIREWALL PROTOCOL</span><br />
              PLAYER TERMINAL v1.0 · MENSAJE AUTOMÁTICO · NO RESPONDER
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function terminalCodeBlock(value: string, accentColor: string = C.accent): string {
  return `
    <div style="margin:0;padding:14px 16px;background:#030609;border:1px solid ${C.border};border-left:3px solid ${accentColor};border-radius:0 8px 8px 0;font-family:Consolas,'Courier New',monospace;font-size:11px;line-height:1.55;color:${accentColor};word-break:break-all;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);">
      <span style="color:${C.muted};font-size:9px;letter-spacing:0.12em;">&gt; TOKEN ::</span><br />
      ${value}
    </div>`;
}

function actionButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
      <tr>
        <td style="border-radius:8px;background:linear-gradient(90deg,${C.green} 0%,${C.accent} 55%,${C.green} 100%);padding:2px;box-shadow:0 0 20px rgba(0,240,255,0.25);">
          <a href="${safeHref}" target="_blank" rel="noopener"
            style="display:inline-block;padding:15px 32px;font-family:Consolas,'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;color:${C.green};background:${C.panelDeep};border-radius:6px;text-shadow:0 0 12px rgba(57,255,20,0.5);">
            ▸ ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function statRow(label: string, value: string, valueColor: string = C.accent): string {
  return `
    <tr>
      <td style="padding:6px 0;font-family:Consolas,'Courier New',monospace;font-size:11px;color:${C.muted};letter-spacing:0.06em;">${escapeHtml(label)}</td>
      <td align="right" style="padding:6px 0;font-family:Consolas,'Courier New',monospace;font-size:11px;color:${valueColor};font-weight:600;">${value}</td>
    </tr>`;
}

export function buildVerificationEmailHtml(username: string, verifyLink: string, token: string): string {
  const safeUser = escapeHtml(username);
  const safeToken = escapeHtml(token);

  const content = `
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:700;line-height:1.3;color:${C.text};">
      Autenticación de operador
    </h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${C.soft};">
      Agente <strong style="color:${C.accent};">${safeUser}</strong>, tu perfil está en
      <strong style="color:${C.text};">cuarentena</strong> hasta confirmar el canal de comunicación.
      Activa el terminal para desbloquear estadísticas y partidas guardadas.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:collapse;background:${C.panelDeep};border:1px solid ${C.border};border-radius:8px;">
      <tr><td colspan="2" style="padding:10px 14px 4px;font-family:Consolas,'Courier New',monospace;font-size:9px;letter-spacing:0.14em;color:${C.muted};">SESSION PAYLOAD</td></tr>
      ${statRow('OPERADOR', safeUser, C.accent)}
      ${statRow('ESTADO', 'PENDIENTE', C.warn)}
      ${statRow('EXPIRA', '24 H', C.soft)}
    </table>
    ${actionButton(verifyLink, 'Verificar cuenta')}
    <p style="margin:0 0 10px;font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};">
      ◈ Alternativa — pegar en la app
    </p>
    ${terminalCodeBlock(safeToken)}
    <p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:${C.muted};">
      Si no iniciaste registro en Firewall Protocol, ignora este mensaje. Tu red sigue segura.
    </p>`;

  return shell(content, `Activa tu terminal, ${username}.`, {
    hudLabel: 'AUTH // VERIFY_EMAIL',
    hudStatus: 'PENDING',
    hudStatusColor: C.warn,
  });
}

export function buildPasswordResetEmailHtml(username: string, token: string): string {
  const safeUser = escapeHtml(username);
  const safeToken = escapeHtml(token);

  const content = `
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:700;line-height:1.3;color:${C.text};">
      Recuperación de acceso
    </h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${C.soft};">
      Operador <strong style="color:${C.accent};">${safeUser}</strong>, se solicitó un reset de credenciales.
      Introduce el código en el terminal para establecer una nueva clave.
    </p>
    <p style="margin:0 0 10px;font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};">
      ◈ Código de recuperación
    </p>
    ${terminalCodeBlock(safeToken, C.danger)}
    <p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:${C.muted};">
      Válido <strong style="color:${C.soft};">1 hora</strong>. Si no fuiste tú, ignora el correo — tu cuenta permanece intacta.
    </p>`;

  return shell(content, `Código de recuperación para ${username}.`, {
    hudLabel: 'AUTH // PASSWORD_RESET',
    hudStatus: 'ALERT',
    hudStatusColor: C.danger,
  });
}

export function buildVerificationEmailText(username: string, verifyLink: string, token: string): string {
  return (
    `FIREWALL PROTOCOL — Verificación de operador\n\n` +
    `Agente ${username},\n\n` +
    `Confirma tu correo para activar el terminal:\n${verifyLink}\n\n` +
    `Token (24 h):\n${token}\n\n` +
    `Si no creaste esta cuenta, ignora este mensaje.`
  );
}

export function buildVerifySuccessPageHtml(username: string, publicBaseUrl: string): string {
  const safeUser = escapeHtml(username);

  const content = `
    <div class="fp-glow" style="margin:0 0 16px;padding:12px 16px;background:rgba(34,197,94,0.12);border:1px solid rgba(57,255,20,0.45);border-radius:8px;text-align:center;">
      <span style="font-family:Consolas,'Courier New',monospace;font-size:28px;line-height:1;color:${C.green};text-shadow:0 0 24px rgba(57,255,20,0.6);">✓</span>
      <p style="margin:8px 0 0;font-family:Consolas,'Courier New',monospace;font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${C.green};">
        Acceso concedido
      </p>
    </div>
    <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;line-height:1.3;color:${C.text};">
      Identidad verificada
    </h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${C.soft};">
      Operador <strong style="color:${C.accent};">${safeUser}</strong>, tu canal quedó autenticado.
      El firewall ya reconoce tu firma digital.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:collapse;background:${C.panelDeep};border:1px solid ${C.border};border-radius:8px;">
      <tr><td colspan="2" style="padding:10px 14px 4px;font-family:Consolas,'Courier New',monospace;font-size:9px;letter-spacing:0.14em;color:${C.muted};">SESSION STATUS</td></tr>
      ${statRow('OPERADOR', safeUser, C.accent)}
      ${statRow('EMAIL', 'VERIFICADO', C.green)}
      ${statRow('TERMINAL', 'LISTO', C.green)}
    </table>
    <div style="padding:16px;background:${C.panelDeep};border:1px dashed rgba(0,240,255,0.35);border-radius:8px;">
      <p style="margin:0 0 6px;font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.12em;color:${C.accent};">
        ▸ SIGUIENTE PASO
      </p>
      <p style="margin:0;font-size:14px;line-height:1.65;color:${C.soft};">
        Vuelve a la app <strong style="color:${C.text};">Firewall Protocol</strong> e inicia sesión con tu usuario o correo.
        Ya puedes entrar al lobby y guardar partidas.
      </p>
    </div>`;

  return shell(content, `Cuenta verificada — ${username}`, {
    embedLogo: false,
    publicBaseUrl,
    hudLabel: 'AUTH // VERIFY_OK',
    hudStatus: 'GRANTED',
    hudStatusColor: C.green,
    webPage: true,
  });
}

export function buildVerifyErrorPageHtml(message: string, publicBaseUrl: string): string {
  const safeMsg = escapeHtml(message);

  const content = `
    <div style="margin:0 0 16px;padding:12px 16px;background:rgba(255,45,85,0.1);border:1px solid rgba(255,45,85,0.4);border-radius:8px;text-align:center;">
      <span style="font-family:Consolas,'Courier New',monospace;font-size:28px;line-height:1;color:${C.danger};">✕</span>
      <p style="margin:8px 0 0;font-family:Consolas,'Courier New',monospace;font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${C.danger};">
        Enlace inválido
      </p>
    </div>
    <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:${C.text};">
      Verificación fallida
    </h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${C.soft};">${safeMsg}</p>
    <div style="padding:16px;background:${C.panelDeep};border:1px dashed rgba(255,45,85,0.35);border-radius:8px;">
      <p style="margin:0 0 6px;font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.12em;color:${C.danger};">
        ▸ QUÉ HACER
      </p>
      <p style="margin:0;font-size:14px;line-height:1.65;color:${C.soft};">
        Abre la app, inicia sesión y solicita un <strong style="color:${C.text};">nuevo correo de verificación</strong>.
        Los enlaces caducan a las 24 horas.
      </p>
    </div>`;

  return shell(content, message, {
    embedLogo: false,
    publicBaseUrl,
    hudLabel: 'AUTH // VERIFY_FAIL',
    hudStatus: 'DENIED',
    hudStatusColor: C.danger,
    webPage: true,
  });
}

export function buildPasswordResetEmailText(username: string, token: string): string {
  return (
    `FIREWALL PROTOCOL — Recuperar contraseña\n\n` +
    `Operador ${username},\n\n` +
    `Código de recuperación (1 h):\n${token}\n\n` +
    `Pégalo en la app para elegir una nueva contraseña.\n` +
    `Si no fuiste tú, ignora este correo.`
  );
}

export function buildDeleteAccountEmailHtml(username: string, token: string): string {
  const safeUser = escapeHtml(username);
  const safeToken = escapeHtml(token);

  const content = `
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:700;line-height:1.3;color:${C.text};">
      Confirmar eliminación de cuenta
    </h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${C.soft};">
      Operador <strong style="color:${C.accent};">${safeUser}</strong>, recibimos una solicitud para
      <strong style="color:${C.danger};">borrar permanentemente</strong> tu perfil en Firewall Protocol.
    </p>
    <p style="margin:0 0 10px;font-family:Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};">
      ◈ Código de confirmación
    </p>
    ${terminalCodeBlock(safeToken, C.danger)}
    <p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:${C.muted};">
      Válido <strong style="color:${C.soft};">1 hora</strong>. Pégalo en la app junto con tu contraseña.
      Se eliminarán perfil, historial y avatar. Si no fuiste tú, ignora este correo — tu cuenta sigue activa.
    </p>`;

  return shell(content, `Código para eliminar la cuenta de ${username}.`, {
    hudLabel: 'AUTH // DELETE_ACCOUNT',
    hudStatus: 'CRITICAL',
    hudStatusColor: C.danger,
  });
}

export function buildDeleteAccountEmailText(username: string, token: string): string {
  return (
    `FIREWALL PROTOCOL — Eliminar cuenta\n\n` +
    `Operador ${username},\n\n` +
    `Código de confirmación (1 h):\n${token}\n\n` +
    `Pégalo en la app con tu contraseña para eliminar la cuenta.\n` +
    `Si no solicitaste esto, ignora el correo.`
  );
}
