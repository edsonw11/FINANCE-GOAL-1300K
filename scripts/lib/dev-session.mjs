/**
 * scripts/lib/dev-session.mjs
 * Responsibility: signs in to the local stack through Keycloak the way a browser does, for the development scripts (seed, check).
 */
export const API = process.env.API_URL ?? 'http://localhost:3000';
export const PEOPLE = { alice: 'alice-dev-password', bob: 'bob-dev-password' };

/** A browser's cookie handling, as little as this needs: one jar per host. */
export class Jar {
  #jars = new Map();
  header(url) { return [...(this.#jars.get(new URL(url).host) ?? new Map())].map(([k, v]) => `${k}=${v}`).join('; '); }
  store(url, res) {
    const jar = this.#jars.get(new URL(url).host) ?? new Map();
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      const [name, value] = [pair.slice(0, i).trim(), pair.slice(i + 1)];
      if (/expires=Thu, 01 Jan 1970/i.test(line) || /max-age=0/i.test(line)) jar.delete(name); else jar.set(name, value);
    }
    this.#jars.set(new URL(url).host, jar);
  }
  async fetch(url, init = {}) {
    const res = await fetch(url, { ...init, redirect: 'manual', headers: { ...init.headers, cookie: this.header(url) } });
    this.store(url, res);
    return res;
  }
}

/** Signs in through the identity provider and returns a jar holding the API session. */
export async function signIn(user, password) {
  const jar = new Jar();
  let res = await jar.fetch(`${API}/auth/login`);
  if (res.status === 429) throw new Error(`too many sign-ins in a minute (the API limits them); try again in ${res.headers.get('retry-after') ?? 'a minute'} seconds`);
  if (res.status !== 302) throw new Error(`login did not redirect (${res.status}): is the API up at ${API}?`);
  res = await jar.fetch(res.headers.get('location'));
  const html = await res.text();
  const action = /<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/.exec(html)?.[1] ?? /<form[^>]*action="([^"]+)"[^>]*id="kc-form-login"/.exec(html)?.[1];
  if (!action) throw new Error('the Keycloak login form was not found');
  res = await jar.fetch(action.replaceAll('&amp;', '&'), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: user, password }) });
  if (res.status !== 302) throw new Error(`Keycloak refused ${user} (${res.status})`);
  res = await jar.fetch(res.headers.get('location'));
  if (!jar.header(API).includes('=')) throw new Error(`no session after the callback (${res.status} ${res.headers.get('location')})`);
  return jar;
}
