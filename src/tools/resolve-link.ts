import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseLanhuUrl } from '../utils/link-parser.js'
import { ensureCookie } from '../core/auth.js'
import { chromium } from 'playwright'

export function registerResolveLinkTool(server: McpServer): void {
  server.tool(
    'lanhu_resolve_link',
    '解析蓝湖邀请/分享链接为项目参数（project_id、team_id、image_id）。也支持解析标准蓝湖 URL。',
    {
      url: z.string().describe('蓝湖 URL 或邀请链接（如 https://lanhuapp.com/link/#/invite?sid=xxx 或 https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx）'),
    },
    async ({ url }) => {
      try {
        // 优先尝试直接解析 URL
        try {
          const params = parseLanhuUrl(url)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'success',
                params,
                resolvedFrom: 'direct_parse',
              }, null, 2),
            }],
          }
        } catch {
          // 直接解析失败，尝试通过浏览器解析邀请链接
        }

        // 使用 Playwright 解析邀请链接的重定向
        const cookie = await ensureCookie()
        const cookies = cookie.split('; ').map((c) => {
          const [name, ...rest] = c.split('=')
          return { name, value: rest.join('='), domain: '.lanhuapp.com', path: '/' }
        })

        const browser = await chromium.launch({ headless: true })
        const context = await browser.newContext()
        await context.addCookies(cookies)

        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
        await page.waitForTimeout(2000)

        const finalUrl = page.url()
        await browser.close()

        const params = parseLanhuUrl(finalUrl)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              params,
              resolvedUrl: finalUrl,
              resolvedFrom: 'invite_redirect',
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `链接解析失败: ${err.message}` }],
          isError: true,
        }
      }
    },
  )
}
