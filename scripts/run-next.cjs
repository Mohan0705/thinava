const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const command = process.argv[2] || 'dev'
const projectRoot = path.resolve(__dirname, '..')
const distDir = command === 'dev' ? '.next-dev' : '.next'
const shouldClean = command === 'dev' || command === 'build'
const distPath = path.join(projectRoot, distDir)

if (shouldClean) {
  fs.rmSync(distPath, { recursive: true, force: true })
  console.log(`[next-runner] Cleared ${distDir} before next ${command}`)
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
