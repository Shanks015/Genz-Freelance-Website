'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
    const searchParams = useSearchParams()
    const error = searchParams.get('error')

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full border-2 border-[#E0FF00] p-10 rounded-3xl bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(224,255,0,0.2)]">
                <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-[#E0FF00]">
                    Auth Error ⚠️
                </h1>
                <p className="text-zinc-400 font-medium mb-4">
                    Something went wrong while trying to log you in.
                </p>
                {error && (
                    <div className="bg-red-500/10 border-2 border-red-500/50 p-4 rounded-xl mb-8 text-red-400 text-sm font-mono break-words">
                        {error}
                    </div>
                )}
                <Link 
                    href="/login"
                    className="inline-block px-8 py-4 bg-[#E0FF00] text-black font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:translate-x-[-2px] active:translate-y-[2px] active:translate-x-[2px] transition-all"
                >
                    Back to Login
                </Link>
            </div>
        </div>
    )
}

export default function AuthCodeError() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase">Loading...</div>}>
            <ErrorContent />
        </Suspense>
    )
}
