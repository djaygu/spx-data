# Epic 4 Production Operations & Monitoring

**Goal**: Transform the tool into a production-ready system with simplified configuration management, operational commands, and deployment packaging suitable for personal use. This epic ensures the tool can be reliably operated with proper maintenance capabilities.

## Story 4.1 Effect Config Implementation

As a user,
I want configuration management using Effect Config,
so that I have type-safe, validated configuration.

**Acceptance Criteria:**
1. Implement configuration using Effect Config module
2. Support environment variables with CONFIG_ prefix
3. Add `config show` command to display current settings
4. Include configuration validation on startup with clear error messages
5. Document all configuration options with examples
6. Type-safe configuration with compile-time checking
7. Provide sensible defaults for all settings

## Story 4.2 Status and Health Commands

As a user,
I want operational commands to check system status,
so that I can monitor and troubleshoot the pipeline.

**Acceptance Criteria:**
1. Implement `status` command showing data inventory summary
2. Add `health` command checking ThetaTerminal connection
3. Display storage usage and file count statistics
4. Show last successful download timestamp per dataset
5. Include data quality metrics (validation pass rates)
6. Check for common issues (disk space, permissions)
7. Return appropriate exit codes for scripting

## Story 4.3 Data Validation Command

As a user,
I want to validate my downloaded data files,
so that I can ensure data integrity and identify issues.

**Acceptance Criteria:**
1. Implement `validate` command for Parquet file verification
2. Check file structure, schema, and metadata integrity
3. Validate data ranges and consistency rules
4. Support validating single files or date ranges
5. Generate detailed validation report
6. Add --repair flag for fixable issues
7. Include performance metrics (files/second)

## Story 4.4 Basic Logging and Metrics

As a user,
I want simple logging and performance metrics,
so that I can track pipeline operations and debug issues.

**Acceptance Criteria:**
1. Implement file-based logging with configurable verbosity
2. Log key operations (downloads, validations, errors)
3. Track basic metrics (records/day, download speeds, error rates)
4. Write metrics to simple CSV file for analysis
5. Include log rotation to prevent disk filling
6. Add --verbose flag for detailed logging
7. Create log parser script for common queries

## Story 4.5 Deployment Packaging

As a user,
I want a single deployable artifact using Bun,
so that I can easily install and run the tool anywhere.

**Acceptance Criteria:**
1. Configure Bun build to produce single executable binary
2. Bundle all dependencies including Effect runtime
3. Optimize binary size while maintaining functionality
4. Add version command with build information
5. Create installation script for Bun runtime
6. Test deployment on fresh macOS system
7. Document Bun runtime requirements and prerequisites

## Story 4.6 User Documentation

As a user,
I want clear documentation and examples,
so that I can effectively use the tool.

**Acceptance Criteria:**
1. Create comprehensive README with quick start guide
2. Document all commands with examples
3. Include troubleshooting section for common issues
4. Add example scripts for common workflows
5. Provide sample cron configurations
6. Create command reference card
7. Include FAQ section based on common questions
