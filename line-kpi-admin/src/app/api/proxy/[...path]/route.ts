import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const API_KEY = process.env.API_KEY ?? '';
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const url = new URL(`/api/v1/${path}`, BACKEND_URL);
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const isAuthPath = path.startsWith('auth/');
  const isAdminPath = path.startsWith('admin/');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // API key not needed for public auth routes
  if (!isAuthPath) {
    headers['X-API-Key'] = API_KEY;
  }

  // Forward JWT as Authorization header for admin routes
  if (isAdminPath) {
    const authToken = req.cookies.get('auth-token')?.value;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
  }

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  const res = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  // ── Special handling: login ──────────────────────────────────
  if (path === 'auth/login') {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }
    const data = await res.json() as { token: string; user: { username: string; displayName: string; isSuperAdmin: boolean; permissions: string[] } };
    const response = NextResponse.json({ user: data.user });

    // httpOnly cookie — not readable by JS, used by middleware
    response.cookies.set('auth-token', data.token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    // Client-readable cookie — used by Sidebar to filter menus
    response.cookies.set('user-info', JSON.stringify(data.user), {
      httpOnly: false,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  }

  // ── Special handling: logout ─────────────────────────────────
  if (path === 'auth/logout') {
    const response = NextResponse.json({ ok: true });
    response.cookies.delete('auth-token');
    response.cookies.delete('user-info');
    return response;
  }

  // ── Default: forward response as-is ─────────────────────────
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function POST(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function PUT(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function DELETE(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function PATCH(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
