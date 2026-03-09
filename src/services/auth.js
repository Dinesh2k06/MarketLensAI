/* ─────────────────────────────────────────────────────────────────────────────
   auth.js  —  Supabase Authentication Service

   Handles user signup, login, logout, and session management using Supabase Auth.
   ───────────────────────────────────────────────────────────────────────────── */

import { supabase } from './supabase'

/**
 * Sign up a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Object} { user, error }
 */
export async function signUp(email, password) {
  if (!supabase) {
    console.warn('[auth] Supabase not configured, returning mock user')
    return {
      user: { id: crypto.randomUUID(), email },
      error: null
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    console.error('[auth] signUp error:', error.message)
    return { user: null, error }
  }

  return { user: data.user, error: null }
}

/**
 * Sign in an existing user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Object} { user, error }
 */
export async function signIn(email, password) {
  if (!supabase) {
    console.warn('[auth] Supabase not configured, returning mock user')
    return {
      user: { id: crypto.randomUUID(), email },
      error: null
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('[auth] signIn error:', error.message)
    return { user: null, error }
  }

  return { user: data.user, error: null }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  if (!supabase) {
    console.warn('[auth] Supabase not configured')
    return
  }

  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('[auth] signOut error:', error.message)
  }
}

/**
 * Get the currently authenticated user
 * @returns {Object|null} User object or null
 */
export async function getCurrentUser() {
  if (!supabase) {
    console.warn('[auth] Supabase not configured')
    return null
  }

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('[auth] getCurrentUser error:', error.message)
    return null
  }

  return user
}

/**
 * Get the current session
 * @returns {Object|null} Session object or null
 */
export async function getSession() {
  if (!supabase) {
    console.warn('[auth] Supabase not configured')
    return null
  }

  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('[auth] getSession error:', error.message)
    return null
  }

  return session
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Called with (event, session)
 * @returns {Object} Subscription object with unsubscribe method
 */
export function onAuthStateChange(callback) {
  if (!supabase) {
    console.warn('[auth] Supabase not configured')
    return { data: { subscription: { unsubscribe: () => {} } } }
  }

  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}
