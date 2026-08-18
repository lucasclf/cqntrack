export class ResendSendError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Envio pelo Resend falhou (status ${status}): ${body}`);
    this.name = "ResendSendError";
  }
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(env: Env, input: SendEmailInput): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    throw new ResendSendError(res.status, await res.text());
  }
}
