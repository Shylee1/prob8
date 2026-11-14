import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeExternalWebhookUrl } from './webhookSecurity';

test('isSafeExternalWebhookUrl allows public HTTPS webhook endpoints', () => {
  assert.deepEqual(
    isSafeExternalWebhookUrl('https://hooks.zapier.com/hooks/catch/123456/abcdef'),
    { safe: true }
  );
  assert.deepEqual(isSafeExternalWebhookUrl('https://hook.us1.make.com/abc123'), { safe: true });
});

test('isSafeExternalWebhookUrl blocks loopback, private, and cloud metadata SSRF targets', () => {
  const blocked = [
    'http://127.0.0.1:3000/api/health',
    'http://localhost:11434/api/tags',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'https://10.0.0.5/webhook',
    'https://172.16.0.12/hook',
    'https://192.168.1.1/admin',
    'http://[::1]:8080/internal',
    'ftp://files.example.com/hook',
    'http://2130706433/',
  ];

  for (const url of blocked) {
    const res = isSafeExternalWebhookUrl(url);
    assert.equal(res.safe, false, `Expected URL to be blocked: ${url}`);
    assert.ok(res.reason);
  }
});
