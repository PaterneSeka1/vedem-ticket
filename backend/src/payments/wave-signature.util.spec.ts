import { createHmac } from 'node:crypto';
import { verifyWaveSignature } from './wave-signature.util.js';

const SECRET = 'test_webhook_secret';

function sign(body: Buffer, timestampSeconds: number, secret = SECRET): string {
  const signature = createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(String(timestampSeconds)), body]))
    .digest('hex');
  return `t=${timestampSeconds},v1=${signature}`;
}

describe('verifyWaveSignature', () => {
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));

  it('accepts a correctly signed, fresh header', () => {
    const header = sign(body, Math.floor(Date.now() / 1000));
    expect(verifyWaveSignature(header, body, SECRET)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const header = sign(body, Math.floor(Date.now() / 1000), 'wrong_secret');
    expect(verifyWaveSignature(header, body, SECRET)).toBe(false);
  });

  it('rejects a header whose body does not match (tampered payload)', () => {
    const header = sign(body, Math.floor(Date.now() / 1000));
    const tamperedBody = Buffer.from(JSON.stringify({ hello: 'tampered' }));
    expect(verifyWaveSignature(header, tamperedBody, SECRET)).toBe(false);
  });

  it('rejects a timestamp outside the tolerance window (replay protection)', () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    const header = sign(body, tenMinutesAgo);
    expect(verifyWaveSignature(header, body, SECRET)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyWaveSignature(undefined, body, SECRET)).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(verifyWaveSignature('not-a-valid-header', body, SECRET)).toBe(false);
  });
});
