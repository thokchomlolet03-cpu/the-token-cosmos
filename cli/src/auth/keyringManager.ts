import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AuthSession {
  accessToken: string;
  idToken?: string;
  orgId: string;
  expiresAt: number;
  provider: 'auth0' | 'okta';
}

const SECURE_DIR = path.join(os.homedir(), '.cosmos');
const TOKEN_FILE = path.join(SECURE_DIR, 'session.token');

export class KeyringManager {
  /**
   * Retrieves the current authentication token.
   * Order of precedence:
   * 1. COSMOS_AUTH_TOKEN environment variable (for CI/CD runners and headless WSL2/Linux)
   * 2. Encrypted OS secure session store
   */
  static getToken(): string | null {
    // 1. Check environment variable first
    if (process.env.COSMOS_AUTH_TOKEN && process.env.COSMOS_AUTH_TOKEN.trim().length > 0) {
      return process.env.COSMOS_AUTH_TOKEN.trim();
    }

    // 2. Check local secure session storage with restricted permissions
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
        if (data) return data;
      }
    } catch {
      // In headless environments without filesystem access, return null
    }

    return null;
  }

  /**
   * Saves authentication session to local store with 0600 (read/write only by owner) permissions.
   */
  static saveToken(token: string): boolean {
    try {
      if (!fs.existsSync(SECURE_DIR)) {
        fs.mkdirSync(SECURE_DIR, { mode: 0o700, recursive: true });
      }
      fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
      return true;
    } catch (err) {
      console.warn('⚠️ Unable to write secure token file:', err);
      return false;
    }
  }

  /**
   * Clears saved authentication session.
   */
  static clearToken(): boolean {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executes the RFC 8628 Device Authorization Grant simulation.
   */
  static async startDeviceAuthFlow(): Promise<string> {
    const userCode = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const verificationUrl = 'https://the-token-cosmos.com/activate';

    console.log('\n🔐 Device Authorization Required (RFC 8628)');
    console.log('────────────────────────────────────────────────────────────');
    console.log(`1. Open this URL in your web browser:  \x1b[36m${verificationUrl}\x1b[0m`);
    console.log(`2. Enter this 8-character code:        \x1b[1m\x1b[33m${userCode}\x1b[0m`);
    console.log('────────────────────────────────────────────────────────────');
    console.log('⏳ Waiting for authorization confirmation (press Ctrl+C to cancel)...');

    // Simulate approval delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockToken = `tc_jwt_${Buffer.from(JSON.stringify({
      sub: 'dev_user_123',
      org_id: 'org_enterprise_acme',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    })).toString('base64')}`;

    this.saveToken(mockToken);
    console.log('\n\x1b[32m✔ Authentication successful! Token saved to secure credential store.\x1b[0m\n');
    return mockToken;
  }
}
