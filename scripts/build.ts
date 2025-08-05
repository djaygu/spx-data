#!/usr/bin/env bun

import { $ } from 'bun'

const entrypoint = './src/main.ts'
const outdir = './dist'
const outfile = 'spx-data'

console.log('Building spx-data binary...')

try {
  // Clean dist directory
  await $`rm -rf ${outdir}`
  await $`mkdir -p ${outdir}`

  // Build the binary
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir,
    target: 'bun',
    format: 'esm',
    minify: true,
    sourcemap: 'external',
  })

  if (!result.success) {
    console.error('Build failed:', result.logs)
    process.exit(1)
  }

  // Make the output executable
  const outputPath = `${outdir}/${outfile}`
  await $`mv ${outdir}/main.js ${outputPath}`
  await $`chmod +x ${outputPath}`

  console.log(`✓ Build complete: ${outputPath}`)

  // Show binary size
  const file = Bun.file(outputPath)
  const size = (await file.arrayBuffer()).byteLength
  console.log(`✓ Binary size: ${(size / 1024 / 1024).toFixed(2)} MB`)
} catch (error) {
  console.error('Build error:', error)
  process.exit(1)
}
