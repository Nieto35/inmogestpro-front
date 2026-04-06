// src/services/email.service.js
// nodemailer se carga de forma lazy para no romper el módulo si no está instalado

const createTransporter = () => {
  let nodemailer = null;
  try { nodemailer = require('nodemailer'); } catch(e) { return null; }
  const user = process.env.SMTP_USER     || '';
  const pass = process.env.SMTP_PASSWORD || '';
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465,
    auth:   { user, pass },
    tls:    { rejectUnauthorized: false },
  });
};

const baseTemplate = (content) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1e293b}
.w{max-width:600px;margin:32px auto}
.hd{background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:16px 16px 0 0;padding:40px;text-align:center}
.hd h1{color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px}
.hd p{color:#93c5fd;font-size:14px}
.bd{background:#fff;padding:40px}
.bd h2{font-size:20px;font-weight:700;color:#1e293b;margin-bottom:16px}
.bd p{font-size:15px;color:#475569;line-height:1.8;margin-bottom:14px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:24px 0}
.row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
.row:last-child{border-bottom:none}
.row .lbl{color:#64748b}
.row .val{color:#1e293b;font-weight:700;font-family:monospace;font-size:15px}
.btn{display:block;width:fit-content;margin:28px auto;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:15px 40px;border-radius:10px;font-weight:700;font-size:15px}
.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;font-size:13px;color:#92400e;margin:20px 0}
.ft{background:#f8fafc;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0}
.ft p{font-size:12px;color:#94a3b8;line-height:1.8}
.ft a{color:#2563eb;text-decoration:none}
.div{height:1px;background:#e2e8f0;margin:24px 0}
</style></head><body>
<div class="w">
${content}
<div class="ft"><p><strong>InmoGest Pro</strong> · Sistema de Gestión Inmobiliaria<br/>
Mensaje generado automáticamente — Por favor no responda este correo.<br/>
© ${new Date().getFullYear()} InmoGest Pro. Todos los derechos reservados.<br/>
<a href="#">Política de privacidad</a> &nbsp;·&nbsp; <a href="#">Soporte técnico</a></p></div>
</div></body></html>`;

const roleInfo = {
  admin:    { label:'Administrador',    perms:'Acceso total: contratos, clientes, proyectos, inmuebles, asesores, pagos, reportes, auditoría y usuarios.' },
  gerente:  { label:'Gerente',          perms:'Contratos, clientes, proyectos, inmuebles, asesores y reportes completos. Sin gestión de usuarios.' },
  contador: { label:'Contador',         perms:'Registro de pagos, consulta de contratos y reportes financieros.' },
  asesor:   { label:'Asesor Comercial', perms:'Creación de contratos y clientes. Visualización de sus propias ventas y comisiones.' },
  readonly: { label:'Solo Lectura',     perms:'Consulta de contratos, clientes, proyectos e inmuebles. Sin permisos de modificación.' },
};

const welcomeTemplate = ({ full_name, username, role, password, loginUrl }) => {
  const ri = roleInfo[role] || { label:role, perms:'Permisos configurados por el administrador.' };
  return baseTemplate(`
<div class="hd">
  <h1>🏢 InmoGest Pro</h1>
  <p>Sistema Profesional de Gestión Inmobiliaria</p>
</div>
<div class="bd">
  <h2>¡Bienvenido a InmoGest Pro, ${full_name}!</h2>
  <p>Tu cuenta ha sido creada exitosamente. A partir de ahora tienes acceso al sistema de gestión inmobiliaria. Guarda este correo — contiene tu información de acceso inicial.</p>

  <div class="card">
    <div class="row"><span class="lbl">👤 Usuario</span><span class="val">${username}</span></div>
    <div class="row"><span class="lbl">🔑 Contraseña temporal</span><span class="val">${password}</span></div>
    <div class="row"><span class="lbl">🎭 Rol asignado</span><span class="val">${ri.label}</span></div>
    <div class="row"><span class="lbl">🌐 Dirección de acceso</span><span class="val" style="font-size:13px">${loginUrl}</span></div>
  </div>

  <div class="warn">
    <strong>⚠️ Seguridad importante:</strong> Esta es una contraseña temporal. Por tu seguridad, cámbiala la primera vez que inicies sesión desde tu perfil de usuario.
  </div>

  <a href="${loginUrl}" class="btn">Ingresar al sistema →</a>

  <div class="div"></div>

  <h2 style="font-size:17px">¿Qué puedes hacer con tu cuenta?</h2>
  <p><strong>${ri.label}:</strong> ${ri.perms}</p>

  <p style="margin-top:20px;font-size:14px;color:#64748b">¿Tienes problemas para ingresar? Contacta al administrador del sistema o responde este correo.</p>
</div>`);
};

const resetTemplate = ({ full_name, username, newPassword, loginUrl }) => baseTemplate(`
<div class="hd"><h1>🔑 InmoGest Pro</h1><p>Restablecimiento de contraseña</p></div>
<div class="bd">
  <h2>Tu contraseña ha sido restablecida</h2>
  <p>Hola <strong>${full_name}</strong>, el administrador del sistema restablecio tu contraseña en InmoGest Pro.</p>
  <div class="card">
    <div class="row"><span class="lbl">Usuario</span><span class="val">${username}</span></div>
    <div class="row"><span class="lbl">Nueva contraseña temporal</span><span class="val">${newPassword}</span></div>
  </div>
  <div class="warn"><strong>⚠️ Importante:</strong> Cambia esta contraseña inmediatamente al iniciar sesión. Si no solicitaste este cambio, contacta al administrador urgentemente.</div>
  <a href="${loginUrl || process.env.APP_URL || 'http://localhost:5173/login'}" class="btn">Iniciar sesión →</a>
</div>`);

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [SIMULADO - sin SMTP] Para: ${to} | Asunto: ${subject}`);
    return { simulated: true };
  }
  try {
    const info = await transporter.sendMail({
      from:    `"InmoGest Pro" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to, subject, html,
    });
    console.log(`✅ Email enviado a ${to} — ID: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Error enviando email a ${to}:`, err.message);
    return { error: err.message };
  }
};

const sendWelcomeEmail = ({ to, full_name, username, role, password }) =>
  sendEmail({
    to,
    subject: '¡Bienvenido a InmoGest Pro! — Tus credenciales de acceso',
    html:    welcomeTemplate({ full_name, username, role, password, loginUrl: process.env.APP_URL || 'http://localhost:5173/login' }),
  });

const sendPasswordResetEmail = ({ to, full_name, username, newPassword }) =>
  sendEmail({
    to,
    subject: 'InmoGest Pro — Contraseña restablecida',
    html:    resetTemplate({ full_name, username, newPassword }),
  });

module.exports = { sendEmail, sendWelcomeEmail, sendPasswordResetEmail };