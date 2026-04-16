#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerLoginTool } from './tools/login.js'
import { registerResolveLinkTool } from './tools/resolve-link.js'
import { registerGetDesignTool } from './tools/get-design.js'
import { registerGetScreenshotTool } from './tools/get-screenshot.js'
import { registerDownloadSlicesTool } from './tools/download-slices.js'

const server = new McpServer(
  { name: 'lanhu-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

// 注册所有工具
registerLoginTool(server)
registerResolveLinkTool(server)
registerGetDesignTool(server)
registerGetScreenshotTool(server)
registerDownloadSlicesTool(server)

// 启动 stdio 传输
const transport = new StdioServerTransport()
server.connect(transport)
