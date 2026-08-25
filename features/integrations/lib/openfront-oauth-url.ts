export function buildOpenFrontOAuthUrl({
  domain,
  appKey,
  callbackUrl,
  state,
  scopes,
}: {
  domain: string;
  appKey: string;
  callbackUrl: string;
  state: string;
  scopes: string;
}): string {
  if (!state) {
    throw new Error("OpenFront OAuth requires signed state");
  }

  const url = new URL("/dashboard/platform/apps", domain);
  url.searchParams.set("install", "true");
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  return url.toString();
}
