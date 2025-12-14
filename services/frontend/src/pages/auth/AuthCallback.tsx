import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      try {
        // Check for error in URL (from OAuth or email verification)
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (errorParam) {
          setError(errorDescription || errorParam)
          return
        }

        // Check for error_code (Supabase format)
        const errorCode = searchParams.get('error_code')
        if (errorCode) {
          const errorMsg = searchParams.get('error_description') || 'Authentication failed'
          setError(errorMsg)
          return
        }

        // Check if this is a password recovery flow
        const type = searchParams.get('type')
        if (type === 'recovery') {
          // Redirect to password reset page
          navigate('/auth/reset-password', { replace: true })
          return
        }

        // Exchange code for session (handles both OAuth and email verification)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        )

        if (exchangeError) {
          // Handle specific error cases
          if (exchangeError.message.includes('expired')) {
            setError('This link has expired. Please request a new one.')
          } else if (exchangeError.message.includes('already')) {
            setError('This link has already been used.')
          } else {
            setError(exchangeError.message)
          }
          return
        }

        // Redirect to home or intended destination
        const redirectTo = searchParams.get('redirect') || '/'
        navigate(redirectTo, { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      }
    }

    handleCallback()
  }, [navigate, searchParams])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Error</CardTitle>
            <CardDescription>
              Something went wrong during authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/login">Return to login</Link>
            </Button>
            {error.includes('expired') && (
              <Button asChild variant="outline" className="w-full">
                <Link to="/register">Register again</Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Completing authentication...</CardTitle>
          <CardDescription>Please wait while we sign you in</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    </div>
  )
}
