<#
.SYNOPSIS
  Sets every GitHub Actions secret the CI/CD pipeline needs for the CURRENT
  Snowflake account (LHBBRSO-DZ87434 / connection clearset-hack).

.DESCRIPTION
  Each secret value is written straight to gh's stdin (no trailing newline) so the
  credential never appears in a process list, a command line, a shell history
  entry, a temp file, or this script. Nothing secret is printed.

  Prerequisites (one time, in your own terminal):
      winget install --id GitHub.cli -e        # if gh is not already installed
      gh auth login --hostname github.com --git-protocol https --web

.EXAMPLE
  pwsh -File scripts/set-github-secrets.ps1
#>

$ErrorActionPreference = 'Stop'

$Repo         = 'MADHANKUMAR98/clearset-ai'
$Account      = 'LHBBRSO-DZ87434'
$User         = 'MADHANKUMAR98'
$Connection   = 'clearset-hack'
$Registry     = 'lhbbrso-dz87434.registry.snowflakecomputing.com'

# ---- preflight -------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "gh CLI not found. Install it first:  winget install --id GitHub.cli -e"
}
gh auth status *> $null
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
    SNOWFLAKE_ACCOUNT        = $Account
    SNOWFLAKE_USER           = $User
    SNOWFLAKE_PASSWORD       = $values['SNOWFLAKE_PASSWORD']
    SNOWFLAKE_CONNECTION     = $Connection
    SNOWFLAKE_REGISTRY       = $Registry
    SNOWFLAKE_REGISTRY_TOKEN = $values['SNOWFLAKE_PAT']
    SNOWFLAKE_PAT            = $values['SNOWFLAKE_PAT']
}

function Set-GhSecret([string]$Name, [string]$Value) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = 'gh'
    $psi.Arguments              = "secret set $Name --repo $Repo"
    $psi.RedirectStandardInput  = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute        = $false
    $psi.CreateNoWindow         = $true

    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.Write($Value)   # exact bytes, no newline appended
    $p.StandardInput.Close()
    $err = $p.StandardError.ReadToEnd()
    $out = $p.StandardOutput.ReadToEnd()
    $null = $p.WaitForExit(60000)

    if ($p.ExitCode -ne 0) {
        $msg = ($err + $out) -replace '\s+', ' '
        Write-Error "Failed to set secret ${Name}: $msg"
    }
}

foreach ($name in $secrets.Keys) {
    Set-GhSecret $name ([string]$secrets[$name])
    Write-Output ("  set  {0,-24} (value withheld)" -f $name)
}

# ---- verify (names only, never values) -------------------------------------
$list = gh secret list --repo $Repo 2>&1 | Out-String
Write-Output ""
Write-Output "Secrets now on ${Repo}:"
($list -split "`r?`n") | Where-Object { $_.Trim() -ne '' } | ForEach-Object { "  $_" }
Write-Output ""
Write-Output "Push to main to watch the pipeline: https://github.com/$Repo/actions"
