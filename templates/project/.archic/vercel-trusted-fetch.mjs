const trustToken = process.env.VERCEL_TRUST_TOKEN;
const controlUrl = process.env.CONTROL_URL;
const originalFetch = globalThis.fetch;

if (trustToken && controlUrl && typeof originalFetch === "function") {
  let controlOrigin = null;
  try {
    controlOrigin = new URL(controlUrl).origin;
  } catch {
    controlOrigin = null;
  }

  if (controlOrigin) {
    globalThis.fetch = async (input, init = {}) => {
      const url = input instanceof Request ? input.url : String(input);
      let matchesControl = false;
      try {
        matchesControl = new URL(url).origin === controlOrigin;
      } catch {
        matchesControl = false;
      }
      if (!matchesControl) return originalFetch(input, init);

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      headers.set("x-vercel-trusted-oidc-idp-token", trustToken);
      return originalFetch(input, { ...init, headers });
    };
  }
}
