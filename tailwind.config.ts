import type { Config } from 'tailwindcss'

// 使用 CSS 变量驱动颜色，支持 alpha 通道
const withOpacity = (variable: string) => ({ opacityValue }: any) =>
  opacityValue === undefined
    ? `hsl(var(${variable}))`
    : `hsl(var(${variable}) / ${opacityValue})`

export default {
  darkMode: 'media',
  content: [
    './index.html',
    './options.html',
    './sidepanel.html',
    './blocked.html',
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // 文本/基础色板（通过 CSS 变量定义实际值）
        'text-000': withOpacity('--text-000'),
        'text-100': withOpacity('--text-100'),
        'text-200': withOpacity('--text-200'),
        'text-300': withOpacity('--text-300'),
        'text-400': withOpacity('--text-400'),

        'bg-000': withOpacity('--bg-000'),
        'bg-100': withOpacity('--bg-100'),
        'bg-200': withOpacity('--bg-200'),
        'bg-300': withOpacity('--bg-300'),
        'bg-400': withOpacity('--bg-400'),

        'border-100': withOpacity('--border-100'),
        'border-200': withOpacity('--border-200'),
        'border-300': withOpacity('--border-300'),
        'border-400': withOpacity('--border-400'),

        // 语义色板
        'accent-main-100': withOpacity('--accent-main-100'),
        'accent-main-200': withOpacity('--accent-main-200'),
        'accent-main-900': withOpacity('--accent-main-900'),
        'accent-secondary-200': withOpacity('--accent-secondary-200'),

        'danger-000': withOpacity('--danger-000'),
        'danger-100': withOpacity('--danger-100'),
        'danger-200': withOpacity('--danger-200'),
        'danger-900': withOpacity('--danger-900'),

        'oncolor-100': withOpacity('--oncolor-100'),
      },
      fontFamily: {
        // 对齐原始产物：通过 CSS 变量驱动字体家族
        // .font-heading 应使用 var(--font-ui-serif)
        heading: ['var(--font-ui-serif)'],
        // 代码字体与 Claude 回复字体也走变量，便于主题/平台统一
        code: ['var(--font-mono)'],
        styrene: ['"Styrene B LC"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'claude-response': ['var(--font-claude-response)'],
      },
    },
  },
  plugins: [],
} satisfies Config
