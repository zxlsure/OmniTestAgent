export interface McpConfig { id: string; name: string; transport_type: string; url: string | null; command: string | null; args: string | null; is_active: number }
export interface McpTool { name: string; description: string; inputSchema: any }
