param([string]$Version = '1.0.0')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$') { throw 'Invalid version.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$compilerCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$compiler) { throw '.NET Framework 4.x C# compiler was not found.' }
$artifacts = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$buildFolder = Join-Path $artifacts ('build-' + [Guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $buildFolder '赛博拼豆'
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'bead-room') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'bead-room\dist') -Destination (Join-Path $packageRoot 'bead-room') -Recurse
$exe = Join-Path $packageRoot '启动赛博拼豆.exe'
$launcherSource = Join-Path $projectRoot 'bead-room\launcher\Launcher.cs'
$icon = Join-Path $projectRoot 'bead-room\launcher\bead.ico'
& $compiler /nologo /target:winexe /optimize+ /platform:anycpu "/out:$exe" "/win32icon:$icon" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll $launcherSource
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $exe)) { throw 'Launcher build failed.' }
$instructions = @'
赛博拼豆 · Windows 免安装版

1. 先完整解压压缩包。
2. 双击“启动赛博拼豆.exe”。
3. 默认浏览器会打开游戏；下次仍双击这个文件进入。

请保留启动器旁边的 bead-room 文件夹。不要只复制 EXE，也不要在压缩包中直接运行。
适用 Windows 10 / 11，推荐 Edge 或 Chrome。不需要安装 Node.js 或 Python。
草稿、图纸与收藏保存在当前电脑的浏览器本地，请不要清除该网站的数据。
如端口 4173 被旧版拼豆后台占用，请先通过托盘菜单退出旧后台再运行。

项目主页：https://github.com/wangyvjie2/saibo-pindou
版本下载：https://github.com/wangyvjie2/saibo-pindou/releases
更详细的操作说明请查看项目主页。
'@
Set-Content -LiteralPath (Join-Path $packageRoot '使用说明.txt') -Value $instructions -Encoding UTF8
Copy-Item -LiteralPath (Join-Path $projectRoot 'THIRD_PARTY_NOTICES.md') -Destination (Join-Path $packageRoot 'THIRD_PARTY_NOTICES.md')
$zip = Join-Path $artifacts ("SaiboPindou-v$Version-Windows.zip")
Compress-Archive -LiteralPath $packageRoot -DestinationPath $zip -CompressionLevel Optimal -Force
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $artifacts 'SHA256SUMS.txt') -Value ($hash + '  ' + [IO.Path]::GetFileName($zip)) -Encoding ASCII
Write-Output "PACKAGE=$zip"
Write-Output "APPLICATION=$exe"
Write-Output "SHA256=$hash"
