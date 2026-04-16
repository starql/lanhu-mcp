import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loginAndGetCookie } from '../core/auth.js'

export function registerLoginTool(server: McpServer): void {
  server.tool(
    'lanhu_login',
    '启动浏览器登录蓝湖并保存 cookie。通常在 cookie 过期时自动调用。',
    {},
    async () => {
      try {
        await loginAndGetCookie()
        return {
          content: [{ type: 'text', text: '登录成功。Cookie 已保存到 ~/.lanhu-mcp/cookie.json' }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `登录失败: ${err.message}` }],
          isError: true,
        }
      }
    },
  )
}
