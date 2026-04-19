import 'dotenv/config';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import {
  GMAIL_SCOPES,
  buildOAuthClient,
  loadStoredToken,
  saveStoredToken,
} from './gmail.js';

async function main() {
  p.intro(chalk.bgCyan.black(' Gmail OAuth Setup '));

  const clientPath = process.env.GMAIL_OAUTH_CLIENT || 'secrets/gmail-oauth-client.json';
  const tokenPath = process.env.GMAIL_TOKEN_PATH || 'secrets/gmail-token.json';

  p.log.info(`OAuth client credentials: ${clientPath}`);
  p.log.info(`Token output path: ${tokenPath}`);

  const existing = loadStoredToken(tokenPath);
  if (existing?.refresh_token) {
    const overwrite = await p.confirm({
      message: 'A refresh token already exists. Overwrite?',
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.outro('Aborted. Existing token preserved.');
      return;
    }
  }

  let oauth;
  try {
    oauth = buildOAuthClient(clientPath);
  } catch (err) {
    p.log.error(String(err));
    p.outro('Failed. Download OAuth client credentials and place them at the configured path.');
    process.exit(1);
  }

  const authUrl = oauth.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
  });

  p.log.step('Open this URL in a browser and authorize the app:');
  p.log.message(chalk.cyan(authUrl));

  const code = await p.text({
    message: 'Paste the authorization code here:',
    validate: (value) => (!value || value.trim().length < 10 ? 'Code looks too short' : undefined),
  });
  if (p.isCancel(code)) {
    p.outro('Cancelled.');
    return;
  }

  const spinner = p.spinner();
  spinner.start('Exchanging code for refresh token...');

  try {
    const { tokens } = await oauth.getToken((code as string).trim());
    if (!tokens.refresh_token) {
      spinner.stop('Google did not return a refresh_token.');
      p.log.warn(
        'This usually means you have previously authorized the app. ' +
          'Revoke access at https://myaccount.google.com/permissions and try again.'
      );
      process.exit(1);
    }
    saveStoredToken(tokenPath, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      token_type: tokens.token_type ?? undefined,
      scope: tokens.scope ?? undefined,
    });
    spinner.stop(`Saved refresh token to ${tokenPath}`);
    p.outro(chalk.green('Gmail authentication ready.'));
  } catch (err) {
    spinner.stop('Token exchange failed.');
    p.log.error(String(err));
    process.exit(1);
  }
}

main();
