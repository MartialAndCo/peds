import { withAuth } from "next-auth/middleware"

export default withAuth({
    callbacks: {
        authorized: ({ req, token }) => {
            // Allow webhooks and cron jobs to be accessed without a token
            if (req.nextUrl.pathname.startsWith('/api/webhooks') || req.nextUrl.pathname.startsWith('/api/cron')) {
                return true
            }
            // Require token for all other protected routes
            return !!token
        },
    },
})

export const config = { matcher: ["/dashboard/:path*", "/prompts/:path*", "/contacts/:path*", "/conversations/:path*", "/api/:path*"] }
