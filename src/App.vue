<script setup>
import { ref, onMounted, computed } from 'vue'
import * as XLSX from 'xlsx'
import Fuse from 'fuse.js'
import { ElMessage } from 'element-plus'

const movies = ref([])
const searchQuery = ref('')
const loading = ref(false)
const fuse = ref(null)

// 加载 Excel 文件
const loadExcel = async () => {
  loading.value = true
  try {
    // 使用相对路径加载，避免 base 路径配置错误导致的问题
    const response = await fetch('data/movies.xls')
    const arrayBuffer = await response.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)
    const workbook = XLSX.read(data, { type: 'array' })
    
    // 假设第一个工作表是目标表
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    
    // 将工作表转换为 JSON 对象数组
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    
    // 格式化数据，确保字段匹配：电影名, 中文名, 磁力
    movies.value = jsonData.map(item => ({
      name: item['电影名'] || '',
      chineseName: item['中文名'] || '',
      magnet: item['磁力'] || ''
    }))

    // 初始化 Fuse.js 进行模糊搜索
    fuse.value = new Fuse(movies.value, {
      keys: ['name', 'chineseName'],
      threshold: 0.4, // 模糊匹配阈值
    })

    console.log('Loaded movies:', movies.value.length)
  } catch (error) {
    console.error('Error loading excel:', error)
    ElMessage.error('无法加载电影数据文件，请确保 public/data/movies.xls 存在。')
  } finally {
    loading.value = false
  }
}

// 搜索结果
const searchResults = computed(() => {
  if (!searchQuery.value) {
    return movies.value
  }
  if (!fuse.value) return []
  return fuse.value.search(searchQuery.value).map(result => result.item)
})

const copyMagnet = (magnet) => {
  if (!magnet) {
    ElMessage.warning('没有可用的磁力链接')
    return
  }
  navigator.clipboard.writeText(magnet).then(() => {
    ElMessage.success('磁力链接已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

onMounted(() => {
  loadExcel()
})
</script>

<template>
  <div class="container">
    <el-card class="search-card">
      <template #header>
        <div class="header">
          <h2>🎬 4K 电影磁力搜索</h2>
          <p class="subtitle">根据电影名或中文名快速搜索磁力链接</p>
        </div>
      </template>

      <div class="search-box">
        <el-input
          v-model="searchQuery"
          placeholder="请输入电影名称或中文名..."
          clearable
          size="large"
          :prefix-icon="'Search'"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <el-table 
        v-loading="loading"
        :data="searchResults" 
        style="width: 100%; margin-top: 20px"
        stripe
        border
      >
        <el-table-column prop="name" label="电影名" min-width="150" />
        <el-table-column prop="chineseName" label="中文名" min-width="150" />
        <el-table-column label="磁力链接" min-width="200">
          <template #default="scope">
            <div class="magnet-cell">
              <el-text class="magnet-text" truncated>{{ scope.row.magnet }}</el-text>
              <el-button 
                type="primary" 
                size="small" 
                @click="copyMagnet(scope.row.magnet)"
                link
              >
                复制
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有找到相关电影" />
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.container {
  max-width: 1000px;
  margin: 40px auto;
  padding: 0 20px;
}

.search-card {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.header {
  text-align: center;
}

.header h2 {
  margin: 0;
  color: #409eff;
}

.subtitle {
  color: #909399;
  font-size: 14px;
  margin-top: 8px;
}

.search-box {
  margin-bottom: 20px;
}

.magnet-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.magnet-text {
  max-width: 150px;
  font-family: monospace;
  font-size: 12px;
}

:deep(.el-table__header) {
  background-color: #f5f7fa;
}
</style>
