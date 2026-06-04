import bcrypt from "bcryptjs"

// Generate a new hash at bcrypt-generator.com (10 rounds) and replace this
const SHARED_PASSWORD_HASH = process.env.SHARED_PASSWORD_HASH || "$2a$10$placeholder"

const ALLOWED_DOMAINS = [
  "vaekstkapital.com",
  "vaekstkapital.dk",
  "vaekstnet.com",
  "vkfunddistribution.com",
  "vaekstholdings.com",
]

export function findUserByEmail(email: string) {
  const lower = email.toLowerCase()
  const domain = lower.split("@")[1]
  if (domain && ALLOWED_DOMAINS.includes(domain)) {
    return {
      id: lower,
      name: email.split("@")[0],
      email: lower,
      passwordHash: SHARED_PASSWORD_HASH,
    }
  }
  return null
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}
