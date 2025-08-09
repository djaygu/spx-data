# Troubleshooting Guide

This guide covers common issues and their solutions when using the SPX Data Pipeline.

## Table of Contents

- [Terminal Connection Issues](#terminal-connection-issues)
- [Java and Terminal Startup Problems](#java-and-terminal-startup-problems)
- [Rate Limiting and API Errors](#rate-limiting-and-api-errors)
- [File System and Permission Issues](#file-system-and-permission-issues)
- [Memory and Performance Issues](#memory-and-performance-issues)
- [WebSocket and Timeout Issues](#websocket-and-timeout-issues)
- [Effect-TS Fiber Issues](#effect-ts-fiber-issues)
- [Frequently Asked Questions](#frequently-asked-questions)

## Terminal Connection Issues

### Cannot Connect to ThetaData Terminal

**Error Messages:**
- `✗ Cannot connect to ThetaData Terminal`
- `Connection refused (ECONNREFUSED)`
- `Network request failed`

**Solutions:**

1. **Verify Terminal is Running:**
   ```bash
   # Check if Terminal process is running
   ps aux | grep ThetaTerminal
   
   # If not running, start it:
   java -jar ~/thetadata/ThetaTerminal.jar username password
   ```

2. **Check Port Availability:**
   ```bash
   # Check if port 25510 is in use
   lsof -i :25510
   netstat -an | grep 25510
   
   # Test connection
   curl -v http://127.0.0.1:25510/v2/system/status
   ```

3. **Verify Environment Variable:**
   ```bash
   # Check current setting
   echo $THETA_DATA_TERMINAL_URL
   
   # Set if needed
   export THETA_DATA_TERMINAL_URL=http://127.0.0.1:25510
   ```

4. **Firewall Issues:**
   ```bash
   # macOS - check firewall settings
   sudo pfctl -s rules | grep 25510
   
   # Linux - check iptables
   sudo iptables -L -n | grep 25510
   
   # Windows - check Windows Defender Firewall
   netsh advfirewall firewall show rule name=all | findstr 25510
   ```

### Terminal Not Responding

**Symptoms:**
- Terminal is running but not responding to requests
- Slow response times
- Intermittent connection failures

**Solutions:**

1. **Restart Terminal:**
   ```bash
   # Stop Terminal (Ctrl+C or kill process)
   pkill -f ThetaTerminal
   
   # Clear cache and restart
   rm -rf ~/.thetadata/cache/*
   java -jar ThetaTerminal.jar username password
   ```

2. **Check Terminal Logs:**
   ```bash
   # Terminal logs are usually in the same directory
   tail -f ~/thetadata/terminal.log
   ```

3. **Verify Subscription Status:**
   - Ensure your ThetaData subscription is active
   - Check if you have permissions for SPX options data
   - Verify your API limits haven't been exceeded

## Java and Terminal Startup Problems

### Java Version Issues

**Error Messages:**
- `java: command not found`
- `Unsupported class file major version 61`
- `Error: A JNI error has occurred`

**Solutions:**

1. **Install Java 17+:**
   ```bash
   # Check current version
   java -version
   
   # macOS with Homebrew
   brew install openjdk@17
   brew link openjdk@17
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install openjdk-17-jdk
   
   # Set JAVA_HOME
   export JAVA_HOME=$(/usr/libexec/java_home -v 17)  # macOS
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk     # Linux
   ```

2. **Multiple Java Versions:**
   ```bash
   # List all Java versions (macOS)
   /usr/libexec/java_home -V
   
   # Switch to Java 17
   export JAVA_HOME=$(/usr/libexec/java_home -v 17)
   
   # Verify
   java -version
   ```

### Out of Memory Errors

**Error Messages:**
- `Exception in thread "main" java.lang.OutOfMemoryError: Java heap space`
- `GC overhead limit exceeded`

**Solutions:**

1. **Increase Heap Size:**
   ```bash
   # Start with 2GB initial, 4GB max heap
   java -Xms2G -Xmx4G -jar ThetaTerminal.jar username password
   
   # For very large datasets
   java -Xms4G -Xmx8G -XX:+UseG1GC -jar ThetaTerminal.jar username password
   ```

2. **Monitor Memory Usage:**
   ```bash
   # While Terminal is running
   jps -l  # Get Java process ID
   jstat -gcutil <PID> 1000  # Monitor GC every second
   ```

### Port Already in Use

**Error Message:**
- `Address already in use (Bind failed)`
- `Port 25510 is already in use`

**Solutions:**

1. **Find and Kill Process:**
   ```bash
   # Find process using port
   lsof -i :25510
   
   # Kill the process
   kill -9 <PID>
   
   # Or force kill all Java processes (careful!)
   pkill -9 java
   ```

2. **Use Different Port:**
   ```bash
   # Start Terminal on different port
   java -jar ThetaTerminal.jar username password --port 25511
   
   # Update app configuration
   export THETA_DATA_TERMINAL_URL=http://127.0.0.1:25511
   ```

## Rate Limiting and API Errors

### Rate Limit Exceeded

**Error Messages:**
- `429 Too Many Requests`
- `Rate limit exceeded`
- `Please slow down your requests`

**Solutions:**

1. **Adjust Concurrency:**
   ```bash
   # Reduce concurrent requests
   CONFIG_CONCURRENCY=2 ./dist/spx-data download 2025-08-07
   ```

2. **Add Request Delays:**
   ```bash
   # Use smaller batch sizes
   CONFIG_GREEKS_BATCH_SIZE=50 CONFIG_CSV_BATCH_SIZE=500 ./dist/spx-data download 2025-08-07
   ```

3. **Check Subscription Limits:**
   - Verify your ThetaData plan's rate limits
   - Consider upgrading if consistently hitting limits

### Invalid API Responses

**Error Messages:**
- `Invalid response format`
- `Unexpected end of JSON input`
- `Cannot parse response`

**Solutions:**

1. **Verify Data Availability:**
   ```bash
   # Test specific endpoint directly
   curl http://127.0.0.1:25510/v2/hist/option/quotes \
     -X GET \
     -H "Content-Type: application/json" \
     -d '{"root": "SPX", "exp": "2024-01-17", "start_date": "2024-01-15", "end_date": "2024-01-15"}'
   ```

2. **Check Terminal Version:**
   ```bash
   # Terminal auto-updates, but force check
   java -jar ThetaTerminal.jar --version
   ```

## File System and Permission Issues

### Cannot Write Output Files

**Error Messages:**
- `EACCES: permission denied`
- `ENOENT: no such file or directory`
- `Failed to create output directory`

**Solutions:**

1. **Check Permissions:**
   ```bash
   # Check current directory permissions
   ls -la ./data
   
   # Fix permissions
   chmod 755 ./data
   
   # Or use different directory
   DATA_OUTPUT_DIR=/tmp/spx-data ./dist/spx-data download 2025-08-07
   ```

2. **Disk Space Issues:**
   ```bash
   # Check available space
   df -h .
   
   # Clean up old data
   rm -rf ./data/old/*
   
   # Use different partition
   DATA_OUTPUT_DIR=/mnt/largevolume/spx-data ./dist/spx-data download 2025-08-07
   ```

### File Locking Issues

**Error Messages:**
- `Resource temporarily unavailable`
- `File is locked by another process`

**Solutions:**

1. **Find Locking Process:**
   ```bash
   # Find processes accessing the file
   lsof ./data/output.csv
   fuser ./data/output.csv
   ```

2. **Use Atomic Writes:**
   - The app uses temp files + rename pattern
   - Ensure temp directory is on same filesystem

## Memory and Performance Issues

### High Memory Usage

**Symptoms:**
- Application slows down over time
- System becomes unresponsive
- Out of memory errors

**Solutions:**

1. **Adjust Batch Sizes:**
   ```bash
   # Smaller batches = less memory
   CONFIG_GREEKS_BATCH_SIZE=50 \
   CONFIG_CSV_BATCH_SIZE=500 \
   ./dist/spx-data download 2025-08-07
   ```

2. **Monitor Memory:**
   ```bash
   # Watch memory usage
   watch -n 1 'ps aux | grep spx-data'
   
   # Use system monitor
   htop  # or top
   ```

3. **Process in Chunks:**
   ```bash
   # Download multiple smaller date ranges instead of one large range
   for date in 2024-01-15 2024-01-16 2024-01-17; do
     ./dist/spx-data download $date
     sleep 5  # Give system time to recover
   done
   ```

### Slow Performance

**Symptoms:**
- Downloads take excessive time
- Progress seems stuck
- Low throughput rates

**Solutions:**

1. **Optimize Concurrency:**
   ```bash
   # Increase if network/CPU allows
   CONFIG_CONCURRENCY=10 ./dist/spx-data download 2025-08-07
   
   # But watch for rate limits!
   ```

2. **Check Network:**
   ```bash
   # Test network speed to Terminal
   time curl http://127.0.0.1:25510/v2/system/status
   
   # Check network latency
   ping 127.0.0.1
   ```

3. **Profile Performance:**
   ```bash
   # Run with debug logging
   LOG_LEVEL=debug ./dist/spx-data download 2025-08-07 2>&1 | tee debug.log
   
   # Look for bottlenecks
   grep "Processing time" debug.log
   ```

## WebSocket and Timeout Issues

### WebSocket Connection Drops

**Error Messages:**
- `WebSocket connection closed unexpectedly`
- `Connection timeout`

**Solutions:**

1. **Use REST Instead:**
   - The app primarily uses REST API
   - WebSocket is optional for streaming

2. **Increase Timeouts:**
   ```bash
   # Set longer timeout for slow connections
   CONFIG_REQUEST_TIMEOUT=60000 ./dist/spx-data download 2025-08-07
   ```

### Request Timeouts

**Error Messages:**
- `Request timeout after 30000ms`
- `Operation timed out`

**Solutions:**

1. **Adjust Timeout Settings:**
   ```bash
   # Increase timeout for large requests
   CONFIG_REQUEST_TIMEOUT=120000 ./dist/spx-data download 2025-08-07
   ```

2. **Reduce Request Size:**
   ```bash
   # Smaller batches timeout less
   CONFIG_GREEKS_BATCH_SIZE=25 ./dist/spx-data download 2025-08-07
   ```

## Effect-TS Fiber Issues

### Fiber Deadlocks

**Symptoms:**
- Application hangs without error
- Progress stops but process still running

**Solutions:**

1. **Enable Debug Logging:**
   ```bash
   LOG_LEVEL=debug ./dist/spx-data download 2025-08-07
   ```

2. **Kill and Retry:**
   ```bash
   # Send interrupt signal
   kill -INT <PID>
   
   # If that doesn't work
   kill -TERM <PID>
   
   # Last resort
   kill -9 <PID>
   ```

### Uncaught Effect Errors

**Error Messages:**
- `Uncaught in fiber`
- `Effect failed with`

**Solutions:**

1. **Check Logs:**
   ```bash
   # Effect errors are usually logged
   tail -f ./logs/error.log
   ```

2. **Run with Tracing:**
   ```bash
   # Enable Effect tracing
   EFFECT_TRACE=1 ./dist/spx-data download 2025-08-07
   ```

## Frequently Asked Questions

### Q: Why is my download so slow?

**A:** Common causes:
1. Network latency to Terminal
2. Rate limiting from ThetaData
3. Large date ranges with many expirations
4. Insufficient concurrency settings

Try:
```bash
CONFIG_CONCURRENCY=8 CONFIG_GREEKS_BATCH_SIZE=200 ./dist/spx-data download 2025-08-07
```

### Q: Can I download historical data from months ago?

**A:** Yes, if your subscription includes historical data:
```bash
./dist/spx-data download 2023-01-15
```

Check your subscription at [ThetaData Account](https://terminal.thetadata.us/account)

### Q: How do I know if Terminal is receiving my requests?

**A:** Check Terminal logs:
```bash
# Terminal usually logs to console
# Or check log file
tail -f ~/thetadata/terminal.log

# Test with curl
curl -v http://127.0.0.1:25510/v2/system/status
```

### Q: What's the difference between REST and WebSocket endpoints?

**A:**
- **REST (port 25510):** Request/response, used for historical data
- **WebSocket (port 25510):** Streaming, used for real-time data
- This app primarily uses REST for reliability

### Q: How much disk space do I need?

**A:**
- Terminal cache: 5-10GB minimum
- Output data: ~100MB per trade date (varies by market activity)
- Temp files: 2x size of largest download

### Q: Can I run multiple downloads in parallel?

**A:** Yes, but be careful:
```bash
# Safe parallel downloads (different dates)
./dist/spx-data download 2024-01-15 &
./dist/spx-data download 2024-01-16 &
wait

# Avoid downloading same date twice!
```

### Q: How do I update the Terminal?

**A:**
1. Terminal auto-updates on startup
2. For manual update:
   ```bash
   # Download latest
   wget https://download-stable.thetadata.us/ThetaTerminal.jar
   
   # Backup old version
   mv ~/thetadata/ThetaTerminal.jar ~/thetadata/ThetaTerminal.jar.backup
   
   # Replace with new
   mv ThetaTerminal.jar ~/thetadata/
   
   # Restart
   java -jar ~/thetadata/ThetaTerminal.jar username password
   ```

### Q: What if I get "Invalid credentials"?

**A:**
1. Verify username/password are correct
2. Check subscription is active
3. Try logging into web portal: https://terminal.thetadata.us
4. Reset password if needed

### Q: How do I run this in Docker?

**A:** Create a Dockerfile:
```dockerfile
FROM oven/bun:1.0
WORKDIR /app
COPY . .
RUN bun install && bun run build
CMD ["./dist/spx-data"]
```

Run Terminal on host, app in Docker:
```bash
docker run --network host -v ./data:/app/data myapp download 2025-08-07
```

## Getting Help

If you've tried these solutions and still have issues:

1. **Check Logs:**
   - Application logs: `LOG_LEVEL=debug`
   - Terminal logs: Usually in Terminal directory
   - System logs: `dmesg`, `syslog`, Event Viewer

2. **Gather Information:**
   - OS and version
   - Java version
   - Terminal version
   - Error messages
   - Steps to reproduce

3. **Get Support:**
   - Application issues: Open GitHub issue
   - ThetaData issues: Contact support@thetadata.us
   - Effect-TS issues: Check Effect Discord

## Debug Commands Reference

```bash
# System checks
java -version
bun --version
df -h
free -m  # Linux
vm_stat  # macOS

# Network checks
curl http://127.0.0.1:25510/v2/system/status
netstat -an | grep 25510
lsof -i :25510

# Process checks
ps aux | grep -E "ThetaTerminal|spx-data"
top -p <PID>  # Linux
top -pid <PID>  # macOS

# Terminal test
curl http://127.0.0.1:25510/v2/hist/option/quotes \
  -H "Content-Type: application/json" \
  -d '{"root": "SPX", "exp": "2024-01-17", "start_date": "2024-01-15"}'

# Application test
LOG_LEVEL=debug ./dist/spx-data health
```