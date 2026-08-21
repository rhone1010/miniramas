# FileOps-Tracker.ps1
# Central tracked file-operation helpers.
# Logs user/script-directed file changes to H:\NO_DELETE_ARCHIVE\Logs
# Does not rely on console scraping or FileSystemWatcher.

$script:FileOpsLogRoot = "H:\NO_DELETE_ARCHIVE\Logs"
$script:FileOpsLog = Join-Path $script:FileOpsLogRoot ("FileActions_{0}.csv" -f (Get-Date -Format "yyyy-MM-dd"))

New-Item -ItemType Directory -Path $script:FileOpsLogRoot -Force | Out-Null

function Get-SafeHash {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) { return "" }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return "" }

    try {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash
    }
    catch {
        return ""
    }
}

function Write-FileAction {
    param(
        [Parameter(Mandatory)][string]$Action,
        [string]$Source = "",
        [string]$Destination = "",
        [string]$SourceHash = "",
        [string]$DestinationHash = "",
        [string]$Result = "",
        [string]$Note = ""
    )

    $caller = (Get-PSCallStack | Select-Object -Skip 1 -First 1)

    $row = [PSCustomObject]@{
        Timestamp       = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
        Action          = $Action
        Source          = $Source
        Destination     = $Destination
        SourceSHA256    = $SourceHash
        DestinationSHA256 = $DestinationHash
        Result          = $Result
        Script          = if ($caller.ScriptName) { $caller.ScriptName } else { $MyInvocation.ScriptName }
        Function        = $caller.FunctionName
        ProcessId       = $PID
        User            = [Environment]::UserName
        Computer        = $env:COMPUTERNAME
        Note            = $Note
    }

    $row | Export-Csv -LiteralPath $script:FileOpsLog -Append -NoTypeInformation
}

function Invoke-TrackedCopy {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [string]$Note = ""
    )

    $srcHash = Get-SafeHash $Source

    Write-FileAction -Action "COPY_BEGIN" -Source $Source -Destination $Destination `
        -SourceHash $srcHash -Result "STARTED" -Note $Note

    try {
        Copy-Item -LiteralPath $Source -Destination $Destination -ErrorAction Stop

        $dstPath = if (Test-Path -LiteralPath $Destination -PathType Container) {
            Join-Path $Destination (Split-Path $Source -Leaf)
        } else {
            $Destination
        }

        $dstHash = Get-SafeHash $dstPath
        $verified = ($srcHash -and $dstHash -and ($srcHash -eq $dstHash))

        Write-FileAction -Action "COPY_END" -Source $Source -Destination $dstPath `
            -SourceHash $srcHash -DestinationHash $dstHash `
            -Result $(if ($verified) {"VERIFIED"} else {"COMPLETED_UNVERIFIED"}) -Note $Note
    }
    catch {
        Write-FileAction -Action "COPY_ERROR" -Source $Source -Destination $Destination `
            -SourceHash $srcHash -Result "ERROR" -Note $_.Exception.Message
        throw
    }
}

function Invoke-TrackedMove {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [string]$Note = ""
    )

    $srcHash = Get-SafeHash $Source

    Write-FileAction -Action "MOVE_BEGIN" -Source $Source -Destination $Destination `
        -SourceHash $srcHash -Result "STARTED" -Note $Note

    try {
        Move-Item -LiteralPath $Source -Destination $Destination -ErrorAction Stop

        $dstPath = if (Test-Path -LiteralPath $Destination -PathType Container) {
            Join-Path $Destination (Split-Path $Source -Leaf)
        } else {
            $Destination
        }

        $dstHash = Get-SafeHash $dstPath
        $verified = ($srcHash -and $dstHash -and ($srcHash -eq $dstHash))

        Write-FileAction -Action "MOVE_END" -Source $Source -Destination $dstPath `
            -SourceHash $srcHash -DestinationHash $dstHash `
            -Result $(if ($verified) {"VERIFIED"} else {"COMPLETED_UNVERIFIED"}) -Note $Note
    }
    catch {
        Write-FileAction -Action "MOVE_ERROR" -Source $Source -Destination $Destination `
            -SourceHash $srcHash -Result "ERROR" -Note $_.Exception.Message
        throw
    }
}

function Invoke-TrackedRename {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$NewName,
        [string]$Note = ""
    )

    $srcHash = Get-SafeHash $Path
    $parent = Split-Path $Path -Parent
    $destination = Join-Path $parent $NewName

    Write-FileAction -Action "RENAME_BEGIN" -Source $Path -Destination $destination `
        -SourceHash $srcHash -Result "STARTED" -Note $Note

    try {
        Rename-Item -LiteralPath $Path -NewName $NewName -ErrorAction Stop
        $dstHash = Get-SafeHash $destination
        $verified = ($srcHash -and $dstHash -and ($srcHash -eq $dstHash))

        Write-FileAction -Action "RENAME_END" -Source $Path -Destination $destination `
            -SourceHash $srcHash -DestinationHash $dstHash `
            -Result $(if ($verified) {"VERIFIED"} else {"COMPLETED_UNVERIFIED"}) -Note $Note
    }
    catch {
        Write-FileAction -Action "RENAME_ERROR" -Source $Path -Destination $destination `
            -SourceHash $srcHash -Result "ERROR" -Note $_.Exception.Message
        throw
    }
}

function Register-GeneratedFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$BatchId = "",
        [string]$Note = ""
    )

    $hash = Get-SafeHash $Path
    Write-FileAction -Action "GENERATED_FILE" -Destination $Path `
        -DestinationHash $hash -Result $(if ($hash) {"RECORDED"} else {"MISSING"}) `
        -Note ("BatchId={0}; {1}" -f $BatchId, $Note)
}

function Start-TrackedBatch {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$BatchId,
        [string]$Description = ""
    )

    Write-FileAction -Action "BATCH_START" -Result "STARTED" `
        -Note ("BatchId={0}; {1}" -f $BatchId, $Description)
}

function End-TrackedBatch {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$BatchId,
        [string]$Description = ""
    )

    Write-FileAction -Action "BATCH_END" -Result "COMPLETED" `
        -Note ("BatchId={0}; {1}" -f $BatchId, $Description)
}

Write-Host "FileOps tracking loaded."
Write-Host "Log: $script:FileOpsLog"
