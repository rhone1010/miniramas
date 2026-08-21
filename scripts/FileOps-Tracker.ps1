# FileOps-Tracker.ps1
# Central tracked file-operation helpers.
# Logs user/script-directed file changes to H:\NO_DELETE_ARCHIVE\Logs
# Does not rely on console scraping or FileSystemWatcher.

$script:FileOpsLogRoot = "H:\NO_DELETE_ARCHIVE\Logs"
$script:FileOpsLog = Join-Path $script:FileOpsLogRoot ("FileActions_{0}.csv" -f (Get-Date -Format "yyyy-MM-dd"))

# H: NOT BEING THERE MUST NOT MAKE EVERY SCRIPT UNLOADABLE.
#
# This ran unguarded at load time, so a script that dot-sources the tracker
# would not start at all with the drive absent. That turns an audit feature
# into a single point of failure for work that has nothing to do with it.
#
# It still refuses to run silently: $FileOpsReady is false, every logging
# call says so once, loudly, and the file operations go ahead untracked.
$script:FileOpsReady = $false
try {
    New-Item -ItemType Directory -Path $script:FileOpsLogRoot -Force -ErrorAction Stop | Out-Null
    $script:FileOpsReady = $true
}
catch {
    Write-Host "FileOps tracking UNAVAILABLE: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  File operations will proceed UNTRACKED." -ForegroundColor Red
}

function Get-SafeHash {
    param([string]$Path)

    # THREE OUTCOMES, THREE ANSWERS.
    #
    # This returned "" for all of them, so a file that could not be hashed -
    # locked, unreadable, mid-write - looked identical to a file that was
    # never there. Silent, inside a tracker whose purpose is not being
    # silent.
    if ([string]::IsNullOrWhiteSpace($Path)) { return "" }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return "NO_FILE" }

    try {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash
    }
    catch {
        Write-Host "  hash failed: $Path - $($_.Exception.Message)" -ForegroundColor DarkYellow
        return "HASH_ERROR"
    }
}

# NO_FILE and HASH_ERROR are answers, not hashes. Comparing them would make
# two unreadable files look identical and report VERIFIED.
function Test-RealHash {
    param([string]$Value)
    return ($Value -and $Value -ne "NO_FILE" -and $Value -ne "HASH_ERROR")
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

    # WALK PAST THE TRACKER, DO NOT COUNT FRAMES.
    #
    # Two attempts got this wrong before it was right, and the reason is
    # worth writing down.
    #
    # -Skip 1 recorded "FileOps-Tracker.ps1 / Invoke-TrackedMove" on every
    # row: frame 1 is the wrapper, not the caller.
    #
    # -Skip 2 recorded THE SAME THING, which is the surprising part. A
    # dot-sourced function's parent frame is the file it was DEFINED in, not
    # the file that called it - so frame 2 is still the tracker, and a fixed
    # depth can never reach past it.
    #
    # So: walk until a frame belongs to something that is not this file.
    # That is the script that actually did the work, however many wrappers
    # sit between.
    $trackerFile = $PSCommandPath
    $caller = $null
    foreach ($frame in (Get-PSCallStack)) {
        if ($frame.ScriptName -and $frame.ScriptName -ne $trackerFile) {
            $caller = $frame
            break
        }
    }
    # Nothing but the tracker on the stack means it was called straight from
    # a prompt. Recorded as such rather than left blank.
    if (-not $caller) { $caller = (Get-PSCallStack)[-1] }

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

    if (-not $script:FileOpsReady) {
        Write-Host "  [untracked] $Action $Source $Destination" -ForegroundColor DarkYellow
        return
    }

    # -- THE APPEND RETRIES, AND NEVER TAKES THE OPERATION DOWN WITH IT --
    #
    # Two faults, both real, both fixed here.
    #
    # WITHOUT -ErrorAction Stop, Export-Csv writes a non-terminating error
    # that a script with the default preference simply carries on past. The
    # row is gone and nothing says so. That is the exact failure this whole
    # library exists to prevent, sitting inside the library.
    #
    # AND batches run in parallel windows, all appending to the same daily
    # file. A second writer holding the handle throws, so the retry is not
    # optional - it is the ordinary case, not the rare one.
    #
    # After the retries are spent, the failure is SHOUTED and swallowed. A
    # logging failure must never abort a file operation: an untracked move
    # is a gap in a record, a move that did not happen is lost work.
    $attempt = 0
    while ($true) {
        try {
            $row | Export-Csv -LiteralPath $script:FileOpsLog -Append -NoTypeInformation -ErrorAction Stop
            return
        }
        catch {
            $attempt++
            if ($attempt -ge 5) {
                Write-Host "" 
                Write-Host "  LOG WRITE FAILED after $attempt attempts" -ForegroundColor Red
                Write-Host "  $Action  $Source  ->  $Destination" -ForegroundColor Red
                Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "  THE FILE OPERATION ITSELF IS UNAFFECTED. This row is lost." -ForegroundColor Red
                Write-Host ""
                return
            }
            Start-Sleep -Milliseconds (50 * $attempt)
        }
    }
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
        $verified = (Test-RealHash $srcHash) -and (Test-RealHash $dstHash) -and ($srcHash -eq $dstHash)

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
        $verified = (Test-RealHash $srcHash) -and (Test-RealHash $dstHash) -and ($srcHash -eq $dstHash)

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
        $verified = (Test-RealHash $srcHash) -and (Test-RealHash $dstHash) -and ($srcHash -eq $dstHash)

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

if ($script:FileOpsReady) {
    Write-Host "FileOps tracking loaded."
    Write-Host "Log: $script:FileOpsLog"
}
