import crypto from "node:crypto";

export function createSessionToken(password: string, secret: string): string {
  return crypto.createHash("sha256").update(`${password}:${secret}`).digest("hex");
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (!rawKey) {
      return cookies;
    }

    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthenticated(cookieHeader: string | undefined, sessionToken: string): boolean {
  const cookies = parseCookies(cookieHeader);
  const cookieToken = cookies.fastmcp_session;

  if (!cookieToken) {
    return false;
  }

  return safeEqual(cookieToken, sessionToken);
}

export function matchesPassword(password: string, sessionToken: string, secret: string): boolean {
  return safeEqual(createSessionToken(password, secret), sessionToken);
}

export function buildSessionCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `fastmcp_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=28800`;
}

export function clearSessionCookie(): string {
  return "fastmcp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}
