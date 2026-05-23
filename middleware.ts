import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAMES } from '@/lib/auth/cookies'

const isProtectedCustomerRoute = (pathname: string) =>
  pathname === '/orders' ||
  pathname.startsWith('/profile') ||
  pathname === '/favorites'

const isProtectedDeliveryRoute = (pathname: string) =>
  pathname.startsWith('/delivery') &&
  pathname !== '/delivery/login' &&
  pathname !== '/delivery/register'

const isProtectedRestaurantRoute = (pathname: string) =>
  pathname === '/restaurant/dashboard' ||
  pathname === '/restaurant/orders' ||
  pathname === '/restaurant/menu' ||
  pathname === '/restaurant/categories' ||
  pathname === '/restaurant/settings'

const isProtectedAdminRoute = (pathname: string) =>
  pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin'

const redirectToLogin = (request: NextRequest, loginPath: string) => {
  const url = new URL(loginPath, request.url)

  if (loginPath === '/login') {
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
    url.searchParams.set('next', nextPath)
  }

  return NextResponse.redirect(url)
}

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    if (isProtectedAdminRoute(pathname)) {
      const cookie = request.cookies.get(AUTH_COOKIE_NAMES.admin)?.value
      if (!cookie) {
        return redirectToLogin(request, '/admin/login')
      }
    }

    if (isProtectedCustomerRoute(pathname) && !request.cookies.get(AUTH_COOKIE_NAMES.customer)?.value) {
      return redirectToLogin(request, '/login')
    }

    if (isProtectedDeliveryRoute(pathname) && !request.cookies.get(AUTH_COOKIE_NAMES.delivery)?.value) {
      return redirectToLogin(request, '/delivery/login')
    }

    if (isProtectedRestaurantRoute(pathname) && !request.cookies.get(AUTH_COOKIE_NAMES.restaurant)?.value) {
      return redirectToLogin(request, '/restaurant-auth')
    }

    return NextResponse.next()
  } catch (error) {
    console.error('[MIDDLEWARE_ERROR]', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/orders',
    '/profile/:path*',
    '/favorites',
    '/delivery/:path*',
    '/restaurant/dashboard',
    '/restaurant/orders',
    '/restaurant/menu',
    '/restaurant/categories',
    '/restaurant/settings',
    '/admin/:path*',
  ],
}
