import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? '');

// Route → required permission key
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/monitor': 'monitor',
  '/groups': 'groups',
  '/oas': 'oas',
  '/employees': 'employees',
  '/summaries': 'summaries',
  '/issue-categories': 'issue-categories',
  '/conversations': 'conversations',
  '/settings': 'settings',
  '/users': 'users',
  '/permission-groups': 'permission-groups',
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page and all API routes (proxy handles its own logic)
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = payload as { isSuperAdmin?: boolean; permissions?: string[] };

    // Superadmin bypasses all permission checks
    if (user.isSuperAdmin) return NextResponse.next();

    const permissions = user.permissions ?? [];

    // Check if this route requires a specific permission
    for (const [routePrefix, permKey] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
        if (!permissions.includes(permKey)) {
          return NextResponse.redirect(new URL('/', req.url));
        }
        break;
      }
    }

    return NextResponse.next();
  } catch {
    // Token invalid or expired — clear cookies and redirect to login
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('auth-token');
    response.cookies.delete('user-info');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
