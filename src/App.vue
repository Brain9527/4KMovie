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
const qualityFilter = ref('全部') // 新增画质筛选状态

// 分页状态
const currentPage = ref(1)
const pageSize = ref(10)
const displayLimitMobile = ref(10) // 移动端初始加载数量
const noMoreMobile = computed(() => displayLimitMobile.value >= searchResults.value.length)

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
      let chineseName = getVal(item, '中文名')
      const name = getVal(item, '电影名')
      
      // --- 增强型 Fallback 逻辑 ---
      // 如果“磁力”为空，尝试根据单元格位置直接取值 (C列=中文名, D列=磁力)
      try {
        const rowIdx = index + 1 // 跳过标题行
        
        // 尝试从 D 列 (索引3) 获取磁力
        if (!magnet || !magnet.startsWith('magnet:')) {
          const magnetCellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 3 })
          const magnetCell = worksheet[magnetCellAddr]
          if (magnetCell) {
            // 优先取超链接目标，其次取单元格显示值
            magnet = (magnetCell.l && magnetCell.l.Target) ? magnetCell.l.Target : String(magnetCell.v || '')
          }
        }

        // 尝试从 C 列 (索引2) 获取中文名
        if (!chineseName) {
          const chineseCellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 2 })
          const chineseCell = worksheet[chineseCellAddr]
          if (chineseCell) {
            chineseName = String(chineseCell.v || '')
          }
        }

        // 如果还是没拿到磁力，最后尝试检查一下当前行的所有单元格，看哪个像磁力链接
        if (!magnet || !magnet.startsWith('magnet:')) {
          for (let c = 0; c < 10; c++) { // 检查前10列
            const addr = XLSX.utils.encode_cell({ r: rowIdx, c })
            const cell = worksheet[addr]
            if (cell && cell.v && String(cell.v).startsWith('magnet:')) {
              magnet = String(cell.v)
              break
            }
          }
        }
      } catch (e) {
        console.warn('Fallback extraction failed for row', index, e)
      }

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
        chineseName,
        magnet: magnet.trim(),
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
  let results = movies.value

  // 1. 先进行模糊搜索
  if (searchQuery.value && fuse.value) {
    results = fuse.value.search(searchQuery.value).map(result => result.item)
  }

  // 2. 再进行画质筛选
  if (qualityFilter.value !== '全部') {
    if (qualityFilter.value === '其他') {
      results = results.filter(m => m.quality !== '4K' && m.quality !== '1080P')
    } else {
      results = results.filter(m => m.quality === qualityFilter.value)
    }
  }

  return results
})

// 分页后的结果 (PC端使用)
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return searchResults.value.slice(start, end)
})

// 移动端滚动加载的结果
const mobileResults = computed(() => {
  return searchResults.value.slice(0, displayLimitMobile.value)
})

// 站外搜索跳转 (直接跳转)
const goToExternalSearch = () => {
  window.open('http://buerchen.top/daily', '_blank')
}

// 当搜索关键词变化时，重置页码和移动端加载限制
const handleSearchChange = () => {
  currentPage.value = 1
  displayLimitMobile.value = 10
}

