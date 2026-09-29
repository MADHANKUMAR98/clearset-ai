<#
.SYNOPSIS
  Sets every GitHub Actions secret the CI/CD pipeline needs for the CURRENT
  Snowflake account (LHBBRSO-DZ87434 / connection clearset-hack).

.DESCRIPTION
  Secrets are passed to `gh` on STDIN so no credential ever appears in a process
  list, a shell history entry, or this script. Nothing secret is printed.

  Prerequisite (one time, in your own terminal):
      winget install --id GitHub.cli -e      # if gh is not already installed
      gh auth login --hostname github.com --git-protocol https --web

.EXAMPLE
  pwsh scripts/set-github-secrets.ps1
#>

$ErrorActionPreference = 'Stop'

$Account    = 'LHBBRSO-DZ87434'
$User       = 'MADHANKUMAR98'
$Connection = 'clearset-hack'
$Registry   = 'lhbbrso-dz87434.registry.snowflakecomputing.com'

# ---- preflight -------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "gh CLI not found. Install it:  winget install --id GitHub.cli -e"
}
$auth = gh auth status 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Error "gh is not authenticated. Run:  gh auth login --hostname github.com --git-protocol https --web"
}

$envFile = Join-Path $PSScriptRoot '..\server\.env'
if (-not (Test-Path $envFile)) {
    Write-Error "server/.env not found - it holds the password and PAT this script needs."
}
$values = @{}
foreach ($line in (Get-Content $envFile)) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
        $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
foreach ($required in @('SNOWFLAKE_PASSWORD', 'SNOWFLAKE_PAT')) {
    if (-not $values[$required]) { Write-Error "server/.env is missing $required" }
}

# ---- secrets ---------------------------------------------------------------
# Registry auth in CI uses username `0sessiontoken` with a PAT as the password,
# so SNOWFLAKE_REGISTRY_TOKEN and SNOWFLAKE_PAT are the same token by design.
$secrets = [ordered]@{
    SNOWFLAKE_ACCOUNT       = $Account
    SNOWFLAKE_USER          = $User
    SNOWFLAKE_PASSWORD      = $values['SNOWFLAKE_PASSWORD']
    SNOWFLAKE_PAT           = $values['SNOWFLAKE_PAT']
    SNOWFLAKE_CONNECTION    = $Connection
    SNOWFLAKE_REGISTRY      = $Registry
    SNOWFLAKE_REGISTRY_TOKEN = $values['SNOWFLAKE_PAT']
}

foreach ($name in $secrets.Keys) {
    $secrets[$name] | gh secret set $name 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set secret: $name" }
    Write-Output ("set  {0,-26} (value withheld)" -f $name)
}

Write-Output ""
Write-Output "Done. Verify at: https://github.com/MADHANKUMAR98/clearset-ai/settings/secrets/actions"
Write-Output "Then push to main to watch the pipeline run green."
