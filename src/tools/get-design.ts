import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseLanhuUrl } from '../utils/link-parser.js'
import { LanhuApiClient } from '../core/api.js'
import { parseSketchJson } from '../core/parser.js'

const apiClient = new LanhuApiClient()

export function registerGetDesignTool(server: McpServer): void {
  server.tool(
    'lanhu_get_design',
    '获取蓝湖设计稿的清洗后结构化数据，作为开发参考资料。返回精简图层树，包含 UnoCSS class、元素类型和图片引用。获取后应先展示给用户确认，再进行代码编写。',
    {
      url: z.string().describe('蓝湖 URL，包含 tid 和 pid 参数。如 https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx&image_id=xxx'),
      image_id: z.string().optional().describe('设计图 ID。如果 URL 中没有，可从 lanhu_resolve_link 或设计图列表获取。'),
    },
    async ({ url, image_id }) => {
      try {
        const params = parseLanhuUrl(url)
        const targetImageId = image_id ?? params.imageId

        // 如果没有 image_id，返回设计图列表供用户选择
        if (!targetImageId) {
          const list = await apiClient.getDesigns(params.projectId, params.teamId)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'need_image_id',
                message: '未指定 image_id。以下是可用的设计图列表，请带上 image_id 参数重新调用。',
                projectName: list.projectName,
                designs: list.designs.map((d, i) => ({
                  index: i + 1,
                  id: d.id,
                  name: d.name,
                  size: `${d.width}x${d.height}`,
                })),
              }, null, 2),
            }],
          }
        }

        // 获取设计稿 JSON
        const { sketchData, sliceScale, isFigma } = await apiClient.getDesignJson(
          params.projectId, targetImageId, params.teamId,
        )

        // 解析并清洗
        const cleanedTree = parseSketchJson(sketchData, { isFigma, sliceScale })

        // 落盘保存到 page/lanhu-mcp-assets/designs/
        const designsDir = path.join(process.cwd(), 'page', 'lanhu-mcp-assets', 'designs')
        if (!fs.existsSync(designsDir)) {
          fs.mkdirSync(designsDir, { recursive: true })
        }
        const jsonFileName = `${targetImageId}.json`
        const jsonFilePath = path.join(designsDir, jsonFileName)
        const resultData = { sliceScale, isFigma, nodes: cleanedTree }
        fs.writeFileSync(jsonFilePath, JSON.stringify(resultData, null, 2), 'utf-8')

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              savedTo: jsonFilePath,
              ...resultData,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `获取设计稿失败: ${err.message}` }],
          isError: true,
        }
      }
    },
  )
}
