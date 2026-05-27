<template>
  <div class="file-uploader">
    <a-alert v-if="validationError" type="error" :closable="true" @close="validationError = ''" style="margin-bottom: 8px">
      {{ validationError }}
    </a-alert>
    <a-upload
      draggable
      :auto-upload="false"
      :limit="10"
      :accept="acceptedExtensions"
      :tip="`支持格式：${acceptedExtensions}，单文件最大 50MB`"
      @change="onFileChange"
    >
      <template #upload-button>
        <a-button type="dashed" long :loading="store.uploading">
          <template #icon><icon-upload /></template>
          点击或拖拽上传文件
        </a-button>
      </template>
    </a-upload>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { STEP_META_MAP, type PipelineStepType } from '@types/testflow-pipeline'
import { useTestFlowPipelineStore } from '@store/useTestFlowPipelineStore'
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE } from '@utils/constants'

const props = defineProps<{
  stepType: PipelineStepType
  projectId: string
}>()

const emit = defineEmits<{
  uploaded: []
}>()

const store = useTestFlowPipelineStore()
const meta = computed(() => STEP_META_MAP[props.stepType])
const acceptedExtensions = computed(() => SUPPORTED_FILE_TYPES.join(','))
const validationError = ref('')

const ALLOWED_EXTENSIONS_SET = new Set(SUPPORTED_FILE_TYPES)

async function onFileChange(fileList: { file: File }[]) {
  if (!fileList.length) return
  validationError.value = ''

  const validPaths: string[] = []
  const errors: string[] = []

  for (const f of fileList) {
    const file = f.file
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
    if (!ALLOWED_EXTENSIONS_SET.has(ext)) {
      errors.push(`${file.name}: 不支持的格式（${ext}），仅支持 ${acceptedExtensions.value}`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: 文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 50MB`)
      continue
    }
    const path = (file as File & { path?: string }).path
    if (path) validPaths.push(path)
  }

  if (errors.length) {
    validationError.value = errors.join('；')
  }

  if (!validPaths.length) return
  await store.uploadFiles(props.projectId, meta.value.outputDir, validPaths)
  await store.fetchPipelineState(props.projectId)
  emit('uploaded')
}
</script>

<style scoped>
.file-uploader { padding: 8px 0; }
</style>
