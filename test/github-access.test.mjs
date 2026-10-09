import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const authCode = await readFile('assets/js/github-auth.js', 'utf8');
const publishCode = await readFile('assets/js/github-publish.js', 'utf8');
const fixtureToken = 'test-token-not-a-real-credential';
const existingBlob = { type: 'file', encoding: 'base64', content: 'W10K', sha: 'existing-blob-sha' };

function loadAuth(writeStatus) {
  const requests = [];
  const context = vm.createContext({
    fetch: async (url, options = {}) => {
      requests.push({ url, ...options });
      assert.equal(options.headers.Authorization, 'Bearer ' + fixtureToken);
      if (url.endsWith('/user')) return Response.json({ login: 'foxnove' });
      if (url.endsWith('/repos/foxnove/mesmo-tarde')) return Response.json({ full_name: 'foxnove/mesmo-tarde', permissions: { push: true } });
      if (url.endsWith('/contents/songs_data.json?ref=main')) return Response.json(existingBlob);
      if (url.endsWith('/git/blobs')) return writeStatus === 201 ? Response.json({ sha: 'existing-blob-sha' }, { status: 201 }) :
        Response.json({ message: 'Resource not accessible by personal access token' }, { status: writeStatus });
      throw new Error('Unexpected endpoint: ' + url);
    },
    localStorage: { removeItem() {}, setItem() { throw new Error('Token must not be persisted'); } },
    sessionStorage: { removeItem() {}, setItem() { throw new Error('Token must not be persisted'); } }
  });
  vm.runInContext(authCode, context);
  return { auth: context.GithubAuth, requests };
}

test('Owner access cannot authenticate a token without Contents write permission', async () => {
  const { auth } = loadAuth(403);
  await assert.rejects(auth.validateAndAuthenticate(fixtureToken), /Contents: Read and write/);
  assert.equal(auth.isAuthenticated(), false);
  assert.equal(auth.getSessionToken(), null);
});

test('Write validation reuses the exact existing blob, changes no file or branch, and retains token only until logout', async () => {
  const { auth, requests } = loadAuth(201);
  await auth.validateAndAuthenticate(fixtureToken);
  assert.equal(auth.isAuthenticated(), true);
  const writes = requests.filter(r => r.method === 'POST');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, 'https://api.github.com/repos/foxnove/mesmo-tarde/git/blobs');
  assert.deepEqual(JSON.parse(writes[0].body), { content: 'W10K', encoding: 'base64' });
  assert.equal(auth.getSessionToken(), fixtureToken);
  auth.clearSession();
  assert.equal(auth.getSessionToken(), null);
});

const songs = JSON.parse(await readFile('songs_data.json', 'utf8'));

test('A publication permission failure explains repo and Contents permission without losing edits or exposing the token', async () => {
  const context = vm.createContext({
    GithubAuth: { getSessionToken: () => fixtureToken },
    fetch: async () => Response.json({ message: 'Resource not accessible by personal access token' }, { status: 403 })
  });
  vm.runInContext(publishCode, context);
  const before = JSON.stringify(songs);
  await assert.rejects(context.GithubPublish.publishAtomic(songs), error => {
    assert.match(error.message, /Contents: Read and write/);
    assert.match(error.message, /foxnove\/mesmo-tarde/);
    assert.ok(!error.message.includes(fixtureToken));
    return true;
  });
  assert.equal(JSON.stringify(songs), before);
});
