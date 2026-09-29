# ClearSet AI — new-account cutover (stages 0-5).
#
# Usage:
#   powershell -File scripts\migrate\cutover.ps1 -Connection clearset-hack
#
# Stages:
#   0  resolve connection (account/user/warehouse read from connections.toml; password NEVER printed)
#   1  connectivity gate: snow sql works against the new account
#   2  CoCo gate: cortex exec answers  -> GO / NO-GO (skip with -SkipCocoGate)
#   3  provision warehouse + database + schema (idempotent)
#   4  migrate data: migrate_all.py + repair_demo_data.py via CLEARSET_CONNECTION
#   5  verify: exception/trade counts + hero trade + duplicate check
#
# Image push / service create / docs sweep are done separately (see DEPLOYMENT.md).

param(
  [string]$Connection = 'clearset-hack',
  [switch]$SkipCocoGate
)

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Say($msg) { Write-Output ("[cutover] " + $msg) }
function Fail($msg) { Write-Output ("[cutover] FAIL: " + $msg); exit 1 }

# Native tools (snow/cortex) write warnings to stderr, which PowerShell 5.1 turns
# into errors under $ErrorActionPreference='Stop'. Run everything through cmd with
# file redirection so exit codes and output are captured reliably.
function Run-Cmd([string]$Cmd) {
  $f = Join-Path $env:TEMP ('clearset-cutover-' + [guid]::NewGuid().ToString('N') + '.log')
  cmd /c "$Cmd > `"$f`" 2>&1" | Out-Null
  $code = $LASTEXITCODE
  $text = ''
  if (Test-Path $f) { $text = Get-Content $f -Raw }
  Remove-Item $f -Force -ErrorAction SilentlyContinue
  if (-not $text) { $text = '' }
  return @{ Code = $code; Output = $text }
}

# --- Stage 0: resolve connection ---------------------------------------------
$tomlPath = Join-Path $env:USERPROFILE '.snowflake\connections.toml'
if (-not (Test-Path $tomlPath)) { Fail "connections.toml not found at $tomlPath" }
$toml = Get-Content $tomlPath -Raw
$block = [regex]::Match($toml, "(?ms)^\[$([regex]::Escape($Connection))\](.*?)(?=^\[|\z)")
if (-not $block.Success) { Fail "connection [$Connection] not found in connections.toml - paste the block first" }

$acct = [regex]::Match($block.Groups[1].Value, 'account\s*=\s*"([^"]+)"').Groups[1].Value
$user = [regex]::Match($block.Groups[1].Value, 'user\s*=\s*"([^"]+)"').Groups[1].Value
$whse = [regex]::Match($block.Groups[1].Value, 'warehouse\s*=\s*"([^"]+)"').Groups[1].Value
if (-not $acct) { Fail "[$Connection] has no account field" }
if (-not $whse) { $whse = 'COMPUTE_WH' }
$registry = $acct.ToLower() + '.registry.snowflakecomputing.com'
Say "connection=$Connection account=$acct user=$user warehouse=$whse"
Say "registry   = $registry"
Say "password stays in connections.toml (never read/printed by this script)"

# --- Stage 1: connectivity gate ----------------------------------------------
Say "stage 1: connectivity"
$r1 = Run-Cmd "snow sql -q `"SELECT CURRENT_ACCOUNT() AS A, CURRENT_USER() AS U, CURRENT_ROLE() AS R`" --connection $Connection --format csv"
if ($r1.Code -ne 0) { Fail "snow sql failed: $($r1.Output)" }
Say "OK: authenticated as $user on $Connection"
Say ("    " + (($r1.Output -split "`n" | Where-Object { $_ -match 'TK|^[A-Z]{7}' } | Select-Object -First 1)))

# --- Stage 2: CoCo gate ------------------------------------------------------
if (-not $SkipCocoGate) {
  Say "stage 2: CoCo CLI gate (decides whether the migration is worth doing)"
  Run-Cmd "cortex connections set $Connection" | Out-Null
  $tmp = Join-Path $env:TEMP 'clearset-cutover-coco.txt'
  [System.IO.File]::WriteAllText($tmp, 'Reply with exactly: COCO_OK')
  $r2 = Run-Cmd "cortex exec --file `"$tmp`" --max-turns 2 --no-history"
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  if ($r2.Output -match 'COCO_OK') {
    Say "GO: CoCo CLI works on $Connection"
  } else {
    Say "NO-GO: CoCo CLI did not answer on $Connection"
    ($r2.Output -split "`n" | Select-Object -Last 8) | ForEach-Object { Say ("    " + $_) }
    Say "Re-run with -SkipCocoGate to migrate anyway (NOT recommended)."
    exit 9
  }
} else {
  Say "stage 2: SKIPPED (-SkipCocoGate)"
}

