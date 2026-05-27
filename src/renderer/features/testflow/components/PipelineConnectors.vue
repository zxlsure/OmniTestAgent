<template>
  <svg class="pipeline-connectors" :width="width" :height="height" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#c9cdd4" />
      </marker>
      <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#165dff" />
      </marker>
    </defs>
    <path
      v-for="(conn, idx) in connections"
      :key="idx"
      :d="conn.path"
      fill="none"
      :stroke="conn.isRunning ? '#165dff' : '#c9cdd4'"
      stroke-width="2"
      :marker-end="conn.isRunning ? 'url(#arrowhead-active)' : 'url(#arrowhead)'"
      :class="{ 'connector--running': conn.isRunning }"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { StepStatus } from '@types/testflow-pipeline'
import type { PipelineStepState } from '@types/testflow-pipeline'

interface Position { x: number; y: number; width: number; height: number }

const props = defineProps<{
  positions: Record<string, Position>
  width: number
  height: number
  edges: Array<{ from: string; to: string }>
  stepStates?: Record<string, PipelineStepState>
}>()

interface Connection { path: string; isRunning: boolean }

function isEdgeRunning(from: string, to: string): boolean {
  if (!props.stepStates) return false
  const fromStep = props.stepStates[from]
  const toStep = props.stepStates[to]
  return fromStep?.status === StepStatus.COMPLETED && toStep?.status === StepStatus.RUNNING
}

const connections = computed<Connection[]>(() =>
  props.edges.map(edge => {
    const from = props.positions[edge.from]
    const to = props.positions[edge.to]
    if (!from || !to) return { path: '', isRunning: false }

    const fromCx = from.x + from.width / 2
    const fromCy = from.y + from.height / 2
    const toCx = to.x + to.width / 2
    const toCy = to.y + to.height / 2

    if (Math.abs(fromCy - toCy) < 5) {
      const sx = from.x + from.width
      const sy = fromCy
      const ex = to.x
      const ey = toCy
      const mx = (sx + ex) / 2
      return { path: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`, isRunning: isEdgeRunning(edge.from, edge.to) }
    }

    if (fromCy < toCy) {
      const sx = fromCx
      const sy = from.y + from.height
      const ex = toCx
      const ey = to.y
      const my = (sy + ey) / 2
      return { path: `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`, isRunning: isEdgeRunning(edge.from, edge.to) }
    }

    const sx = fromCx
    const sy = from.y
    const ex = toCx
    const ey = to.y + to.height
    const my = (sy + ey) / 2
    return { path: `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`, isRunning: isEdgeRunning(edge.from, edge.to) }
  }).filter(c => c.path !== '')
)
</script>

<style scoped>
.pipeline-connectors { position: absolute; top: 0; left: 0; pointer-events: none; }
.connector--running {
  stroke-dasharray: 8 4;
  animation: dash-flow 0.6s linear infinite;
}
@keyframes dash-flow {
  from { stroke-dashoffset: 12; }
  to { stroke-dashoffset: 0; }
}
</style>
