import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildLoginRedirectUrl, getSafeRedirectPath } from "@/lib/auth/redirect";

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname.startsWith("/api/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let supabaseResponse = NextResponse.next({
    request
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { ok: false, message: "인증 환경변수가 설정되지 않았습니다." },
          { status: 500 }
        );
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  // getUser()로 서버 검증 (localStorage/쿠키 위조만 믿지 않음)
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // 로그인 페이지: 이미 세션 있으면면 redirect/dashboard로
  if (pathname === "/login") {
    if (user) {
      const redirectParam = request.nextUrl.searchParams.get("redirect");
      const target = getSafeRedirectPath(redirectParam, "/dashboard");
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 루트: 세션 있으면면 대시보드, 없으면 로그인
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    if (user) {
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isProtectedPath(pathname)) {
    return supabaseResponse;
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다. 다시 로그인해주세요." },
        { status: 401 }
      );
    }

    const nextPath = `${pathname}${search || ""}`;
    const loginPath = buildLoginRedirectUrl(nextPath);
    const url = request.nextUrl.clone();
    const [pathOnly, query = ""] = loginPath.split("?");
    url.pathname = pathOnly || "/login";
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * 정적 자산·이미지·파비콘 제외
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"
  ]
};