# --- Stage 3: provision ------------------------------------------------------
Say "stage 3: provision (idempotent)"
# 3a: warehouse/db/schema
$ddl = "CREATE WAREHOUSE IF NOT EXISTS $whse WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE; CREATE DATABASE IF NOT EXISTS CLEARSET_DB; CREATE SCHEMA IF NOT EXISTS CLEARSET_DB.CLEARSET_SCHEMA;"
$ddlFile = Join-Path $env:TEMP 'clearset-cutover-ddl.sql'
[System.IO.File]::WriteAllText($ddlFile, $ddl)
$r3 = Run-Cmd "snow sql -f `"$ddlFile`" --connection $Connection --format csv"
Remove-Item $ddlFile -Force -ErrorAction SilentlyContinue
if ($r3.Code -ne 0) { Fail "provisioning failed: $($r3.Output)" }
Say "OK: warehouse/database/schema present"

# 3b: DDL in dependency order (each file sets its own USE context)
#     01 tables -> 02 base seeds (incl hero TRD-92831) -> 03 semantic views
#     -> 04 policy chunks + Cortex Search service -> 08 RESOLUTION_CASES
$snowDir = Join-Path $Repo 'snowflake'
foreach ($f in @('01_schema.sql', '02_seeds.sql', '03_semantic_views.sql', '04_cortex_search.sql', '08_resolution_cases.sql')) {
  $path = Join-Path $snowDir $f
  if (-not (Test-Path $path)) { Fail "missing SQL file: $path" }
  $r = Run-Cmd "snow sql -f `"$path`" --connection $Connection --format csv"
  if ($r.Code -ne 0) { Fail "$f failed: $($r.Output)" }
  Say "OK: $f"
}

# --- Stage 4: migrate --------------------------------------------------------
Say "stage 4: data migration (idempotent; protected trades untouched)"
$env:CLEARSET_CONNECTION = $Connection
$migDir = Join-Path $Repo 'scripts\migrate'
$r4a = Run-Cmd "cd /d `"$migDir`" && python migrate_all.py"
Write-Output ($r4a.Output.TrimEnd())
if ($r4a.Code -ne 0) { Fail "migrate_all.py failed (exit $($r4a.Code))" }
$r4b = Run-Cmd "cd /d `"$migDir`" && python repair_demo_data.py"
Write-Output ($r4b.Output.TrimEnd())
if ($r4b.Code -ne 0) { Fail "repair_demo_data.py failed (exit $($r4b.Code))" }

# --- Stage 5: verify ---------------------------------------------------------
Say "stage 5: verification"
$verify = "SELECT 'EXCEPTIONS' AS K, COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.EXCEPTIONS UNION ALL SELECT 'VIEW_ROWS', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED UNION ALL SELECT 'VIEW_DISTINCT', COUNT(DISTINCT EXCEPTION_ID) FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED UNION ALL SELECT 'TRADES', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES UNION ALL SELECT 'SECURITIES', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES UNION ALL SELECT 'SECURITIES_DISTINCT', COUNT(DISTINCT ISIN) FROM CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES UNION ALL SELECT 'COUNTERPARTIES', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES UNION ALL SELECT 'COUNTERPARTIES_DISTINCT', COUNT(DISTINCT CP_ID) FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES UNION ALL SELECT 'HERO_TRADE_92831', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES WHERE TRADE_ID = 'TRD-92831' UNION ALL SELECT 'TRADES_WITHOUT_SECURITY', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES T LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES S ON T.ISIN = S.ISIN WHERE S.ISIN IS NULL;"
$vFile = Join-Path $env:TEMP 'clearset-cutover-verify.sql'
[System.IO.File]::WriteAllText($vFile, $verify)
$r5 = Run-Cmd "snow sql -f `"$vFile`" --connection $Connection --format csv"
Remove-Item $vFile -Force -ErrorAction SilentlyContinue
($r5.Output -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^[A-Z_]+,\d+$' } | ForEach-Object { Say ("    " + $_) }
if ($r5.Code -ne 0) { Fail "verification query failed" }

Say "stages 0-5 COMPLETE. Remaining (assistant runs these):"
Say "  6  point server/.env + docker-compose at $acct, restart local backend"
Say "  7  docker build/push to $registry, create pool + service, capture ingress URL"
Say "  8  judge user + ALL_ENDPOINTS_USAGE grant, expiry check"
Say "  9  URL/locator/digest sweep across docs + CI/Makefile/service-spec"
Say " 10  full gate: 42 tests + tsc + lint + build + live API checks"
