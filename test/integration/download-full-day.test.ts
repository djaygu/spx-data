import { describe, expect, it, beforeAll, afterAll, afterEach } from "bun:test"
import { Effect } from "effect"
import { main } from "@/cli/main"
import * as path from "node:path"

// Integration tests that download real data from ThetaData Terminal
const SHOULD_RUN_E2E_TESTS = process.env.THETA_DATA_TERMINAL_URL !== undefined

// Set environment variables for the test
if (SHOULD_RUN_E2E_TESTS) {
  process.env.CONFIG_THETADATA_BASE_URL =
    process.env.THETA_DATA_TERMINAL_URL || "http://127.0.0.1:25510"
}

describe.skipIf(!SHOULD_RUN_E2E_TESTS)("End-to-End Download Test", () => {
  let tempDir: string

  beforeAll(async () => {
    // Create a temporary directory for test output using Bun
    const tempBase = `/tmp/spx-data-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await Bun.$`mkdir -p ${tempBase}`.quiet()
    tempDir = tempBase
  })

  afterEach(async () => {
    // Clean up test data after each test
    if (tempDir) {
      try {
        // Remove all subdirectories but keep the temp dir for next test
        await Bun.$`find ${tempDir} -mindepth 1 -type d -exec rm -rf {} + 2>/dev/null || true`.quiet()
        await Bun.$`find ${tempDir} -mindepth 1 -type f -exec rm -f {} + 2>/dev/null || true`.quiet()
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  afterAll(async () => {
    // Clean up temporary directory using Bun
    if (tempDir) {
      try {
        await Bun.$`rm -rf ${tempDir}`.quiet()
      } catch {
        // Directory might already be deleted
      }
    }
  })

  it(
    "downloads real SPX data for a known good date",
    async () => {
      // Use a recent weekday as test date
      const testDate = "2025-08-06" // A Wednesday in August 2025
      const outputDir = path.join(tempDir, "20250806")

      // Set environment variables for configuration
      process.env.CONFIG_STORAGE_DATA_DIRECTORY = tempDir
      process.env.CONFIG_DOWNLOAD_CONCURRENCY = "2"
      process.env.CONFIG_DOWNLOAD_GREEKS_BATCH_SIZE = "100"
      process.env.CONFIG_DOWNLOAD_CSV_BATCH_SIZE = "1000"

      // Execute the download command
      await Effect.runPromise(
        main(["bun", "spx-data", "download", testDate]).pipe(
          Effect.scoped
        )
      )

      // Verify output directory exists using ls
      let dirExists = false
      try {
        await Bun.$`ls -d ${outputDir}`.quiet()
        dirExists = true
      } catch {
        dirExists = false
      }
      expect(dirExists).toBe(true)

      // Find CSV files in the output directory using Bun
      const files: string[] = []
      for await (const entry of Bun.$`ls ${outputDir}/*.csv 2>/dev/null || true`.lines()) {
        if (entry) {
          files.push(path.basename(entry))
        }
      }
      expect(files.length).toBeGreaterThan(0)

      // Read and verify the first CSV file
      const firstFile = path.join(outputDir, files[0])
      const fileContent = await Bun.file(firstFile).text()
      const lines = fileContent.split("\n").filter((line) => line.trim())

      // Verify CSV header
      expect(lines[0]).toContain("strike")
      expect(lines[0]).toContain("right")
      expect(lines[0]).toContain("bid")
      expect(lines[0]).toContain("ask")

      // Verify we have data rows
      expect(lines.length).toBeGreaterThan(1)

      // Parse a sample row to verify data format
      const headers = lines[0].split(",")
      const sampleRow = lines[1].split(",")
      const rowData: Record<string, string> = {}
      headers.forEach((header, i) => {
        rowData[header] = sampleRow[i]
      })

      // Verify data integrity
      expect(parseFloat(rowData.strike)).toBeGreaterThan(0)
      expect(["C", "P"]).toContain(rowData.right)

      // Verify greeks are present and numeric
      if (rowData.delta) expect(isNaN(parseFloat(rowData.delta))).toBe(false)
      if (rowData.gamma) expect(isNaN(parseFloat(rowData.gamma))).toBe(false)
      if (rowData.vega) expect(isNaN(parseFloat(rowData.vega))).toBe(false)
      if (rowData.theta) expect(isNaN(parseFloat(rowData.theta))).toBe(false)

      // Log summary for debugging
      console.log(`Downloaded ${files.length} expiration files for ${testDate}`)
      console.log(`First file has ${lines.length - 1} option records`)
      const fileSize = Bun.file(firstFile).size
      console.log(`Output file size: ${fileSize} bytes`)

      // Clean up env vars
      delete process.env.CONFIG_STORAGE_DATA_DIRECTORY
      delete process.env.CONFIG_DOWNLOAD_CONCURRENCY
      delete process.env.CONFIG_DOWNLOAD_GREEKS_BATCH_SIZE
      delete process.env.CONFIG_DOWNLOAD_CSV_BATCH_SIZE
    },
    { timeout: 120000 } // 2 minute timeout
  )

  it(
    "handles dry run mode correctly",
    async () => {
      const testDate = "2025-08-06"
      const outputDir = path.join(tempDir, "20250806-dry")

      // Set environment variables for configuration
      process.env.CONFIG_STORAGE_DATA_DIRECTORY = tempDir

      // Execute the download command with dry-run flag
      await Effect.runPromise(
        main(["bun", "spx-data", "download", "--dry-run", testDate]).pipe(
          Effect.scoped
        )
      )

      // Verify no files were created in dry-run mode
      let dirExists = false
      try {
        await Bun.$`ls -d ${outputDir}`.quiet()
        dirExists = true
      } catch {
        dirExists = false
      }
      expect(dirExists).toBe(false)

      // Clean up env vars
      delete process.env.CONFIG_STORAGE_DATA_DIRECTORY
    },
    { timeout: 30000 }
  )

  it(
    "handles DTE filter correctly",
    async () => {
      const testDate = "2025-08-06"
      const subdirName = "dte-test"
      const outputDir = path.join(tempDir, subdirName, "20250806")

      // Set environment variables for configuration
      process.env.CONFIG_STORAGE_DATA_DIRECTORY = path.join(tempDir, subdirName)
      process.env.CONFIG_DOWNLOAD_CONCURRENCY = "2"

      // Execute the download command with DTE filter
      await Effect.runPromise(
        main(["bun", "spx-data", "download", "--dte", "7", testDate]).pipe(
          Effect.scoped
        )
      )

      // Verify output directory exists using ls
      let dirExists = false
      try {
        await Bun.$`ls -d ${outputDir}`.quiet()
        dirExists = true
      } catch {
        dirExists = false
      }
      expect(dirExists).toBe(true)

      // Find CSV files in the output directory using Bun
      const files: string[] = []
      for await (const entry of Bun.$`ls ${outputDir}/*.csv 2>/dev/null || true`.lines()) {
        if (entry) {
          files.push(path.basename(entry))
        }
      }
      
      // Extract expiration dates from filenames (format: spxw_exp_YYYYMMDD.csv)
      const expirationDates = files.map((f: string) => {
        const match = f.match(/spxw_exp_(\d{8})\.csv/)
        if (match) {
          const dateStr = match[1]
          return new Date(
            parseInt(dateStr.substring(0, 4)),
            parseInt(dateStr.substring(4, 6)) - 1,
            parseInt(dateStr.substring(6, 8))
          )
        }
        return null
      }).filter((d): d is Date => d !== null)

      // Calculate days to expiration for each file
      const tradeDate = new Date(2025, 7, 6) // August 6, 2025 (month is 0-indexed)
      const dteDays = expirationDates.map(expDate => {
        const diffTime = expDate.getTime() - tradeDate.getTime()
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      })

      // Verify all expirations are within 7 days
      dteDays.forEach(dte => {
        expect(dte).toBeLessThanOrEqual(7)
        expect(dte).toBeGreaterThanOrEqual(0)
      })

      console.log(`Found ${files.length} expirations within 7 DTE`)
      console.log(`DTE values: ${dteDays.join(", ")}`)

      // Clean up env vars
      delete process.env.CONFIG_STORAGE_DATA_DIRECTORY
      delete process.env.CONFIG_DOWNLOAD_CONCURRENCY
    },
    { timeout: 120000 }
  )

  it(
    "validates data completeness and accuracy",
    async () => {
      const testDate = "2025-08-06"
      const subdirName = "validate-test"
      const outputDir = path.join(tempDir, subdirName, "20250806")

      // Set environment variables for configuration
      process.env.CONFIG_STORAGE_DATA_DIRECTORY = path.join(tempDir, subdirName)
      process.env.CONFIG_DOWNLOAD_CONCURRENCY = "2"
      process.env.CONFIG_DOWNLOAD_GREEKS_BATCH_SIZE = "100"
      process.env.CONFIG_DOWNLOAD_CSV_BATCH_SIZE = "1000"

      // Execute the download command
      await Effect.runPromise(
        main(["bun", "spx-data", "download", testDate]).pipe(
          Effect.scoped
        )
      )

      // Verify output directory exists using ls
      let dirExists = false
      try {
        await Bun.$`ls -d ${outputDir}`.quiet()
        dirExists = true
      } catch {
        dirExists = false
      }
      expect(dirExists).toBe(true)

      // Find CSV files and validate each one using Bun
      const files: string[] = []
      for await (const entry of Bun.$`ls ${outputDir}/*.csv 2>/dev/null || true`.lines()) {
        if (entry) {
          files.push(path.basename(entry))
        }
      }
      expect(files.length).toBeGreaterThan(0)

      // Track statistics across all files
      let totalRecords = 0
      let callCount = 0
      let putCount = 0
      let uniqueStrikes = new Set<number>()
      let minStrike = Infinity
      let maxStrike = 0

      for (const file of files) {
        const filePath = path.join(outputDir, file)
        const fileContent = await Bun.file(filePath).text()
        const lines = fileContent.split("\n").filter((line) => line.trim())
        
        if (lines.length <= 1) continue // Skip empty files
        
        const headers = lines[0].split(",")
        const strikeIndex = headers.indexOf("strike")
        const rightIndex = headers.indexOf("right")

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",")
          if (row.length !== headers.length) continue // Skip malformed rows
          
          totalRecords++

          // Count option types
          if (row[rightIndex] === "C") callCount++
          if (row[rightIndex] === "P") putCount++

          // Track strikes
          const strike = parseFloat(row[strikeIndex])
          if (!isNaN(strike)) {
            uniqueStrikes.add(strike)
            minStrike = Math.min(minStrike, strike)
            maxStrike = Math.max(maxStrike, strike)
          }

          // Validate required fields are not empty
          expect(row[strikeIndex]).toBeTruthy()
          expect(row[rightIndex]).toBeTruthy()
        }
      }

      // Verify data distribution
      expect(totalRecords).toBeGreaterThan(0)
      expect(callCount).toBeGreaterThan(0)
      expect(putCount).toBeGreaterThan(0)
      expect(uniqueStrikes.size).toBeGreaterThan(10) // Should have many strikes
      expect(maxStrike).toBeGreaterThan(minStrike * 1.2) // Reasonable strike range

      console.log(`Data validation summary:`)
      console.log(`- Files processed: ${files.length}`)
      console.log(`- Total records: ${totalRecords}`)
      console.log(`- Calls: ${callCount}, Puts: ${putCount}`)
      console.log(`- Unique strikes: ${uniqueStrikes.size}`)
      console.log(`- Strike range: ${minStrike} - ${maxStrike}`)

      // Check for metrics.json file
      const metricsFile = Bun.file(path.join(outputDir, "metrics.json"))
      if (await metricsFile.exists()) {
        const metrics = await metricsFile.json()
        console.log(`- Metrics: ${JSON.stringify(metrics, null, 2)}`)
      }

      // Clean up env vars
      delete process.env.CONFIG_STORAGE_DATA_DIRECTORY
      delete process.env.CONFIG_DOWNLOAD_CONCURRENCY
      delete process.env.CONFIG_DOWNLOAD_GREEKS_BATCH_SIZE
      delete process.env.CONFIG_DOWNLOAD_CSV_BATCH_SIZE
    },
    { timeout: 120000 }
  )
})

// Provide instructions for running E2E tests
if (!SHOULD_RUN_E2E_TESTS) {
  describe("End-to-End Download Test", () => {
    it("should skip when THETA_DATA_TERMINAL_URL is not set", () => {
      console.log(
        "\n" +
          "=".repeat(60) +
          "\n" +
          "E2E tests skipped.\n" +
          "To run E2E tests:\n" +
          "1. Start ThetaData Terminal\n" +
          "2. Set environment variable: export THETA_DATA_TERMINAL_URL=http://127.0.0.1:25510\n" +
          "3. Run: bun test integration/download-full-day.test.ts\n" +
          "=".repeat(60) +
          "\n"
      )
      expect(true).toBe(true)
    })
  })
}