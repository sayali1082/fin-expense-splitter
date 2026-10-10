'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function JoinRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code

  useEffect(() => {
    if (code) {
      router.replace(`/?join=${encodeURIComponent(String(code))}`)
    } else {
      router.replace('/')
    }
  }, [code, router])

  return (
    <main className="app-main">
      <div className="simple-page">
        <div className="empty-state">
          <h2>Joining group...</h2>
          <p>Redirecting you to the group invite.</p>
        </div>
      </div>
    </main>
  )
}
