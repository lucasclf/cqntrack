const BRANDING_IMAGE_URL =
  "https://res.cloudinary.com/dprfwwjz9/image/upload/v1787084050/branding/agata-verification-email.png";

// Sem <meta charset="utf-8">, alguns clientes de e-mail chutam a
// codificação errada e embaralham acento (ã, ç, é...) — confirmado na
// prática, um e-mail de teste chegou com esse problema antes desse fix.
function emailShell(bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <img
            src="${BRANDING_IMAGE_URL}"
            alt=""
            width="220"
            style="display: block; max-width: 220px; margin: 0 auto 16px;"
          />
          ${bodyHtml}
        </div>
      </body>
    </html>
  `.trim();
}

function ctaButton(url: string, label: string): string {
  return `
    <p>
      <a
        href="${url}"
        style="display: inline-block; padding: 10px 20px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px;"
      >
        ${label}
      </a>
    </p>
  `;
}

export function verificationEmailHtml(url: string): string {
  return emailShell(`
    <h1 style="font-size: 20px;">cqntrack</h1>
    <p>Confirme seu e-mail pra ativar sua conta.</p>
    ${ctaButton(url, "Confirmar e-mail")}
    <p style="color: #666; font-size: 13px;">
      Se você não criou essa conta, pode ignorar este e-mail.
    </p>
  `);
}

export function resetPasswordEmailHtml(url: string): string {
  return emailShell(`
    <h1 style="font-size: 20px;">cqntrack</h1>
    <p>Pediram a redefinição da senha dessa conta. Clique abaixo pra escolher uma nova.</p>
    ${ctaButton(url, "Redefinir senha")}
    <p style="color: #666; font-size: 13px;">
      Se não foi você, pode ignorar este e-mail — sua senha continua a mesma.
    </p>
  `);
}
