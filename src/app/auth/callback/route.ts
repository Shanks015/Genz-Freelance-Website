import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    if (code) {
        console.log("DEBUG: Callback route triggered with code:", code.substring(0, 10) + "...")
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (!error) {
            console.log("DEBUG: Successfully exchanged code for session. Redirecting to:", next)
            const forwardedHost = request.headers.get('x-forwarded-host')
            const protocol = request.headers.get('x-forwarded-proto') || 'http'
            const isLocalEnv = process.env.NODE_ENV === 'development'
            
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`${protocol}://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }
        console.error("DEBUG: Error exchanging code for session:", error.message, error)
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`)
    } else {
        console.warn("DEBUG: Callback route triggered without code parameter")
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=Missing+code+parameter`)
}
