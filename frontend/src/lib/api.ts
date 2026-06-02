import axios from 'axios'
import { useAuthStore } from '../store/authStore'

/**
 * Normalize VITE_API_URL so it always ends in `/api/v1` with no trailing slash.
 *
 * Why: On Vercel it's easy to paste the Railway backend URL without the
 * `/api/v1` suffix (e.g. `https://aveonapex-api-production.up.railway.app`).
 * Since every backend router is mounted under `/api/v1`, the raw root URL
 * returns 404 on /auth/login. This helper guarantees the suffix is present
 * regardless of how the env var was configured.
 */
function normalizeApiUrl(raw: string | undefined): string {
  const fallback = 'http://localhost:8000/api/v1'
  let url = (raw || fallback).trim()
  // Strip trailing slashes
  url = url.replace(/\/+$/, '')
  // Append /api/v1 if missing
  if (!/\/api\/v\d+$/.test(url)) {
    url = `${url}/api/v1`
  }
  return url
}

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL)

// Diagnostic: print the resolved API URL exactly once at startup so we can
// verify in the browser console which backend the build is pointing at.
// eslint-disable-next-line no-console
console.info('[AveonApex] API URL =', API_URL)

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401, auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
