import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n'
import { jwtVerify } from 'jose'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: false
})

const authenticatedRoutes = ['/profile', '/checkout', '/my-orders']
const notAuthenticatedRoutes = ['/login']

const enum RouteType {
  ADMIN = 'admin',
  SELLER = 'seller',
  AUTHENTICATED = 'authenticated',
  NOT_AUTHENTICATED = 'not_authenticated',
  PUBLIC = 'public',
}

const routeType = (pathname: string) => {
  if (pathname.startsWith('/admin')) {
    return RouteType.ADMIN
  } else if (pathname.startsWith('/seller')) {
    return RouteType.SELLER
  } else if (authenticatedRoutes.includes(pathname)) {
    return RouteType.AUTHENTICATED
  } else if (notAuthenticatedRoutes.includes(pathname)) {
    return RouteType.NOT_AUTHENTICATED
  } else {
    return RouteType.PUBLIC
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const route_type = routeType(pathname)
  if (route_type === RouteType.PUBLIC) {
    return intlMiddleware(req)
  }

  // 2️⃣ Auth
  const token = req.cookies.get('accessToken')?.value
  if (!token) {
    if (pathname.startsWith('/login')) {
      return intlMiddleware(req)
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token ?? '', secret)

    if (route_type === RouteType.NOT_AUTHENTICATED) {
      // user is authenticated and trying to access a route that is explicitly designed for not authenticated users
      return NextResponse.redirect(new URL('/', req.url))
    }
  
    if (route_type === RouteType.AUTHENTICATED) {
      return intlMiddleware(req)
    }

    const isSeller = payload.is_producer || payload.is_roaster

    if (route_type === RouteType.ADMIN && !payload.is_admin) {
      return NextResponse.redirect(new URL('/403', req.url))
    } else if (route_type === RouteType.SELLER && !isSeller) {
      return NextResponse.redirect(new URL('/403', req.url))
    }

    // 3️⃣ Si todo está bien → intl
    return intlMiddleware(req)
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}


export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