// 移动端加载更多
const loadMoreMobile = () => {
  if (loading.value || noMoreMobile.value) return
  displayLimitMobile.value += 10
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
          @keyup.enter="handleSearchChange"
          class="internal-search"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #append>
            <el-button @click="handleSearchChange">
              搜索站内
            </el-button>
          </template>
        </el-input>
        
        <el-button 
          type="warning" 
          size="large" 
          @click="goToExternalSearch" 
          icon="Share"
          class="external-btn"
        >
          站外搜索
        </el-button>
      </div>

        <div class="filter-box">
          <el-radio-group v-model="qualityFilter" @change="handleSearchChange" size="small">
            <el-radio-button label="全部" value="全部" />
            <el-radio-button label="4K" value="4K" />
            <el-radio-button label="1080P" value="1080P" />
            <el-radio-button label="其他" value="其他" />
          </el-radio-group>
        </div>

        <!-- PC端 表格布局 (大屏幕显示) -->
        <div class="pc-layout">
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
        </div>

        <!-- 移动端 卡片布局 (手机/iPad显示) -->
        <div 
          v-loading="loading" 
          class="mobile-layout movie-list"
          v-infinite-scroll="loadMoreMobile"
          :infinite-scroll-disabled="noMoreMobile || loading"
          :infinite-scroll-distance="20"
        >
          <div v-for="(movie, index) in mobileResults" :key="index" class="movie-card-item">
            <div class="card-header">
              <div class="title-section">
                <h3 class="movie-title">{{ movie.chineseName || '未知中文名' }}</h3>
                <span class="movie-name-en">{{ movie.name }}</span>
              </div>
              <el-tag 
                :type="movie.quality === '4K' ? 'danger' : (movie.quality === '1080P' ? 'success' : 'info')"
                effect="dark"
                size="small"
                class="quality-tag"
              >
                {{ movie.quality }}
              </el-tag>
            </div>

            <div class="card-content">
              <div 
                :class="['magnet-wrapper', { 'is-expanded': movie.expanded }]"
                @click="toggleExpand(movie)"
              >
                <div class="magnet-header">
                  <span class="magnet-label">磁力链接</span>
                  <el-icon class="expand-icon">
                    <ArrowDown v-if="!movie.expanded" />
                    <ArrowUp v-else />
                  </el-icon>
                </div>
                <el-text class="magnet-text-display">
                  <span class="protocol">magnet:</span>{{ movie.expanded ? movie.magnet.replace('magnet:', '') : truncateMagnet(movie.magnet).replace('magnet:', '') }}
                </el-text>
              </div>
            </div>

            <div class="card-footer">
              <el-button 
                type="primary" 
                size="default" 
                @click.stop="copyMagnet(movie.magnet)"
                icon="DocumentCopy"
                class="mobile-copy-btn"
                round
              >
                复制完整链接
              </el-button>
            </div>
          </div>

          <div v-if="mobileResults.length > 0" class="infinite-status">
            <p v-if="loading">加载中...</p>
            <p v-else-if="noMoreMobile" class="no-more-text">没有更多电影了</p>
            <p v-else class="scroll-tip">继续下滑加载更多</p>
          </div>

          <el-empty v-if="mobileResults.length === 0" description="没有找到相关电影" />
        </div>
      </el-card>
    </div>
  </el-config-provider>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 20px auto;
  padding: 0 10px;
}

.search-card {
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: none;
}

:deep(.el-card__header) {
  padding: 15px 20px;
  border-bottom: 1px solid #f0f0f0;
}

:deep(.el-card__body) {
  padding: 15px;
}

.header h2 {
  margin: 0;
  color: #409eff;
  font-size: 1.5rem;
}

.subtitle {
  color: #909399;
  font-size: 12px;
  margin-top: 5px;
}

.search-box {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.internal-search {
  width: 100%;
  max-width: none;
}

.external-btn {
  width: 100%;
  margin-left: 0 !important;
}

/* 移动端列表及无限滚动样式 */
.mobile-layout.movie-list {
  margin-top: 10px;
  height: calc(100vh - 280px); /* 减去搜索框和头部的高度 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* iOS 滚动优化 */
}

.infinite-status {
  text-align: center;
  padding: 20px 0;
  color: #909399;
  font-size: 13px;
}

.no-more-text {
  position: relative;
}

.no-more-text::before, .no-more-text::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 30px;
  height: 1px;
  background: #e4e7ed;
}

.no-more-text::before { left: 20%; }
.no-more-text::after { right: 20%; }

.movie-card-item {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.movie-card-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-color: #409eff44;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.title-section {
  flex: 1;
  padding-right: 10px;
}

.movie-title {
  margin: 0;
  font-size: 16px;
  color: #303133;
  line-height: 1.4;
}

.movie-name-en {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  word-break: break-all;
}

.quality-tag {
  flex-shrink: 0;
}

.card-content {
  margin-bottom: 15px;
}

.magnet-wrapper {
  cursor: pointer;
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #eee;
  transition: all 0.2s;
}

.magnet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.magnet-label {
  font-size: 12px;
  font-weight: bold;
  color: #606266;
}

.magnet-wrapper:hover {
  background-color: #f0f7ff;
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
  line-height: 1.5;
  color: #444;
  display: block;
}

.protocol {
  color: #409eff;
  font-weight: bold;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.mobile-copy-btn {
  width: 100%;
}

.filter-box {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  overflow-x: auto;
  padding-bottom: 5px;
}

/* 布局显隐控制 */
.pc-layout {
  display: none;
}

.mobile-layout {
  display: block;
}

/* 响应式媒体查询 */
@media (min-width: 992px) {
  .pc-layout {
    display: block;
  }
  
  .mobile-layout {
    display: none;
  }

  .container {
    padding: 0 20px;
    margin: 40px auto;
    max-width: 1000px; /* PC端调宽一点 */
  }
  
  .search-box {
    flex-direction: row;
    gap: 15px;
  }
  
  .internal-search {
    flex: 1;
  }
  
  .external-btn {
    width: auto;
  }
  
  .movie-title {
    font-size: 18px;
  }
  
  .mobile-copy-btn {
    width: auto;
  }
}
</style>
