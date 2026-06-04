"use client"
// @ts-nocheck
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.ok) {
      router.push("/users")
    } else {
      setError("Incorrect email or password.")
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          {/* Dot constellation mark */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{margin:"0 auto 10px",display:"block"}}>
            <circle cx="10" cy="18" r="5.5" fill="#172643"/>
            <circle cx="22" cy="12" r="3.8" fill="#172643"/>
            <circle cx="28" cy="22" r="2.8" fill="#172643"/>
            <circle cx="17" cy="27" r="2.2" fill="#88bedd"/>
            <circle cx="26" cy="10" r="1.6" fill="#88bedd"/>
          </svg>
          <div className="wordmark">VaekstKapital</div>
          <span className="sub">Lead Dashboard</span>
        </div>
        <h2>Sign in</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@vaekstkapital.com"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
