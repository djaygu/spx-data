# SPX Data Pipeline

A high-performance SPX options data pipeline built with Effect-TS and Bun runtime for downloading and processing options Greeks data from ThetaData Terminal.

## Prerequisites

- [Bun](https://bun.sh/) runtime installed (v1.0.0 or higher)
- Java 17 or higher (required for ThetaData Terminal)
- [ThetaData Terminal](https://terminal.thetadata.us/) installed and running
- Active ThetaData subscription with access to options data

## ThetaData Terminal Setup

### Installing Java

ThetaData Terminal requires Java 17 or higher. Check your Java version:

```bash
java -version
```

If Java is not installed or the version is below 17:

**macOS:**
```bash
# Using Homebrew
brew install openjdk@17

# Or download from Oracle
# https://www.oracle.com/java/technologies/downloads/
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

**Windows:**
Download and install from [Oracle Java Downloads](https://www.oracle.com/java/technologies/downloads/)

### Installing ThetaData Terminal

1. **Download the Terminal:**
   - Visit [ThetaData Downloads](https://download-stable.thetadata.us/)
   - Download the latest `ThetaTerminal.jar` file
   - Save it to a dedicated directory (e.g., `~/thetadata/`)

2. **Start the Terminal:**
   ```bash
   # Navigate to the Terminal directory
   cd ~/thetadata/
   
   # Start with your credentials
   java -jar ThetaTerminal.jar username password
   
   # Or start with more memory for large datasets
   java -Xmx2G -jar ThetaTerminal.jar username password
   ```

3. **Verify Terminal is Running:**
   - The Terminal runs a REST API on port 25510 by default
   - Test the connection:
   ```bash
   curl http://127.0.0.1:25510/v2/system/status
   ```

### Terminal Configuration

**System Requirements:**
- Minimum 2GB RAM (4GB recommended for heavy usage)
- 10GB+ disk space for data caching
- Stable internet connection (Terminal reduces bandwidth by 30x)

**Important Settings:**
- **Port:** Default is 25510 for REST API
- **WebSocket:** Also available on port 25510 for streaming
- **Data Cache:** Terminal caches data locally for faster access
- **Auto-update:** Terminal checks for updates on startup

**Firewall/Proxy Considerations:**
- Ensure port 25510 is accessible locally
- If behind a corporate firewall, whitelist `api.thetadata.us`
- For proxy settings, use Java system properties:
  ```bash
  java -Dhttp.proxyHost=proxy.example.com -Dhttp.proxyPort=8080 -jar ThetaTerminal.jar
  ```

### Terminal Updates

The Terminal automatically checks for updates on startup. To manually update:

1. Stop the running Terminal (Ctrl+C)
2. Download the latest version from [downloads page](https://download-stable.thetadata.us/)
3. Replace the old JAR file
4. Restart with your credentials

### Architecture Benefits

ThetaData Terminal uses a local server architecture that provides:
- **30x bandwidth reduction** compared to direct API access
- **Local data caching** for frequently accessed data
- **Automatic retry logic** for network issues
- **Connection pooling** for optimal performance

## Installation

```bash
# Install dependencies
bun install

# Build the CLI binary
bun run build

# Optional: Build standalone binary (no Bun runtime required)
bun build ./src/cli.ts --compile --outfile dist/spx-data-standalone
```

## Usage

### Basic Download Command

Download SPX options data for a specific trade date:

```bash
# Download data for a specific date
./dist/spx-data download 2025-08-07

# Preview what would be downloaded (dry run)
./dist/spx-data download --dry-run 2025-08-07
```

### Command Options

#### `download` Command

Downloads SPX options Greeks data for a specified trade date.

**Arguments:**
- `date` (required) - Trade date in YYYY-MM-DD format

**Options:**
- `--dry-run, -d` - Preview what would be downloaded without fetching data
- `--dte <days>` - Maximum days to expiration (default: 0, current day only)
- `--interval <ms>` - Data interval in milliseconds (default: 60000)
  - `60000` - 1 minute intervals
  - `3600000` - 1 hour intervals

**Examples:**

```bash
# Download with 7 days to expiration filter
./dist/spx-data download --dte 7 2025-08-07

# Download hourly data instead of minute data
./dist/spx-data download --interval 3600000 2025-08-07

# Combine options
./dist/spx-data download --dte 30 --interval 3600000 2025-08-07

# Preview without downloading
./dist/spx-data download --dry-run --dte 7 2025-08-07
```

### Health Check

Verify connection to ThetaData Terminal:

```bash
./dist/spx-data health
```

### Help

Display available commands and options:

```bash
# General help
./dist/spx-data --help

# Command-specific help
./dist/spx-data download --help
```

## Output Structure

Downloaded data is organized in the following directory structure:

```
data/
└── YYYYMMDD/                    # Trade date directory
    ├── spxw_exp_YYYYMMDD.csv   # One file per expiration date
    ├── spxw_exp_YYYYMMDD.csv
    └── metrics.json             # Download metrics and statistics
```

### CSV File Format

Each CSV file contains the following columns:
- `strike` - Strike price
- `right` - Option type (C for Call, P for Put)
- `bid` - Bid price
- `ask` - Ask price
- `delta` - Delta Greek
- `theta` - Theta Greek
- `vega` - Vega Greek
- `rho` - Rho Greek
- `epsilon` - Epsilon Greek
- `lambda` - Lambda Greek
- `implied_volatility` - Implied volatility
- `iv_error` - IV calculation error
- `underlying_price` - Underlying SPX price
- `timestamp` - Data timestamp in ISO format

## Environment Variables

The following environment variables can be used to configure the application:

- `THETA_DATA_TERMINAL_URL` - ThetaData Terminal URL (default: `http://127.0.0.1:25510`)
  - Maps to internal `CONFIG_THETADATA_BASE_URL`
- `LOG_LEVEL` - Logging level: `debug`, `info`, `warn`, `error` (default: `info`)
- `DATA_OUTPUT_DIR` - Custom output directory (default: `./data`)
- `CONFIG_CONCURRENCY` - Number of concurrent API requests (default: 5)
- `CONFIG_GREEKS_BATCH_SIZE` - Batch size for Greeks calculations (default: 100)
- `CONFIG_CSV_BATCH_SIZE` - Batch size for CSV writing (default: 1000)

Example:
```bash
THETA_DATA_TERMINAL_URL=http://localhost:25510 ./dist/spx-data download 2025-08-07

# With custom settings
CONFIG_CONCURRENCY=10 CONFIG_GREEKS_BATCH_SIZE=500 ./dist/spx-data download 2025-08-07
```

## Troubleshooting

For detailed troubleshooting, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

### Common Issues

#### Cannot Connect to ThetaData Terminal

**Error:** `✗ Cannot connect to ThetaData Terminal`

**Quick Solutions:**
1. Ensure ThetaData Terminal is running:
   ```bash
   java -jar ~/thetadata/ThetaTerminal.jar username password
   ```
2. Verify connection:
   ```bash
   curl http://127.0.0.1:25510/v2/system/status
   ```
3. Check Java version (must be 17+):
   ```bash
   java -version
   ```

#### Java Issues

**Error:** `java: command not found` or `Unsupported class file major version`

**Solutions:**
- Install Java 17+ (see Terminal Setup section above)
- Verify JAVA_HOME is set correctly:
  ```bash
  echo $JAVA_HOME
  export JAVA_HOME=/path/to/java17
  ```

#### Terminal Startup Problems

**Error:** `Exception in thread "main" java.lang.OutOfMemoryError`

**Solution:** Increase memory allocation:
```bash
java -Xmx4G -jar ThetaTerminal.jar username password
```

**Error:** `Address already in use`

**Solution:** Another process is using port 25510:
```bash
# Find the process
lsof -i :25510
# Or use a different port (requires app config change)
java -jar ThetaTerminal.jar username password --port 25511
```

#### Invalid Date Format

**Error:** `Invalid date format. Expected YYYY-MM-DD`

**Solution:**
- Use the correct date format with leading zeros: `2025-08-07` (not `2025-8-7`)
- Use hyphens as separators (not slashes or other characters)

#### Permission Denied

**Error:** `Failed to create output directory`

**Solution:**
- Ensure you have write permissions in the current directory
- Try running from a directory where you have write access
- Use `DATA_OUTPUT_DIR` to specify a writable directory

#### No Data Returned

**Issue:** Command runs but no files are created

**Possible Causes:**
1. No options data available for the specified trade date
2. Market was closed on the specified date (weekends, holidays)
3. Data subscription doesn't include the requested date range
4. Terminal cache might be stale - restart Terminal

## Development

### Running Tests

```bash
# Run unit tests only
bun test

# Run all tests including integration tests
bun test:all

# Run with ThetaData Terminal integration
THETA_DATA_TERMINAL_URL=http://127.0.0.1:25510 bun test:integration

# Watch mode for development
bun test:watch
```

### Code Quality

```bash
# Run linter
bun run lint

# Auto-fix linting issues
bun run lint:fix
```

### Project Structure

```
spx-data/
├── src/
│   ├── cli/
│   │   ├── commands/       # CLI command implementations
│   │   └── main.ts         # CLI entry point
│   ├── services/           # Core business logic
│   ├── layers/            # Effect-TS layer implementations
│   └── config/            # Configuration
├── test/
│   ├── integration/       # Integration tests
│   └── services/         # Unit tests
├── dist/                 # Built binaries
└── data/                # Downloaded data (git-ignored)
```

## Performance

The pipeline is optimized for handling large datasets:

- **Streaming Architecture**: Processes data in chunks to minimize memory usage
- **Parallel Processing**: Handles multiple expirations concurrently
- **Progress Tracking**: Real-time feedback with throughput metrics
- **Efficient I/O**: Uses Bun's native file APIs for optimal performance
- **Atomic Writes**: Temporary files ensure data integrity

Typical performance metrics:
- Throughput: 10,000-50,000 records/second
- Memory usage: < 200MB for any dataset size
- Disk I/O: Optimized with buffered writes

## License

ISC

## Support

For issues related to:
- **This application**: Open an issue on GitHub
- **ThetaData Terminal**: Contact ThetaData support
- **Market data**: Verify your ThetaData subscription includes SPX options