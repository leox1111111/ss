param(
    [Parameter(Mandatory=$true)][string]$Server,
    [Parameter(Mandatory=$true)][string]$IdFile
)

# Wymuszenie TLS 1.2 - starsze Windows/PowerShell 5.1 domyslnie go nie wlaczaja,
# co powoduje "blad polaczenia" przy laczeniu z serwerami HTTPS (np. Render).
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$last = 0
if (Test-Path $IdFile) {
    $content = Get-Content $IdFile -Raw
    if ($content -match '^\d+$') { $last = [int]$content }
}

try {
    $url = "$Server/api/messages?after=$last"
    # 25s timeout - darmowy plan Render usypia serwer, pierwsze zapytanie
    # po przerwie moze potrwac kilkanascie sekund, zanim serwer sie obudzi.
    $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 25
} catch {
    Write-Host "[blad polaczenia z serwerem: $($_.Exception.Message)]"
    exit 0
}

foreach ($m in $response) {
    $time = ([datetime]$m.time).ToLocalTime().ToString("HH:mm:ss")
    Write-Host "[$time] $($m.nick): $($m.text)"
    $last = $m.id
}

Set-Content -Path $IdFile -Value $last -NoNewline
