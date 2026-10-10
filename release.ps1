# Publishes a SteamLite Messages update. Usage:  .\release.ps1 -Notes "What changed" [-MinVersion 1.0.0]
# 1. builds the signed APK  2. creates the GitHub release with the APK  3. updates version.json LAST (the app only sees the new version once the APK is downloadable)
param([Parameter(Mandatory)][string]$Notes, [string]$MinVersion = '')
$ErrorActionPreference = 'Stop'
$gh = 'C:\Program Files\GitHub CLI\gh.exe'; $repo = 'imnotfisy/SteamLite-Messages'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$gradle = Get-Content "$here\app\build.gradle.kts" -Raw
$ver = [regex]::Match($gradle, 'versionName = "([\d.]+)"').Groups[1].Value
if (-not $ver) { throw 'versionName not found' }
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
Push-Location $here; & .\gradlew.bat --offline assembleRelease; if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'build failed' }; Pop-Location
$apk = "$here\app\build\outputs\apk\release\app-release.apk"
$named = "$env:TEMP\SteamLite-Messages-$ver.apk"; Copy-Item $apk $named -Force

& $gh release create "v$ver" $named --repo $repo --title "SteamLite Messages v$ver" --notes $Notes --target main --latest
if ($LASTEXITCODE -ne 0) { throw 'release create failed' }
$a = (& $gh release view "v$ver" --repo $repo --json assets | ConvertFrom-Json).assets | Select-Object -First 1
if ($a.size -ne (Get-Item $named).Length) { throw 'asset size mismatch - not touching version.json' }

$sha = (Get-FileHash $named -Algorithm SHA256).Hash.ToLower()
$obj = [ordered]@{ version = $ver; downloadUrl = "https://github.com/$repo/releases/download/v$ver/SteamLite-Messages-$ver.apk"; sha256 = $sha; size = (Get-Item $named).Length; notes = $Notes }
if ($MinVersion) { $obj.minVersion = $MinVersion }
$text = ($obj | ConvertTo-Json)
$sha = ''; try { $sha = [string](& $gh api "repos/$repo/contents/version.json" | ConvertFrom-Json).sha } catch { }
$body = @{ message = "Version $ver"; content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text)); branch = 'main' }
if ($sha) { $body.sha = $sha }
$tmp = "$env:TEMP\mobver.json"; [IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
& $gh api -X PUT "repos/$repo/contents/version.json" --input $tmp | Out-Null
"Published SteamLite Messages $ver"
