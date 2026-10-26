import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { OrganizationRole } from '../../generated/prisma/client';

export type EmailDeliveryStatus = 'accepted' | 'failed' | 'disabled';

export interface EmailDeliveryResult {
  status: EmailDeliveryStatus;
}

interface VerificationEmailInput {
  to: string;
  firstName: string;
  token: string;
}

interface PasswordResetEmailInput {
  to: string;
  firstName: string;
  token: string;
}

interface InvitationEmailInput {
  to: string;
  role: OrganizationRole;
  organizationName: string;
  token: string;
  expiresAt: Date;
}

interface ResendEmailPayload {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DELIVERY_TIMEOUT_MS = 10_000;

@Injectable()
export class EmailService {
  private readonly provider: string;
  private readonly apiKey: string | undefined;
  private readonly from: string | undefined;
  private readonly frontendOrigin: string;

  constructor(
    config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.provider = config.getOrThrow<string>('EMAIL_PROVIDER');
    this.apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM');
    this.frontendOrigin = config
      .getOrThrow<string>('FRONTEND_ORIGIN')
      .replace(/\/$/, '');
    this.logger.setContext(EmailService.name);
  }

  sendVerificationEmail(
    input: VerificationEmailInput,
  ): Promise<EmailDeliveryResult> {
    const link = `${this.frontendOrigin}/verify-email?token=${encodeURIComponent(input.token)}`;
    return this.send({
      to: [input.to],
      subject: 'Verify your Kapwesto email',
      html: this.layout(
        `
          <p>Hi ${this.escapeHtml(input.firstName)},</p>
          <p>Confirm your email to finish setting up your Kapwesto account.</p>
          <p><a href="${this.escapeHtml(link)}">Verify your email</a></p>
          <p>This link expires in 24 hours and can only be used once.</p>
        `,
      ),
      text: `Hi ${input.firstName},\n\nConfirm your email to finish setting up your Kapwesto account:\n${link}\n\nThis link expires in 24 hours and can only be used once.`,
    });
  }

  sendPasswordResetEmail(
    input: PasswordResetEmailInput,
  ): Promise<EmailDeliveryResult> {
    const link = `${this.frontendOrigin}/reset-password?token=${encodeURIComponent(input.token)}`;
    return this.send({
      to: [input.to],
      subject: 'Reset your Kapwesto password',
      html: this.layout(
        `
          <p>Hi ${this.escapeHtml(input.firstName)},</p>
          <p>Use the link below to choose a new Kapwesto password.</p>
          <p><a href="${this.escapeHtml(link)}">Reset your password</a></p>
          <p>This link expires in 30 minutes and can only be used once.</p>
        `,
      ),
      text: `Hi ${input.firstName},\n\nChoose a new Kapwesto password here:\n${link}\n\nThis link expires in 30 minutes and can only be used once.`,
    });
  }

  sendInvitationEmail(
    input: InvitationEmailInput,
  ): Promise<EmailDeliveryResult> {
    const link = `${this.frontendOrigin}/invitations/${encodeURIComponent(input.token)}`;
    const expires = new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
    }).format(input.expiresAt);
    const role = input.role.toLowerCase();
    return this.send({
      to: [input.to],
      subject: `You have been invited to ${input.organizationName} on Kapwesto`,
      html: this.layout(
        `
          <p>You have been invited to join <strong>${this.escapeHtml(input.organizationName)}</strong> on Kapwesto as a ${this.escapeHtml(role)}.</p>
          <p><a href="${this.escapeHtml(link)}">View invitation</a></p>
          <p>This single-use invitation expires on ${this.escapeHtml(expires)}.</p>
        `,
      ),
      text: `You have been invited to join ${input.organizationName} on Kapwesto as a ${role}.\n\nView invitation:\n${link}\n\nThis single-use invitation expires on ${expires}.`,
    });
  }

  private async send(
    payload: ResendEmailPayload,
  ): Promise<EmailDeliveryResult> {
    if (this.provider === 'disabled') return { status: 'disabled' };
    if (this.provider !== 'resend' || !this.apiKey || !this.from) {
      this.logger.error(
        { provider: this.provider },
        'email provider is not configured',
      );
      return { status: 'failed' };
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, from: this.from }),
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(
          { provider: 'resend', statusCode: response.status },
          'email provider rejected message',
        );
        return { status: 'failed' };
      }
      return { status: 'accepted' };
    } catch (error: unknown) {
      this.logger.warn(
        { provider: 'resend', error },
        'email provider request failed',
      );
      return { status: 'failed' };
    }
  }

  private layout(content: string): string {
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#252525"><main style="max-width:560px;margin:0 auto;padding:32px 20px"><h1 style="font-size:24px">Kapwesto</h1>${content}</main></body></html>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[character] ?? character,
    );
  }
}
