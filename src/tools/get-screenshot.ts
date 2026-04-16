import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseLanhuUrl } from '../utils/link-parser.js'
import { LanhuApiClient } from '../core/api.js'
import axios from 'axios'

const apiClient = new LanhuApiClient()

export function registerGetScreenshotTool(server: McpServer): void {
  server.tool(
    'lanhu_get_screenshot',
    '获取蓝湖设计稿预览图，用于视觉参考。通过 API 直接下载设计稿渲染图。应展示给用户确认设计意图后再编写代码。',
    {
      url: z.string().describe('蓝湖 URL，包含 tid、pid 和 image_id'),
      image_id: z.string().optional().describe('设计图 ID，如果 URL 中没有'),
      output_path: z.string().optional().describe('截图保存路径。默认保存到 page/lanhu-mcp-assets/screenshots/'),
    },
    async ({ url, image_id, output_path }) => {
      try {
        const params = parseLanhuUrl(url)
        const targetImageId = image_id ?? params.imageId

        if (!targetImageId) {
          return {
            content: [{ type: 'text', text: '错误: 需要 image_id。请先使用 lanhu_get_design 获取设计图列表。' }],
            isError: true,
          }
        }

        // 通过 API 获取设计稿预览图 URL
        const { previewUrl } = await apiClient.getDesignJson(
          params.projectId, targetImageId, params.teamId,
        )

        if (!previewUrl) {
          return {
            content: [{ type: 'text', text: '该设计稿没有可用的预览图 URL。' }],
            isError: true,
          }
        }

        // 确定保存路径
        const screenshotDir = path.join(process.cwd(), 'page', 'lanhu-mcp-assets', 'screenshots')
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true })
        }

        // 从 URL 中推断扩展名
        const ext = previewUrl.match(/\.(png|jpg|jpeg|webp)/i)?.[1] ?? 'png'
        const fileName = `${targetImageId}.${ext}`
        const savePath = output_path ?? path.join(screenshotDir, fileName)

        // 下载预览图
        const imgRes = await axios.get(previewUrl, {
          responseType: 'arraybuffer',
          timeout: 30_000,
        })
        fs.writeFileSync(savePath, Buffer.from(imgRes.data))

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              screenshotPath: savePath,
              previewUrl,
              message: `设计稿预览图已保存到: ${savePath}`,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `获取预览图失败: ${err.message}` }],
          isError: true,
        }
      }
    },
  )
}
