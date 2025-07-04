// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateSession } from '@/lib/session'

const protectedPaths = ['/dashboard', '/sales', '/costs', '/profits', '/map', '/settings']
const authPaths = ['/login', '/reset-password']
const PUBLIC_FILE = /\.(.*)$/

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip /health and public files
  if (pathname === '/health' || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

  // Check session status
  const { isValid, userRole } = await validateSession()

  // Determine if the request is for protected paths or auth pages
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  const isAuthPath = authPaths.some(path => pathname.startsWith(path))

  // If user is not logged in and tries to access protected path
  if (!isValid && isProtectedPath) {
    const searchParams = new URLSearchParams()
    searchParams.set('redirect', pathname)
    return NextResponse.redirect(new URL(`/login?${searchParams.toString()}`, request.url))
  }

  // If user is logged in and tries to access auth pages
  if (isValid && isAuthPath) {
    const defaultRedirect = (userRole === 'ADMIN' || userRole === 'BOARD') ? '/dashboard' : '/costs'
    return NextResponse.redirect(new URL(defaultRedirect, request.url))
  }

  // Block access to /dashboard for users other than ADMIN/BOARD
  if (pathname.startsWith('/dashboard') && userRole !== 'ADMIN' && userRole !== 'BOARD') {
    return NextResponse.redirect(new URL('/costs', request.url))
  }


  // Redirect from homepage
  if (pathname === '/') {
    if (isValid) {
      const defaultPage = (userRole === 'ADMIN' || userRole === 'BOARD') ? '/dashboard' : '/costs'
      return NextResponse.redirect(new URL(defaultPage, request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Modify response to preserve user role information
  const response = NextResponse.next()
  if (isValid && userRole) {
    response.cookies.set('userRole', userRole, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|health).*)',
  ]
}