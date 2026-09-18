import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}))

import {
  ADMIN_COOKIE_MAX_AGE_SECONDS,
  ADMIN_COOKIE_NAME,
  checkPassword,
  clearAdminCookie,
  isAdmin,
  setAdminCookie,
} from '../auth'

const password = 'known-admin-password'
const sessionSecret = 'known-session-secret'

beforeEach(() => {
  process.env.LITENCO_ADMIN_PASSWORD = password
  process.env.LITENCO_ADMIN_SESSION_SECRET = sessionSecret
  cookieStore.get.mockReset()
  cookieStore.set.mockReset()
})

describe('admin password authentication', () => {
  it('accepts the correct password', () => {
    expect(checkPassword(password)).toBe(true)
  })

  it('rejects an incorrect password', () => {
    expect(checkPassword('wrong-password')).toBe(false)
  })

  it('rejects missing configuration explicitly', async () => {
    delete process.env.LITENCO_ADMIN_PASSWORD
    expect(() => checkPassword(password)).toThrow('LITENCO_ADMIN_PASSWORD is not set')

    delete process.env.LITENCO_ADMIN_SESSION_SECRET
    await expect(setAdminCookie()).rejects.toThrow('LITENCO_ADMIN_SESSION_SECRET is not set')
  })
})

describe('admin sessions', () => {
  it('accepts a valid session', async () => {
    await setAdminCookie()
    const token = cookieStore.set.mock.calls[0][1]
    cookieStore.get.mockReturnValue({ value: token })

    await expect(isAdmin()).resolves.toBe(true)
  })

  it('rejects an invalid or tampered session', async () => {
    await setAdminCookie()
    const token = cookieStore.set.mock.calls[0][1]
    cookieStore.get.mockReturnValue({ value: `${token}tampered` })

    await expect(isAdmin()).resolves.toBe(false)
  })

  it('clears the admin session on logout', async () => {
    await clearAdminCookie()

    expect(cookieStore.set).toHaveBeenCalledWith(ADMIN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    expect(ADMIN_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 7)
  })
})