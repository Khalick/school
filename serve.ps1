# Local preview server for the Olive site (no Node/Python needed).
# Behaves like the Vercel deployment: clean URLs (/about serves about.html,
# /about.html redirects to /about) and the site's own 404 page.
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 5173]
param(
  [int]$Port = 5173,
  [string]$Root = (Join-Path $PSScriptRoot 'site')
)

$Root = (Resolve-Path $Root).Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'; '.json' = 'application/json'; '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $urlPath = [Uri]::UnescapeDataString($req.Url.AbsolutePath)

    # /about.html -> /about, like Vercel's cleanUrls
    if ($urlPath -match '^/(.+)\.html$' -and $urlPath -ne '/404.html') {
      $target = if ($Matches[1] -eq 'index') { '/' } else { '/' + $Matches[1] }
      $res.StatusCode = 308
      $res.RedirectLocation = $target + $req.Url.Query
      $res.Close()
      Write-Host ('308 {0} -> {1}' -f $urlPath, $target)
      continue
    }

    $path = $urlPath.TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $Root $path))
    if (-not [IO.Path]::HasExtension($file)) { $file = "$file.html" }

    if (-not $file.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
      $res.StatusCode = 404
      $notFound = Join-Path $Root '404.html'
      if (Test-Path -LiteralPath $notFound) {
        $res.ContentType = 'text/html; charset=utf-8'
        $bytes = [IO.File]::ReadAllBytes($notFound)
      } else {
        $res.ContentType = 'text/plain; charset=utf-8'
        $bytes = [Text.Encoding]::UTF8.GetBytes('404 Not found')
      }
    } else {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.Headers['Cache-Control'] = 'no-store'
      $bytes = [IO.File]::ReadAllBytes($file)
    }

    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
    Write-Host ('{0} {1} {2}' -f $res.StatusCode, $req.HttpMethod, $urlPath)
  }
} finally {
  $listener.Stop()
}
