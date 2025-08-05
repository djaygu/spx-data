# Security

## Input Validation
- **Validation Library:** @effect/schema for all input validation
- **Validation Location:** At CLI boundary before processing
- **Required Rules:**
  - All external inputs MUST be validated
  - Validation at API boundary before processing
  - Whitelist approach preferred over blacklist

## Authentication & Authorization
- **Auth Method:** Local-only tool, no authentication required
- **Session Management:** Not applicable - stateless CLI
- **Required Patterns:**
  - ThetaData Terminal handles its own authentication
  - No user management or multi-tenancy

## Secrets Management
- **Development:** Environment variables via `.env` file (git-ignored)
- **Production:** Environment variables only
- **Code Requirements:**
  - NEVER hardcode secrets
  - Access via configuration service only
  - No secrets in logs or error messages

## API Security
- **Rate Limiting:** Implemented in ThetaDataApiClient (2-4 concurrent requests)
- **CORS Policy:** Not applicable - CLI tool
- **Security Headers:** Not applicable - no HTTP server
- **HTTPS Enforcement:** ThetaData Terminal is local HTTP only

## Data Protection
- **Encryption at Rest:** Not implemented - market data is public
- **Encryption in Transit:** Not applicable - local terminal connection
- **PII Handling:** No PII collected or stored
- **Logging Restrictions:** No sensitive data to exclude

## Dependency Security
- **Scanning Tool:** `bun audit` for vulnerability scanning
- **Update Policy:** Monthly dependency updates
- **Approval Process:** Review all new dependencies for:
  - License compatibility (MIT, Apache 2.0, BSD)
  - Maintenance status (last update within 6 months)
  - Security history (no critical vulnerabilities)

## Security Testing
- **SAST Tool:** Biome linting with security rules enabled
- **DAST Tool:** Not applicable - no running services
- **Penetration Testing:** Not required for local CLI tool
