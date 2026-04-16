import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseLanhuUrl } from '../utils/link-parser.js'
import { LanhuApiClient } from '../core/api.js'
import { parseSketchJson } from '../core/parser.js'

const apiClient = new LanhuApiClient()

export function registerGetDesignTool(server: McpServer): void {
  server.tool(
    'lanhu_get_design',
    '获取蓝湖设计稿的清洗后结构化数据。返回精简图层树，包含 UnoCSS class、元素类型（container/text/image/shape/icon）和图片引用。用作生成前端代码的主要数据源。',
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

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              sliceScale,
              isFigma,
              nodes: cleanedTree,
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
