/**
 * Application version — single source of truth.
 *
 * The value is read directly from package.json via Vite's `?raw` import,
 * which works identically in dev and production builds. Do not hardcode
 * the version string elsewhere; import APP_VERSION from this module instead.
 *
 * 显示口径：去掉末尾的 .0（package.json 的 "0.87.0" 显示为 v0.87；
 * 非零尾版本如 0.86.1 原样显示）。存储层始终以完整 semver 为准。
 */
import pkgRaw from '../package.json?raw'

interface PkgMeta {
  version: string
}

const pkg: PkgMeta = JSON.parse(pkgRaw)

/** 显示版本串：去末尾 .0（0.87.0 → 0.87；0.86.1 不变） */
export const APP_VERSION: string = pkg.version.replace(/\.0$/, '')
