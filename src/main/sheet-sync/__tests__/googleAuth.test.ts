import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyServiceAccountKey } from '../googleAuth';

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeTempDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-builder-google-key-'));
  tempDirectories.push(directory);
  return directory;
}

function writeKey(filePath: string, clientEmail: string): void {
  fs.writeFileSync(filePath, JSON.stringify({
    client_email: clientEmail,
    private_key: 'test-private-key',
  }));
}

describe('copyServiceAccountKey', () => {
  it('validates and copies the selected key into app data', () => {
    const root = makeTempDirectory();
    const sourcePath = path.join(root, 'downloaded-key.json');
    const userDataPath = path.join(root, 'user-data');
    writeKey(sourcePath, 'first@example.iam.gserviceaccount.com');

    const storedPath = copyServiceAccountKey(sourcePath, userDataPath);

    expect(storedPath).toBe(path.join(userDataPath, 'mtg-builder-google-service-account.json'));
    expect(JSON.parse(fs.readFileSync(storedPath, 'utf8'))).toEqual({
      client_email: 'first@example.iam.gserviceaccount.com',
      private_key: 'test-private-key',
    });
  });

  it('replaces the app copy when a different key is selected', () => {
    const root = makeTempDirectory();
    const sourcePath = path.join(root, 'downloaded-key.json');
    const userDataPath = path.join(root, 'user-data');
    writeKey(sourcePath, 'first@example.iam.gserviceaccount.com');
    const storedPath = copyServiceAccountKey(sourcePath, userDataPath);

    writeKey(sourcePath, 'second@example.iam.gserviceaccount.com');
    copyServiceAccountKey(sourcePath, userDataPath);

    expect(JSON.parse(fs.readFileSync(storedPath, 'utf8')).client_email).toBe(
      'second@example.iam.gserviceaccount.com',
    );
  });

  it('rejects files that are not service-account keys', () => {
    const root = makeTempDirectory();
    const sourcePath = path.join(root, 'not-a-key.json');
    fs.writeFileSync(sourcePath, JSON.stringify({ hello: 'world' }));

    expect(() => copyServiceAccountKey(sourcePath, path.join(root, 'user-data'))).toThrow(
      /missing client_email\/private_key/,
    );
  });
});
