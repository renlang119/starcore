/**
 * app-stars.ts — AppShell 背景星点配置表。
 *
 * P2-2 星点闪烁：以数据驱动的 6 枚背景星点（替代早期 6 个静态 span）。
 * 数值与挂载顺序保持不变；渲染侧按本表逐项绑定 CSS 变量。
 */
export const APP_STARS = [
  {
    top: '18%',
    left: '12%',
    background: 'rgba(255,255,255,.6)',
    size: '2px',
    duration: '3.2s',
    delay: '0s',
  },
  {
    top: '12%',
    left: '78%',
    background: 'color-mix(in srgb, var(--color-core) 50%, transparent)',
    size: '2px',
    duration: '2.8s',
    delay: '-0.7s',
  },
  {
    top: '65%',
    left: '35%',
    background: 'rgba(255,255,255,.4)',
    size: '2px',
    duration: '3.5s',
    delay: '-1.4s',
  },
  {
    top: '78%',
    left: '88%',
    background: 'color-mix(in srgb, var(--color-plasma) 40%, transparent)',
    size: '2px',
    duration: '3.0s',
    delay: '-2.1s',
  },
  {
    top: '88%',
    left: '22%',
    background: 'rgba(255,255,255,.3)',
    size: '2px',
    duration: '2.5s',
    delay: '-0.5s',
  },
  {
    top: '40%',
    left: '60%',
    background: 'color-mix(in srgb, var(--color-core) 30%, transparent)',
    size: '3px',
    duration: '4.0s',
    delay: '-1.8s',
  },
] as const
