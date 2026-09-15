param(
    [Parameter(Mandatory=$true)][string]$Server,
    [Parameter(Mandatory=$true)][string]$IdFile
)

$last = 0
if (Test-Path $IdFile) {
    $content = Get-Content $IdFile -Raw
    if ($content -match '^\d+$') { $last = [int]$content }
}

try {
    $url = "$Server/api/messages?after=$last"
    $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 5
} catch {
    Write-Host "[blad polaczenia z serwerem]"
    exit 0
}

foreach ($m in $response) {
    $time = ([datetime]$m.time).ToLocalTime().ToString("HH:mm:ss")
    Write-Host "[$time] $($m.nick): $($m.text)"
    $last = $m.id
}

Set-Content -Path $IdFile -Value $last -NoNewline
