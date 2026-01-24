import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        // Handle Role-Based Redirection
        const token = req.nextauth.token
        const isCollaborator = token?.role === "COLLABORATOR"
        const isAdminPage = req.nextUrl.pathname.startsWith("/admin")

        if (isCollaborator && isAdminPage) {
            return NextResponse.redirect(new URL("/workspace", req.url))
        }
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
)

export const config = { matcher: ["/dashboard/:path*", "/prompts/:path*", "/contacts/:path*", "/conversations/:path*", "/admin/:path*", "/workspace/:path*"] }
