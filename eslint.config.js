import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default [
  // 忽略目录
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // 基础 JS 推荐规则
  js.configs.recommended,

  // TypeScript 推荐规则
  ...tseslint.configs.recommended,

  // Vue 推荐规则
  ...pluginVue.configs['flat/recommended'],

  // Prettier 兼容（关闭与 Prettier 冲突的规则）
  prettierConfig,

  // 项目特定配置
  {
    files: ['src/**/*.ts', 'src/**/*.vue'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // 放宽过于严格的规则，适配现有代码风格
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-namespace': 'off', // decimal.ts 需要 namespace 合并类型
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      'no-prototype-builtins': 'off',
    },
  },

  // 测试文件配置
  {
    files: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // 测试 stub 用 defineComponent 定义迷你组件属正常做法，不适用单文件组件限制
      'vue/one-component-per-file': 'off',
    },
  },

  // 配置文件
  {
    files: ['*.config.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
]
