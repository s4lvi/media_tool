import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except public routes)
  const publicRoutes = ["/login", "/signup", "/"];
  const isPublicRoute = publicRoutes.some(
    (route) => request.nextUrl.pathname === route
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages and root
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup" || request.nextUrl.pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/posts";
    return NextResponse.redirect(url);
  }

  // Redirect legacy routes to new ones
  const legacyRedirects: Record<string, string> = {
    "/projects": "/posts",
    "/quick-create": "/posts/new",
  };
  if (legacyRedirects[request.nextUrl.pathname]) {
    const url = request.nextUrl.clone();
    url.pathname = legacyRedirects[request.nextUrl.pathname];
    return NextResponse.redirect(url);
  }
  // /projects/abc → /posts/abc
  if (request.nextUrl.pathname.startsWith("/projects/")) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname.replace("/projects/", "/posts/");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
