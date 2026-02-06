import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        // Handle Role-Based Redirection
        const token = req.nextauth.token
        const isCollaborator = token?.role === "COLLABORATOR"
        const isProvider = token?.role === "PROVIDER"
        const isAdminPage = req.nextUrl.pathname.startsWith("/admin")
        const isProviderPage = req.nextUrl.pathname.startsWith("/provider")
        const isWorkspacePage = req.nextUrl.pathname.startsWith("/workspace")

        // Collaborators can only access workspace
        if (isCollaborator && isAdminPage) {
            return NextResponse.redirect(new URL("/workspace", req.url))
        }

        // Providers can only access provider pages
        if (isProvider && (isAdminPage || isWorkspacePage)) {
            return NextResponse.redirect(new URL("/provider", req.url))
        }

        // Non-providers cannot access provider pages
        if (!isProvider && isProviderPage) {
            return NextResponse.redirect(new URL("/admin", req.url))
        }
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
)

export const config = { 
    matcher: [
        "/dashboard/:path*", 
        "/prompts/:path*", 
        "/contacts/:path*", 
        "/conversations/:path*", 
        "/admin/:path*", 
        "/workspace/:path*",
        "/provider/:path*"
    ] 
}
