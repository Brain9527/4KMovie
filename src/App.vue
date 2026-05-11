<script setup>
import { ref, onMounted, computed } from 'vue'
import * as XLSX from 'xlsx'
import Fuse from 'fuse.js'
import { ElMessage, ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const movies = ref([])
const searchQuery = ref('')
const loading = ref(false)
const fuse = ref(null)

// 分页状态
const currentPage = ref(1)
const pageSize = ref(10)

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
    
    // 将工作表转换为 JSON 对象数组，使用 raw: true 获取原始值
    // 同时通过 cell 对象处理可能的超链接
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' })
    
    // 获取列名的辅助函数（处理可能的空格或大小写不一致）
    const getVal = (obj, targetKey) => {
      const key = Object.keys(obj).find(k => k.trim() === targetKey)
      return key ? String(obj[key]).trim() : ''
    }

    // 处理数据，确保获取完整的磁力链接
    movies.value = jsonData.filter(item => item && typeof item === 'object').map((item, index) => {
      let magnet = getVal(item, '磁力')
      const name = getVal(item, '电影名')
      
      // 识别画质逻辑
      let quality = 'Unknown'
      if (name) {
        const lowerName = name.toLowerCase()
        if (lowerName.includes('2160p') || lowerName.includes('4k')) {
          quality = '4K'
        } else if (lowerName.includes('1080p')) {
          quality = '1080P'
        } else if (lowerName.includes('720p')) {
          quality = '720P'
        } else if (lowerName.includes('remux')) {
          quality = 'REMUX'
        }
      }

      // 如果普通读取不全，尝试从单元格的超链接属性(Hyperlink)中提取
      // sheet_to_json 默认不处理超链接 Target，需要手动定位单元格
      try {
        const cellAddress = XLSX.utils.encode_cell({ r: index + 1, c: 2 }) // 假设磁力在第3列 (C列)
        const cell = worksheet[cellAddress]
        if (cell && cell.l && cell.l.Target) {
          magnet = cell.l.Target.trim()
        }
      } catch (e) {
        console.warn('Hyperlink extraction failed for row', index)
      }

      return {
        name,
        chineseName: getVal(item, '中文名'),
        magnet,
        quality,
        expanded: false // 默认不展开
      }
    })

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

// 分页后的结果
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return searchResults.value.slice(start, end)
})

// 当搜索关键词变化时，重置页码
const handleSearchChange = () => {
  currentPage.value = 1
}

const toggleExpand = (row) => {
  row.expanded = !row.expanded
}

const truncateMagnet = (text) => {
  if (!text) return ''
  if (text.length <= 60) return text
  return text.substring(0, 30) + '...' + text.substring(text.length - 20)
}

const copyMagnet = (magnet) => {
  if (!magnet) {
    ElMessage.warning('没有可用的磁力链接')
    return
  }

  // 去除可能的首尾空格
  const textToCopy = magnet.trim()

  // 优先使用 navigator.clipboard
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      ElMessage.success('磁力链接已成功复制')
    }).catch(() => {
      fallbackCopy(textToCopy)
    })
  } else {
    fallbackCopy(textToCopy)
  }
}

// 备用复制方法（兼容性更好）
const fallbackCopy = (text) => {
  const textArea = document.createElement("textarea")
  textArea.value = text
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  try {
    document.execCommand('copy')
    ElMessage.success('磁力链接已成功复制')
  } catch (err) {
    ElMessage.error('复制失败，请手动选择复制')
    console.error('Fallback copy failed:', err)
  }
  document.body.removeChild(textArea)
}

onMounted(() => {
  loadExcel()
})
</script>

<template>
  <el-config-provider :locale="zhCn">
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
            @input="handleSearchChange"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <el-table 
          v-loading="loading"
          :data="paginatedResults" 
          style="width: 100%; margin-top: 20px"
          stripe
          border
          class="movie-table"
        >
          <el-table-column prop="name" label="电影名" min-width="180" show-overflow-tooltip />
          <el-table-column label="画质" width="100">
            <template #default="scope">
              <el-tag 
                :type="scope.row.quality === '4K' ? 'danger' : (scope.row.quality === '1080P' ? 'success' : 'info')"
                effect="dark"
                size="small"
              >
                {{ scope.row.quality }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="chineseName" label="中文名" min-width="150" />
          <el-table-column label="磁力链接" min-width="300">
            <template #default="scope">
              <div class="magnet-container">
                <div 
                  :class="['magnet-wrapper', { 'is-expanded': scope.row.expanded }]"
                  @click="toggleExpand(scope.row)"
                  title="点击展开/收起完整链接"
                >
                  <el-text class="magnet-text-display">
                    <span class="protocol">magnet:</span>{{ scope.row.expanded ? scope.row.magnet.replace('magnet:', '') : truncateMagnet(scope.row.magnet).replace('magnet:', '') }}
                  </el-text>
                  <el-icon class="expand-icon">
                    <ArrowDown v-if="!scope.row.expanded" />
                    <ArrowUp v-else />
                  </el-icon>
                </div>
                <el-button 
                  type="primary" 
                  size="small" 
                  @click.stop="copyMagnet(scope.row.magnet)"
                  icon="DocumentCopy"
                  class="copy-btn"
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

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="searchResults.length"
            background
          />
        </div>
      </el-card>
    </div>
  </el-config-provider>
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
  margin-bottom: 25px;
  display: flex;
  justify-content: center;
}

.search-box .el-input {
  max-width: 600px;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.movie-table {
  border-radius: 8px;
  overflow: hidden;
}

.pagination-container {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

.magnet-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.magnet-wrapper {
  cursor: pointer;
  background-color: #fcfcfc;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.magnet-wrapper:hover {
  background-color: #f5f7fa;
  border-color: #409eff;
}

.magnet-wrapper.is-expanded {
  background-color: #f0f7ff;
  border-color: #409eff;
}

.magnet-text-display {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.4;
  color: #444;
  flex: 1;
}

.expand-icon {
  margin-top: 2px;
  color: #909399;
  font-size: 14px;
}

.copy-btn {
  align-self: flex-start;
  transition: all 0.3s;
}

.copy-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.3);
}

:deep(.el-table__header) {
  background-color: #f5f7fa;
}
</style>
