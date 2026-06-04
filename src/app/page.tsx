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
      setError("Forkert email eller adgangskode.")
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <img src="/logo.png" alt="VaekstNet" style={{height:32, margin:"0 auto 16px", display:"block"}} />
          <span className="sub">VaekstNet Dashboard — Intern adgang</span>
        </div>
        <h2>Log ind</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="navn@vaekstkapital.com"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Adgangskode</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Logger ind…" : "Log ind"}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
