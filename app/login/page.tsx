'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const res = await signIn('credentials', {
                email,
                password,
                redirect: false,
            })

            if (res?.error) {
                setError('Invalid credentials. Access denied.')
                setIsLoading(false)
            } else {
                router.push('/dashboard')
            }
        } catch (error) {
            setError('Something went wrong')
            setIsLoading(false)
        }
    }

    if (!mounted) return null

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] p-4 relative overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-sm space-y-8 relative z-10">

                {/* Header Logo */}
                <div className="text-center space-y-2">
                    <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-white/10 shadow-xl backdrop-blur-md">
                        <ShieldCheck className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mt-4">
                        Admin Portal
                    </h1>
                    <p className="text-white/40 text-sm">
                        Enter your secure credentials
                    </p>
                </div>

                {/* Login Form */}
                <div className="glass rounded-3xl p-8 space-y-6 shadow-2xl shadow-black/50">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <div className="relative">
                                <Input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl focus:bg-white/10 transition-colors"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="relative">
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl focus:bg-white/10 transition-colors"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                                <Lock className="h-4 w-4" />
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-xl font-medium transition-all"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    Sign In <ArrowRight className="h-4 w-4" />
                                </span>
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-white/20 text-xs">
                    Protected by secure encryption.
                </p>
            </div>
        </div>
    )
}
