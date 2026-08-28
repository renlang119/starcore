/**
 * Application version — single source of truth.
 *
 * The value is read directly from package.json via Vite's `?raw` import,
 * which works identically in dev and production builds. Do not hardcode
 * the version string elsewhere; import APP_VERSION from this module instead.
 */
import pkgRaw from '../package.json?raw'

interface PkgMeta {
  version: string
}

const pkg: PkgMeta = JSON.parse(pkgRaw)

export const APP_VERSION: string = pkg.version
