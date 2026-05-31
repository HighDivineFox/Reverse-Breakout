param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Message,

  [Parameter(Position = 1)]
  [string]$Branch
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [scriptblock]$Command,
    [string]$FailureMessage
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

if ($Branch) {
  Invoke-Checked { git fetch origin main } "Could not fetch origin/main."
  Invoke-Checked { git switch -c $Branch origin/main } "Could not create branch '$Branch' from origin/main."
}

$currentBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentBranch)) {
  throw "Could not determine the current Git branch."
}

if ($currentBranch -in @("main", "master")) {
  throw "Refusing to publish directly from '$currentBranch'. Pass a feature branch name as the second argument."
}

$changes = @(git status --short)
if ($LASTEXITCODE -ne 0) {
  throw "Could not read the Git working tree status."
}

if ($changes.Count -eq 0) {
  Write-Host "No local changes to commit. Pushing '$currentBranch' as-is."
  Invoke-Checked { git push -u origin $currentBranch } "Could not push '$currentBranch'."
  exit 0
}

Write-Host "Files that will be committed:"
$changes | ForEach-Object { Write-Host "  $_" }

$answer = Read-Host "Run validation, commit all listed files, and push '$currentBranch'? [y/N]"
if ($answer -notin @("y", "yes")) {
  Write-Host "Publish cancelled."
  exit 1
}

Invoke-Checked { npm run check } "Syntax checks failed."
Invoke-Checked { npm test } "Automated tests failed."
Invoke-Checked { git add -A } "Could not stage the listed files."
Invoke-Checked { git commit -m $Message } "Could not create the commit."
Invoke-Checked { git push -u origin $currentBranch } "Could not push '$currentBranch'."

$remoteUrl = (git remote get-url origin).Trim() -replace "\.git$", ""
if ($remoteUrl -match "^git@github\.com:(.+)$") {
  $remoteUrl = "https://github.com/$($Matches[1])"
}

Write-Host "Pushed '$currentBranch'."
if ($remoteUrl -match "^https://github\.com/") {
  Write-Host "Open a pull request: ${remoteUrl}/compare/main...${currentBranch}?expand=1"
}
