const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const command = process.argv[2] || 'dev'
const projectRoot = path.resolve(__dirname, '..')
const distDir = command === 'dev' ? '.next-dev' : '.next'

// Only wipe output on production builds, or when explicitly requested.
// Clearing .next-dev on every `dev` start causes ENOENT vendor-chunk errors during HMR.
const shouldClean =
  command === 'build' ||
  process.env.CLEAN_NEXT === '1' ||
  process.env.CLEAN_NEXT_DEV === '1'

const distPath = path.join(projectRoot, distDir)

if (shouldClean) {
  fs.rmSync(distPath, { recursive: true, force: true })
  console.log(`[next-runner] Cleared ${distDir} before next ${command}`)
} else if (command === 'dev') {
  console.log(`[next-runner] Reusing ${distDir} (set CLEAN_NEXT_DEV=1 to wipe dev cache)`)
}

const nextBin = require.resolve('next/dist/bin/next')
const child = spawn(process.execPath, [nextBin, command], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(`[next-runner] Failed to start next ${command}`, error)
  process.exit(1)
})
