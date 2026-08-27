import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Insider Trading Compliance Portal";

export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function buildTotp(base32Secret: string, accountLabel: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

export async function generateQrCodeDataUrl(base32Secret: string, accountLabel: string): Promise<string> {
  const totp = buildTotp(base32Secret, accountLabel);
  const uri = totp.toString();
  return QRCode.toDataURL(uri, { margin: 1, width: 240 });
}

/**
 * Verifies a 6-digit code against the secret, allowing ±1 time step (30s) of clock drift.
 * Returns true if valid.
 */
export function verifyTotpCode(base32Secret: string, accountLabel: string, code: string): boolean {
  const totp = buildTotp(base32Secret, accountLabel);
  const delta = totp.validate({ token: code.trim(), window: 1 });
  return delta !== null;
}
