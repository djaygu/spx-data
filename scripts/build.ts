#!/usr/bin/env bun

import { $ } from 'bun'

const entrypoint = './src/cli.ts'
const outdir = './dist'
const outfile = 'spx-data'

// Check for --compile flag
const shouldCompile = process.argv.includes('--compile')

if (shouldCompile) {
  console.log('Building standalone binary (no Bun runtime required)...')
} else {
  console.log('Building spx-data binary (requires Bun runtime)...')
}

try {
  // Clean dist directory
  await $`rm -rf ${outdir}`
  await $`mkdir -p ${outdir}`

  if (shouldCompile) {
    // Build standalone binary with embedded Bun runtime
    const standaloneOutfile = `${outdir}/${outfile}-standalone`
    await $`bun build ${entrypoint} --compile --outfile ${standaloneOutfile}`
    
    console.log(`✓ Standalone build complete: ${standaloneOutfile}`)
    
    // Show binary size
    const file = Bun.file(standaloneOutfile)
    const size = (await file.arrayBuffer()).byteLength
    console.log(`✓ Standalone binary size: ${(size / 1024 / 1024).toFixed(2)} MB`)
    
    // Also create checksum for verification
    const result = await $`shasum -a 256 ${standaloneOutfile}`.text()
    const checksum = result.split(' ')[0]
    await Bun.write(`${standaloneOutfile}.sha256`, `${checksum}  ${outfile}-standalone\n`)
    console.log(`✓ SHA256 checksum: ${checksum}`)
  } else {
    // Build the JavaScript bundle (requires Bun runtime)
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
    await $`mv ${outdir}/cli.js ${outputPath}`
    await $`chmod +x ${outputPath}`

    console.log(`✓ Build complete: ${outputPath}`)

    // Show binary size
    const file = Bun.file(outputPath)
    const size = (await file.arrayBuffer()).byteLength
    console.log(`✓ Binary size: ${(size / 1024 / 1024).toFixed(2)} MB`)
  }
} catch (error) {
  console.error('Build error:', error)
  process.exit(1)
}
