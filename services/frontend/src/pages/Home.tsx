import { useAuthStore } from '@/stores/authStore'

export default function Home() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="container mx-auto py-8">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Welcome to Vanguard PBP</h1>
          <p className="text-muted-foreground">
            Logged in as {user?.email}
          </p>
        </div>
        <div className="mt-4">
          <button
            onClick={() => signOut()}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
