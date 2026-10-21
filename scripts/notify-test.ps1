# Тестовое уведомление от бота Tickety — так будет выглядеть сообщение о переоформлении билета.
# Запуск из папки проекта:  powershell -ExecutionPolicy Bypass -File scripts\notify-test.ps1
# Токен вводится скрыто, нигде не сохраняется и живёт только до конца работы скрипта.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$AppUrl = 'https://yaneponimaucheoniotmenyahotyat.github.io/tickety-twa/#/tickets'

function Invoke-Bot($Token, $Method, $Body) {
    $uri = "https://api.telegram.org/bot$Token/$Method"
    try {
        if ($Body) {
            $json = $Body | ConvertTo-Json -Depth 8
            return Invoke-RestMethod $uri -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($json))
        }
        return Invoke-RestMethod $uri
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $text = ''
        try { $text = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() | ConvertFrom-Json | ForEach-Object description } catch { }
        switch ($status) {
            401 { throw 'Токен неверный (401). Скопируйте его заново из @BotFather -> /mybots -> API Token.' }
            403 { throw 'Бот не может писать вам первым (403). Откройте чат с ботом и нажмите START.' }
            $null { throw "Нет связи с api.telegram.org: $($_.Exception.Message)" }
            default { throw "Telegram ответил $status`: $text" }
        }
    }
}

Write-Host ''
Write-Host 'Тестовое уведомление Tickety' -ForegroundColor Cyan
$secure = Read-Host 'Вставьте токен бота (символы не отображаются) и нажмите Enter' -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $token) { Write-Host 'Токен пустой — запустите скрипт ещё раз.' -ForegroundColor Red; exit 1 }

try {
    $bot = (Invoke-Bot $token 'getMe').result
    Write-Host "Бот найден: @$($bot.username)" -ForegroundColor Green

    # Ищем ваш chat_id среди последних сообщений боту — вручную искать id не нужно
    $chat = $null
    for ($try = 1; -not $chat -and $try -le 3; $try++) {
        $updates = (Invoke-Bot $token 'getUpdates').result
        $chat = $updates | ForEach-Object { $_.message.chat } | Where-Object { $_.type -eq 'private' } | Select-Object -Last 1
        if (-not $chat) {
            Write-Host ''
            Write-Host "Откройте в Telegram чат с @$($bot.username), отправьте ему любое сообщение (например «привет»)," -ForegroundColor Yellow
            Read-Host 'затем вернитесь сюда и нажмите Enter'
        }
    }
    if (-not $chat) { throw 'Бот так и не получил от вас сообщение. Напишите ему и запустите скрипт снова.' }
    Write-Host "Ваш chat_id: $($chat.id) ($($chat.first_name))" -ForegroundColor Green

    $null = Invoke-Bot $token 'sendMessage' @{
        chat_id      = $chat.id
        text         = "🎫 Билет на «Баста — Большой сольный концерт» переоформлен на вас.`nQR-код для прохода готов."
        reply_markup = @{ inline_keyboard = @(, @(@{ text = 'Открыть билет'; web_app = @{ url = $AppUrl } })) }
    }
    Write-Host ''
    Write-Host 'Готово! Проверьте чат с ботом — там сообщение с кнопкой «Открыть билет».' -ForegroundColor Green
} catch {
    Write-Host ''
    Write-Host "Ошибка: $_" -ForegroundColor Red
    exit 1
} finally {
    $token = $null
}
