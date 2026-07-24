// @ts-nocheck
import * as nodemailer from 'nodemailer';

interface SmtpConnection {
  hostname: string;
  port: number;
  tls?: boolean;
  auth?: { username: string; password: string };
}

interface SendOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  content?: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Uint8Array | string; encoding?: string }>;
}

export class SMTPClient {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly options: { connection: SmtpConnection }) {}

  private getTransporter() {
    if (!this.transporter) {
      const { connection } = this.options;
      this.transporter = nodemailer.createTransport({
        host: connection.hostname,
        port: connection.port,
        secure: connection.tls === true || connection.port === 465,
        auth: connection.auth,
      });
    }
    return this.transporter;
  }

  async send(options: SendOptions): Promise<void> {
    const to = Array.isArray(options.to) ? options.to.join(',') : options.to;
    const cc = options.cc ? (Array.isArray(options.cc) ? options.cc.join(',') : options.cc) : undefined;
    const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc) : undefined;

    await this.getTransporter().sendMail({
      from: options.from,
      to,
      cc,
      bcc,
      subject: options.subject,
      text: options.content,
      html: options.html || options.content,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content),
        encoding: a.encoding,
      })),
    });
  }

  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
