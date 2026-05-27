import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@components/layout/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@features/dashboard/views/DashboardView.vue'),
        meta: { title: '首页', icon: 'icon-dashboard', group: 'business' }
      },
      {
        path: 'project',
        name: 'project',
        component: () => import('@features/project/views/ProjectManagementView.vue'),
        meta: { title: '项目管理', icon: 'icon-apps', group: 'business' }
      },
      {
        path: 'chat',
        name: 'chat',
        component: () => import('@features/chat/views/ChatView.vue'),
        meta: { title: 'AI对话', icon: 'icon-message', group: 'business' }
      },
      {
        path: 'testflow',
        name: 'testflow',
        component: () => import('@features/testflow/views/TestFlowView.vue'),
        meta: { title: '测试设计', icon: 'icon-thunderbolt', group: 'business' }
      },
      {
        path: 'execution',
        name: 'execution',
        component: () => import('@features/execution/views/TestExecutionView.vue'),
        meta: { title: '测试执行', icon: 'icon-play-circle', group: 'business' }
      },
      {
        path: 'knowledge',
        name: 'knowledge',
        component: () => import('@features/knowledge/views/KnowledgeView.vue'),
        meta: { title: '知识库管理', icon: 'icon-book', group: 'business' }
      },
      {
        path: 'llm-config',
        name: 'llm-config',
        component: () => import('@features/llm-config/views/LlmConfigView.vue'),
        meta: { title: 'LLM配置', icon: 'icon-bulb', group: 'system' }
      },
      {
        path: 'mcp-config',
        name: 'mcp-config',
        component: () => import('@features/mcp-config/views/McpConfigView.vue'),
        meta: { title: 'MCP配置', icon: 'icon-link', group: 'system' }
      },
      {
        path: 'skills',
        name: 'skills',
        component: () => import('@features/skills/views/SkillsView.vue'),
        meta: { title: 'Skills管理', icon: 'icon-mind-mapping', group: 'system' }
      },
      {
        path: 'channels',
        name: 'channels',
        component: () => import('@features/channels/views/ChannelsView.vue'),
        meta: { title: 'Channels配置', icon: 'icon-notification', group: 'system' }
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@features/dashboard/views/DashboardView.vue'),
        meta: { title: '404' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
