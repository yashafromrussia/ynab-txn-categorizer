import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { addDays, parseISO, subDays, format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

export interface TransactionEmail {
  id: string;
  from: string;
  subject: string;
  date: Date;
  bodyText: string;
}

interface OAuthClientCredentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface StoredToken {
  refresh_token: string;
  access_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function buildOAuthClient(clientCredentialsPath: string, redirectUri?: string): OAuth2Client {
  if (!fs.existsSync(clientCredentialsPath)) {
    throw new Error(`Gmail OAuth client credentials not found at ${clientCredentialsPath}`);
  }
  const raw = fs.readFileSync(clientCredentialsPath, 'utf-8');
  const parsed: OAuthClientCredentials = JSON.parse(raw);
  const section = parsed.installed || parsed.web;
  if (!section) {
    throw new Error(`Invalid OAuth client credentials file: missing "installed" or "web" section`);
  }
  const defaultRedirect = section.redirect_uris?.[0] || 'urn:ietf:wg:oauth:2.0:oob';
  return new google.auth.OAuth2(
    section.client_id,
    section.client_secret,
    redirectUri || defaultRedirect
  );
}

export function loadStoredToken(tokenPath: string): StoredToken | null {
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const raw = fs.readFileSync(tokenPath, 'utf-8');
    return JSON.parse(raw) as StoredToken;
  } catch (err) {
    console.error(`[Gmail] Failed to parse token file at ${tokenPath}:`, err);
    return null;
  }
}

export function saveStoredToken(tokenPath: string, token: StoredToken): void {
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2), { mode: 0o600 });
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Walk the MIME parts of a Gmail message and extract the best text representation.
 * Prefers text/plain; falls back to text/html with a light tag strip.
 */
function extractBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  const collected: { plain: string[]; html: string[] } = { plain: [], html: [] };

  const walk = (part: gmail_v1.Schema$MessagePart): void => {
    const mime = (part.mimeType || '').toLowerCase();
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mime === 'text/plain') collected.plain.push(decoded);
      else if (mime === 'text/html') collected.html.push(decoded);
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) walk(child);
    }
  };

  walk(payload);

  if (collected.plain.length > 0) return collected.plain.join('\n');
  if (collected.html.length > 0) {
    // Minimal HTML → text. Parsers do their own cleanup for nuanced cases.
    return collected.html
      .join('\n')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return '';
}

function getHeader(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  if (!payload?.headers) return '';
  const header = payload.headers.find(h => (h.name || '').toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private throttleMs: number;

  constructor(oauth2Client: OAuth2Client, opts: { throttleMs?: number } = {}) {
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    this.throttleMs = opts.throttleMs ?? 10;
  }

  static fromEnv(
    clientPath = process.env.GMAIL_OAUTH_CLIENT || 'secrets/gmail-oauth-client.json',
    tokenPath = process.env.GMAIL_TOKEN_PATH || 'secrets/gmail-token.json'
  ): GmailClient | null {
    if (!fs.existsSync(clientPath)) {
      console.warn(`[Gmail] OAuth client credentials missing at ${clientPath}; Gmail enrichment disabled.`);
      return null;
    }
    const token = loadStoredToken(tokenPath);
    if (!token?.refresh_token) {
      console.warn(`[Gmail] No stored refresh token at ${tokenPath}; run "npm run gmail:auth" first.`);
      return null;
    }
    const oauth = buildOAuthClient(clientPath);
    oauth.setCredentials({
      refresh_token: token.refresh_token,
      access_token: token.access_token,
      expiry_date: token.expiry_date,
      token_type: token.token_type,
      scope: token.scope,
    });
    return new GmailClient(oauth);
  }

  async getEmailsAroundDate(
    dateStr: string,
    daysWindow: number,
    senders: string[],
    maxMessages = 10
  ): Promise<TransactionEmail[]> {
    if (!senders || senders.length === 0) {
      // Never perform an unscoped query - privacy control.
      return [];
    }
    const targetDate = parseISO(dateStr);
    const after = format(subDays(targetDate, daysWindow), 'yyyy/MM/dd');
    const before = format(addDays(targetDate, daysWindow + 1), 'yyyy/MM/dd');
    const fromClause = senders.map(s => `from:${s}`).join(' OR ');
    const query = `(${fromClause}) after:${after} before:${before}`;

    try {
      const listResp = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxMessages,
      });

      const messageRefs = listResp.data.messages || [];
      if (messageRefs.length === 0) return [];

      const out: TransactionEmail[] = [];
      for (const ref of messageRefs.slice(0, maxMessages)) {
        if (!ref.id) continue;
        try {
          const msg = await this.gmail.users.messages.get({
            userId: 'me',
            id: ref.id,
            format: 'full',
          });
          const payload = msg.data.payload;
          const from = getHeader(payload, 'From');
          const subject = getHeader(payload, 'Subject');
          const dateHeader = getHeader(payload, 'Date');
          const internalDate = msg.data.internalDate
            ? new Date(Number(msg.data.internalDate))
            : dateHeader
              ? new Date(dateHeader)
              : new Date();
          const bodyText = extractBodyText(payload);

          // TODO: clean up text, add only whats needed for LLM.
          out.push({
            id: ref.id,
            from,
            subject,
            date: internalDate,
            bodyText,
          });
        } catch (err) {
          console.error(`[Gmail] Failed to fetch message ${ref.id}:`, err);
        }
        if (this.throttleMs > 0) {
          await new Promise(resolve => setTimeout(resolve, this.throttleMs));
        }
      }
      return out;
    } catch (err) {
      console.error('[Gmail] Error listing messages:', err);
      return [];
    }
  }
}
