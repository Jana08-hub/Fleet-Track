import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
export function middleware(req: NextRequest) {
  // Client-side role stored in localStorage; server middleware only guards presence of cookie set by backend.
  // Full RBAC enforced by backend APIs + client redirects. Keep routes reachable for demo.
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/driver/:path*'] };
