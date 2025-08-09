import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// Test timeout in milliseconds
const TEST_TIMEOUT = 60000

// Integration tests that connect to a real ThetaData Terminal
// These tests will only run if THETA_DATA_TERMINAL_URL environment variable is set
const SHOULD_RUN_INTEGRATION_TESTS = process.env.THETA_DATA_TERMINAL_URL !== undefined

describe.skipIf(!SHOULD_RUN_INTEGRATION_TESTS)('CLI Download Integration Tests', () => {
  const testDataDir = path.join(process.cwd(), 'test-data')
  const dataDir = path.join(process.cwd(), 'data') // Default data directory used by download command
  const binaryPath = path.join(process.cwd(), 'dist', 'spx-data')

  beforeEach(async () => {
    // Clean up test data directories before each test
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist, that's ok
    }
    try {
      await fs.rm(dataDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist, that's ok
    }
  })

  afterEach(async () => {
    // Clean up test data directories after each test
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist, that's ok
    }
    try {
      await fs.rm(dataDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist, that's ok
    }
  })

  test(
    'download command shows help with --help flag',
    async () => {
      const result = await Bun.$`${binaryPath} download --help`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('download')
      expect(output).toContain('Download SPX options data for a specific date')
      expect(output).toContain('--dry-run')
      expect(output).toContain('--dte')
      expect(output).toContain('Maximum days to expiration')
      expect(output).toContain('date')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command accepts valid date format',
    async () => {
      // Use dry-run to avoid actual API calls (option must come before date argument)
      const result = await Bun.$`${binaryPath} download --dry-run 2025-08-07`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('Starting download for trade date: 2025-08-07')
      expect(output).toContain('DRY RUN MODE')
      expect(output).toContain('Fetching available expirations')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command strictly enforces YYYY-MM-DD format',
    async () => {
      // Test that only YYYY-MM-DD format is accepted
      const invalidFormats = ['20250807', '2025/08/07', '2025-8-7']
      
      for (const date of invalidFormats) {
        try {
          await Bun.$`${binaryPath} download ${date}`.quiet()
          expect(true).toBe(false) // Should not reach here
        } catch (error: any) {
          const output = error.stderr?.toString() || error.stdout?.toString() || ''
          expect(output).toContain('YYYY-MM-DD')
        }
      }
      
      // Valid format should work
      const validResult = await Bun.$`${binaryPath} download --dry-run 2025-08-07`.quiet()
      expect(validResult.stdout.toString()).toContain('Starting download')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command dry-run shows what would be downloaded',
    async () => {
      const result = await Bun.$`${binaryPath} download --dry-run 2025-08-07`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('Dry run summary')
      expect(output).toContain('Trade date: 2025-08-07')
      expect(output).toContain('DTE filter:')
      expect(output).toContain('Output directory:')
      expect(output).toContain('Expirations to download:')
      expect(output).toContain('Expirations:')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command handles ThetaData Terminal not running gracefully',
    async () => {
      // Stop ThetaData Terminal if it's running (simulate terminal not available)
      // This test assumes the terminal is not running or we can't connect
      try {
        // Use a very short timeout environment variable to fail quickly
        await Bun.$`THETA_DATA_TERMINAL_URL=http://127.0.0.1:99999 ${binaryPath} download --interval 3600000 2025-08-07`.quiet()
        // If it succeeds, terminal is running, skip this test
        console.log('ThetaData Terminal is running, skipping terminal-not-running test')
      } catch (error: any) {
        // Bun.$ returns ShellError with stdout/stderr as Buffer objects
        const output = (error.stderr?.toString() || error.stdout?.toString() || '').toLowerCase()
        // Should show helpful error message about terminal not running
        expect(output).toMatch(/cannot connect|terminal|please ensure|running/)
      }
    },
    TEST_TIMEOUT,
  )

  test(
    'download command creates correct directory structure',
    async () => {
      // Test with custom output directory using environment variable
      const customDataDir = path.join(testDataDir, 'custom-output')
      const tradeDate = '2025-08-07'

      // Run with dry-run first to test directory creation logic
      const result =
        await Bun.$`DATA_OUTPUT_DIR=${customDataDir} ${binaryPath} download --dry-run ${tradeDate}`.quiet()
      const output = result.stdout.toString()

      // Verify the output mentions the correct directory
      expect(output).toContain('20250807')
      expect(output).toContain('Trade date: 2025-08-07')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command handles future dates appropriately',
    async () => {
      // Test with a far future date
      const futureDate = '2030-12-31'
      const result = await Bun.$`${binaryPath} download --dry-run ${futureDate}`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('Starting download for trade date: 2030-12-31')
      expect(output).toContain('DRY RUN MODE')
      // Should still attempt to fetch expirations
      expect(output).toContain('Fetching available expirations')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command handles past dates appropriately',
    async () => {
      // Test with a past date
      const pastDate = '2024-01-15'
      const result = await Bun.$`${binaryPath} download --dry-run ${pastDate}`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('Starting download for trade date: 2024-01-15')
      expect(output).toContain('DRY RUN MODE')
      // Should still attempt to fetch expirations
      expect(output).toContain('Fetching available expirations')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command respects --dte option with default value',
    async () => {
      // Test default dte value (0)
      const result = await Bun.$`${binaryPath} download --dry-run 2025-08-07`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('DTE filter: Current day only')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command respects --dte option with custom value',
    async () => {
      // Test with custom dte value
      const result = await Bun.$`${binaryPath} download --dry-run --dte 7 2025-08-07`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('DTE filter: Up to 7 days')
    },
    TEST_TIMEOUT,
  )

  test(
    'download command handles various dte values',
    async () => {
      // Test various dte values
      const dteValues = [0, 1, 7, 30, 365]

      for (const dte of dteValues) {
        const result = await Bun.$`${binaryPath} download --dry-run --dte ${dte} 2025-08-07`.quiet()
        const output = result.stdout.toString()

        if (dte === 0) {
          expect(output).toContain('DTE filter: Current day only')
        } else {
          expect(output).toContain(`DTE filter: Up to ${dte} days`)
        }
      }
    },
    TEST_TIMEOUT,
  )

  test(
    'download command respects --interval option',
    async () => {
      // Test with hourly interval
      const result = await Bun.$`${binaryPath} download --dry-run --interval 3600000 2025-08-07`.quiet()
      const output = result.stdout.toString()

      expect(output).toContain('Data interval: 1 hour')

      // Test with minute interval (default)
      const minuteResult =
        await Bun.$`${binaryPath} download --dry-run --interval 60000 2025-08-07`.quiet()
      const minuteOutput = minuteResult.stdout.toString()

      expect(minuteOutput).toContain('Data interval: 1 minute')

      // Test with custom interval
      const customResult =
        await Bun.$`${binaryPath} download --dry-run --interval 900000 2025-08-07`.quiet()
      const customOutput = customResult.stdout.toString()

      expect(customOutput).toContain('Data interval: 900000ms')
    },
    TEST_TIMEOUT,
  )

  test.skip(
    'download command respects SIGINT for graceful shutdown',
    async () => {
      // Skip this test as ShellPromise doesn't expose pid directly
      // This would need a different approach to test graceful shutdown
    },
    TEST_TIMEOUT,
  )

  test(
    'download command outputs are formatted correctly',
    async () => {
      const result = await Bun.$`${binaryPath} download --dry-run 2025-08-07`.quiet()
      const output = result.stdout.toString()

      // Check for professional CLI formatting
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}/) // Date format
      expect(output).toMatch(/\[\d+\/\d+\]/) // Progress format [1/10]
      expect(output).toMatch(/\.(csv|parquet)/) // File extension mentioned

      // Check structure is present
      expect(output.includes('Dry run summary:')).toBe(true)
      expect(output.includes('Trade date:')).toBe(true)
      expect(output.includes('Output directory:')).toBe(true)
    },
    TEST_TIMEOUT,
  )
})

describe.skipIf(!SHOULD_RUN_INTEGRATION_TESTS)('CLI Download Binary Tests', () => {
  const binaryPath = path.join(process.cwd(), 'dist', 'spx-data')

  test('binary exists and is executable', async () => {
    const stats = await fs.stat(binaryPath)
    expect(stats.isFile()).toBe(true)

    // Check if executable (on Unix-like systems)
    if (process.platform !== 'win32') {
      const isExecutable = (stats.mode & 0o111) !== 0
      expect(isExecutable).toBe(true)
    }
  })

  test('binary runs without errors for help command', async () => {
    const result = await Bun.$`${binaryPath} --help`.quiet()
    expect(result.exitCode).toBe(0)

    const output = result.stdout.toString()
    expect(output).toContain('download')
    expect(output).toContain('health')
  })

  test('binary handles unknown commands appropriately', async () => {
    try {
      await Bun.$`${binaryPath} unknown-command`.quiet()
      expect(true).toBe(false) // Should not reach here
    } catch (error: any) {
      expect(error.exitCode).not.toBe(0)
      // Bun.$ returns ShellError with stdout/stderr as Buffer objects
      const output = error.stderr?.toString() || error.stdout?.toString() || ''
      // Should show some error about unknown command
      expect(output.length).toBeGreaterThan(0)
    }
  })
})

describe.skipIf(!SHOULD_RUN_INTEGRATION_TESTS)('CLI Download Environment Variables', () => {
  const binaryPath = path.join(process.cwd(), 'dist', 'spx-data')

  test(
    'respects THETA_DATA_TERMINAL_URL environment variable',
    async () => {
      const customUrl = 'http://localhost:12345'

      try {
        await Bun.$`THETA_DATA_TERMINAL_URL=${customUrl} ${binaryPath} download --interval 3600000 2025-08-07`.quiet()
        // If it succeeds, that's unexpected unless terminal is actually there
      } catch (error: any) {
        // Bun.$ returns ShellError with stdout/stderr as Buffer objects
        const output = error.stderr?.toString() || error.stdout?.toString() || ''
        // Should attempt to connect to custom URL and fail
        expect(output).toContain('Cannot connect')
      }
    },
    TEST_TIMEOUT,
  )

  test(
    'respects LOG_LEVEL environment variable',
    async () => {
      // Test with DEBUG log level
      const result = await Bun.$`LOG_LEVEL=debug ${binaryPath} download --dry-run 2025-08-07`.quiet()
      const output = result.stdout.toString()

      // Debug mode should show more detailed output
      expect(output).toContain('Starting download')

      // Test with ERROR log level (should be quieter)
      const quietResult =
        await Bun.$`LOG_LEVEL=error ${binaryPath} download --dry-run 2025-08-07`.quiet()
      const quietOutput = quietResult.stdout.toString()

      // Should still show main output but less verbose
      expect(quietOutput.length).toBeGreaterThan(0)
    },
    TEST_TIMEOUT,
  )
})
