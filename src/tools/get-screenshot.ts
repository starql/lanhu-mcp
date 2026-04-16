import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseLanhuUrl } from '../utils/link-parser.js'
import { ensureCookie } from '../core/auth.js'
import { chromium } from 'playwright'

export function registerGetScreenshotTool(server: McpServer): void {
  server.tool(
    'lanhu_get_screenshot',
    '对蓝湖设计稿页面截图。返回截图文件路径，用于视觉参考。配合 lanhu_get_design 使用可全面理解设计。',
    {
      url: z.string().describe('要截图的蓝湖 URL'),
      output_path: z.string().optional().describe('截图保存路径。默认保存到 ~/.lanhu-mcp/screenshots/<imageId>.png'),
    },
    async ({ url, output_path }) => {
      try {
        const params = parseLanhuUrl(url)
        const cookie = await ensureCookie()

        // 将 cookie 字符串解析为 Playwright 格式
        const cookies = cookie.split('; ').map((c) => {
          const [name, ...rest] = c.split('=')
          return { name, value: rest.join('='), domain: '.lanhuapp.com', path: '/' }
        })

        const browser = await chromium.launch({ headless: true })
        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
        await context.addCookies(cookies)

        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
        await page.waitForTimeout(3000) // 等待设计稿渲染完成

        // 确定保存路径
        const screenshotDir = path.join(os.homedir(), '.lanhu-mcp', 'screenshots')
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true })
        }
        const fileName = `${params.imageId ?? params.projectId}-${Date.now()}.png`
        const savePath = output_path ?? path.join(screenshotDir, fileName)

        await page.screenshot({ path: savePath, fullPage: true })
        await browser.close()

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              screenshotPath: savePath,
              message: `截图已保存到: ${savePath}`,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `截图失败: ${err.message}` }],
          isError: true,
        }
      }
    },
  )
}
