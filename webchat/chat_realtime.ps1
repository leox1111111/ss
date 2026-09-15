# chat.ps1
# Klient czatu z prawdziwym nasłuchem w tle: nowe wiadomości pojawiają się
# same, bez potrzeby wciśnięcia Enter. Wpisywanie tekstu działa równolegle.

param(
    [string]$Server,
    [string]$Nick
)

if (-not $Server) { $Server = Read-Host "Adres serwera (np. https://twoja-nazwa.onrender.com)" }
if (-not $Nick)   { $Nick   = Read-Host "Twoj nick" }

$Server = $Server.TrimEnd('/')

Write-Host "==================================="
Write-Host "  Polaczono jako $Nick"
Write-Host "  Wpisz wiadomosc i Enter. 'exit' konczy."
Write-Host "==================================="

# Kolejka współdzielona między wątkiem odpytującym a głównym wątkiem
$queue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()
$stopFlag = [ref]$false

# Skrypt działający w tle: co 2s pyta serwer o nowe wiadomości
$pollBlock = {
    param($Server, $queue, $stopFlagBox)

    $last = 0
    while (-not $stopFlagBox.Value) {
        try {
            $resp = Invoke-RestMethod -Uri "$Server/api/messages?after=$last" -Method Get -TimeoutSec 5
            foreach ($m in $resp) {
                $time = ([datetime]$m.time).ToLocalTime().ToString("HH:mm:ss")
                $queue.Enqueue("[$time] $($m.nick): $($m.text)")
                $last = $m.id
            }
        } catch {
            # cichy blad polaczenia - probujemy dalej
        }
        Start-Sleep -Milliseconds 2000
    }
}

$runspace = [runspacefactory]::CreateRunspace()
$runspace.Open()
$psInstance = [powershell]::Create()
$psInstance.Runspace = $runspace
$psInstance.AddScript($pollBlock).AddArgument($Server).AddArgument($queue).AddArgument($stopFlag) | Out-Null
$asyncHandle = $psInstance.BeginInvoke()

function Send-Message([string]$text) {
    try {
        $body = @{ nick = $Nick; text = $text } | ConvertTo-Json
        Invoke-RestMethod -Uri "$Server/api/messages" -Method Post `
            -ContentType "application/json; charset=utf-8" `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 5 | Out-Null
    } catch {
        Write-Host "[nie udalo sie wyslac wiadomosci]"
    }
}

$inputBuffer = ""
Write-Host -NoNewline "> "

try {
    while ($true) {
        $msg = $null
        while ($queue.TryDequeue([ref]$msg)) {
            # wyczyść bieżącą linię wpisu, pokaż wiadomość, odtwórz linię wpisu
            Write-Host "`r$(' ' * ($inputBuffer.Length + 2))`r$msg"
            Write-Host -NoNewline "> $inputBuffer"
        }

        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)

            if ($key.Key -eq 'Enter') {
                Write-Host ""
                if ($inputBuffer -eq 'exit') { break }
                if ($inputBuffer.Trim() -ne '') { Send-Message $inputBuffer }
                $inputBuffer = ""
                Write-Host -NoNewline "> "
            }
            elseif ($key.Key -eq 'Backspace') {
                if ($inputBuffer.Length -gt 0) {
                    $inputBuffer = $inputBuffer.Substring(0, $inputBuffer.Length - 1)
                    Write-Host -NoNewline "`b `b"
                }
            }
            elseif ($key.KeyChar) {
                $inputBuffer += $key.KeyChar
                Write-Host -NoNewline $key.KeyChar
            }
        } else {
            Start-Sleep -Milliseconds 80
        }
    }
} finally {
    $stopFlag.Value = $true
    Start-Sleep -Milliseconds 200
    $psInstance.Stop() | Out-Null
    $psInstance.Dispose()
    $runspace.Close()
    Write-Host "Rozlaczono."
}
