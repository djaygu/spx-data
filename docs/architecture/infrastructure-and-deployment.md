# Infrastructure and Deployment

## Infrastructure as Code
- **Tool:** Bun 1.1.0 (built-in bundler)
- **Location:** `./scripts/build.ts`
- **Approach:** Single binary compilation using Bun's native bundler for easy distribution

## Deployment Strategy
- **Strategy:** Local deployment as standalone CLI binary
- **CI/CD Platform:** GitHub Actions
- **Pipeline Configuration:** `.github/workflows/release.yml`

## Environments
- **Development:** Local development with hot reload using `bun --hot`
- **Testing:** In-memory test layers with mocked ThetaData responses
- **Production:** Compiled binary with embedded dependencies

## Environment Promotion Flow
```
Development (local) 
    ↓ (commit)
GitHub CI (automated tests)
    ↓ (merge to main)
Release Build (GitHub Actions)
    ↓ (tag release)
Binary Distribution (GitHub Releases)
    ↓ (download)
User Installation (local machine)
```

## Rollback Strategy
- **Primary Method:** Previous binary version from GitHub Releases
- **Trigger Conditions:** Critical bugs, data corruption issues
- **Recovery Time Objective:** < 5 minutes (download previous version)
