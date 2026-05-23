#!/usr/bin/env node
/**
 * Production startup script for Render deployment
 * 
 * This script starts both the backend API server and frontend Next.js server
 * in the correct order with proper error handling and logging.
 */

const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

// Ensure NODE_ENV is production
process.env.NODE_ENV = 'production'

const BACKEND_PORT = process.env.PORT || '8000'
const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000'
const API_URL = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${BACKEND_PORT}/api`

// Log startup information
console.log(`
╔══════════════════════════════════════════════════════════╗
║        THINAVA PRODUCTION STARTUP SEQUENCE              ║
╠══════════════════════════════════════════════════════════╣
║  Backend Port:     ${BACKEND_PORT.padEnd(43)}║
║  Frontend Port:    ${FRONTEND_PORT.padEnd(43)}║
║  API URL:          ${API_URL.substring(0, 43).padEnd(43)}║
║  Environment:      production                          ║
║  Node Version:     ${process.version.substring(0, 43).padEnd(43)}║
╚══════════════════════════════════════════════════════════╝
`)

// Store child processes for graceful shutdown
const children = []

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SHUTDOWN] SIGTERM received, shutting down gracefully...')
  children.forEach(child => {
    console.log(`[SHUTDOWN] Terminating process ${child.pid}...`)
    child.kill('SIGTERM')
  })
  setTimeout(() => {
    console.log('[SHUTDOWN] Force killing remaining processes...')
    children.forEach(child => {
      if (!child.killed) {
        child.kill('SIGKILL')
      }
    })
    process.exit(0)
  }, 5000)
})

process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] SIGINT received, shutting down...')
  children.forEach(child => child.kill())
  process.exit(0)
})

// Function to spawn a process with proper logging
function spawnService(name, command, args, cwd = process.cwd()) {
  console.log(`\n[${name}] Starting...`)
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  children.push(child)

  // Log stdout
  if (child.stdout) {
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.log(`[${name}] ${line}`))
    })
  }

  // Log stderr
  if (child.stderr) {
    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.error(`[${name}] ✗ ${line}`))
    })
  }

  // Handle exit
  child.on('exit', (code) => {
    const index = children.indexOf(child)
    if (index > -1) children.splice(index, 1)

    if (code === 0) {
      console.log(`[${name}] ✓ Process exited with code 0`)
    } else {
      console.error(`[${name}] ✗ Process exited with code ${code}`)
      // If any child dies, kill all and exit
      children.forEach(c => c.kill())
      process.exit(1)
    }
  })

  child.on('error', (err) => {
    console.error(`[${name}] ✗ Error: ${err.message}`)
    children.forEach(c => c.kill())
    process.exit(1)
  })

  return child
}

// Step 1: Start backend server (API)
console.log('\n[STARTUP] Step 1/2: Starting backend API server...')
const backendCwd = path.join(__dirname, 'server')

// Verify server files exist
if (!fs.existsSync(path.join(backendCwd, 'src', 'index.js'))) {
  console.error('❌ Server startup file not found: server/src/index.js')
  process.exit(1)
}

const backend = spawnService(
  'BACKEND',
  'node',
  ['src/index.js'],
  backendCwd
)

// Wait for backend to start before starting frontend
// (This is approximate - we wait a few seconds for startup)
setTimeout(() => {
  console.log('\n[STARTUP] Step 2/2: Starting frontend Next.js server...')

  // Verify Next.js build exists
  if (!fs.existsSync(path.join(__dirname, '.next'))) {
    console.error('❌ Next.js build not found: .next directory')
    console.error('   Run: npm run build')
    children.forEach(c => c.kill())
    process.exit(1)
  }

  const frontend = spawnService(
    'FRONTEND',
    'node',
    ['scripts/run-next.cjs', 'start'],
    __dirname
  )

  console.log(`
╔══════════════════════════════════════════════════════════╗
║           SERVICES STARTED SUCCESSFULLY                  ║
╠══════════════════════════════════════════════════════════╣
║  ✓ Backend API:  http://localhost:${BACKEND_PORT.padEnd(42)}║
║  ✓ Frontend Web: http://localhost:${FRONTEND_PORT.padEnd(42)}║
║                                                          ║
║  Access the app at: http://localhost:${FRONTEND_PORT.padEnd(39)}║
╚══════════════════════════════════════════════════════════╝
`)

  // Log running status periodically
  console.log('\n[INFO] Services running - press Ctrl+C to stop\n')

}, 3000)
