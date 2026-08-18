export function verificationEmailHtml(url: string): string {
  // Sem <meta charset="utf-8">, alguns clientes de e-mail chutam a
  // codificação errada e embaralham acento (ã, ç, é...) — confirmado na
  // prática, um e-mail de teste chegou com esse problema antes desse fix.
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <img
            src="https://res.cloudinary.com/dprfwwjz9/image/upload/v1787084050/branding/agata-verification-email.png"
            alt=""
            width="220"
            style="display: block; max-width: 220px; margin: 0 auto 16px;"
          />
          <h1 style="font-size: 20px;">cqntrack</h1>
          <p>Confirme seu e-mail pra ativar sua conta.</p>
          <p>
            <a
              href="${url}"
              style="display: inline-block; padding: 10px 20px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px;"
            >
              Confirmar e-mail
            </a>
          </p>
          <p style="color: #666; font-size: 13px;">
            Se você não criou essa conta, pode ignorar este e-mail.
          </p>
        </div>
      </body>
    </html>
  `.trim();
}
