// 星核纪元 · Chromium 解析（环境自检与端到端诊断共用）
//
// 解析顺序：STARCORE_CHROMIUM 显式指定 → Playwright 浏览器缓存 → 系统浏览器。
// 缓存位置按平台自动识别；PLAYWRIGHT_BROWSERS_PATH 可覆盖缓存目录。
// 不依赖任何个人环境配置。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const EXE_OVERRIDE_ENV = 'STARCORE_CHROMIUM'
export const BROWSERS_PATH_ENV = 'PLAYWRIGHT_BROWSERS_PATH'

function defaultCacheDirs() {
  const home = os.homedir()
  if (process.platform === 'darwin') return [path.join(home, 'Library', 'Caches', 'ms-playwright')]
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    return [path.join(local, 'ms-playwright')]
  }
  return [path.join(home, '.cache', 'ms-playwright')]
}

function exeCandidates(versionDir) {
  if (process.platform === 'darwin') {
    return [
      'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    ].map((rel) => path.join(versionDir, rel))
  }
  if (process.platform === 'win32') {
    return ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'].map((rel) => path.join(versionDir, rel))
  }
  return ['chrome-linux64/chrome', 'chrome-linux/chrome'].map((rel) => path.join(versionDir, rel))
}

function usableFile(p) {
  try {
    if (!fs.statSync(p).isFile()) return false
    if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

// 在给定缓存根目录中扫描 chromium-<N>，取版本号最大且可执行的一个
export function findByCacheDir(dir) {
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return null
  }
  let best = null
  for (const name of names) {
    const m = /^chromium-(\d+)$/.exec(name)
    if (!m) continue
    const version = Number(m[1])
    if (best && version <= best.version) continue
    for (const exe of exeCandidates(path.join(dir, name))) {
      if (usableFile(exe)) {
        best = { version, path: exe, source: `Playwright 缓存（${name}）` }
        break
      }
    }
  }
  return best ? { path: best.path, source: best.source } : null
}

// 系统浏览器：PATH 目录与常见安装位置
export function findSystemBrowser() {
  const names =
    process.platform === 'win32'
      ? ['chrome.exe', 'chromium.exe', 'msedge.exe']
      : ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome']
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    for (const name of names) {
      const p = path.join(dir, name)
      if (usableFile(p)) return { path: p, source: '系统浏览器' }
    }
  }
  if (process.platform === 'darwin') {
    for (const p of [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]) {
      if (usableFile(p)) return { path: p, source: '系统浏览器' }
    }
  }
  return null
}

// 返回 { path, source }；未找到返回 null。env 可注入以便测试。
export function resolveChromium(env = process.env) {
  const override = env[EXE_OVERRIDE_ENV]
  if (override) {
    return usableFile(override) ? { path: override, source: `${EXE_OVERRIDE_ENV} 环境变量` } : null
  }
  const dirs = []
  const bp = env[BROWSERS_PATH_ENV]
  if (bp && bp !== '0') dirs.push(bp)
  else dirs.push(...defaultCacheDirs())
  for (const dir of dirs) {
    const hit = findByCacheDir(dir)
    if (hit) return hit
  }
  return findSystemBrowser()
}
