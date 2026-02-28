<template>
   <teleport to="body">
      <transition name="panel-slide">
         <div v-if="visible" class="annotation-panel">
            <div class="panel-header">
               <span class="panel-title">标注</span>
               <ElIcon class="close-icon" @click="handleClose">
                  <Close />
               </ElIcon>
            </div>

            <div class="panel-body">
               <!-- 图形选择 -->
               <div class="panel-section">
                  <div class="section-header">
                     <span class="section-title">形状</span>
                     <ElCheckbox
                        v-model="isMultiMode"
                        size="small"
                        @change="handleMultiModeChange"
                     >
                        连续标注
                     </ElCheckbox>
                  </div>
                  <div class="shape-grid">
                     <div
                        v-for="(shape, index) in shapes"
                        :key="shape.type"
                        :class="[
                           'shape-item',
                           { active: selectedShapeIndex === index },
                           `${shape.type}-shape`,
                        ]"
                        :title="shape.name"
                        @click="handleShapeClick(shape, index)"
                     >
                        <!-- 使用 CSS sprite 显示图标 -->
                        <div :class="['shape-icon', `icon-${index + 1}`]"></div>
                     </div>
                  </div>

                  <!-- 正方形尺寸设置 -->
                  <div
                     v-if="selectedShapeType === 'square'"
                     class="square-size-section"
                  >
                     <span class="label">尺寸:</span>
                     <ElInputNumber
                        v-model="squareSize"
                        :min="10"
                        :max="1000"
                        :step="10"
                        size="small"
                        controls-position="right"
                        @change="handleSquareSizeChange"
                     />
                  </div>
               </div>

               <!-- 颜色选择 -->
               <div class="panel-section">
                  <div class="section-header">
                     <span class="section-title">颜色</span>
                  </div>
                  <div class="color-grid">
                     <div
                        v-for="(color, index) in colors"
                        :key="index"
                        :class="[
                           'color-item',
                           { active: selectedColorIndex === index },
                        ]"
                        :title="color.name"
                        @click="handleColorClick(color, index)"
                     >
                        <!-- 预设颜色 -->
                        <div
                           v-if="color.color !== 'custom'"
                           class="color-circle"
                           :style="{ backgroundColor: color.color }"
                        ></div>
                        <!-- 自定义颜色 -->
                        <!-- 自定义颜色：颜色选择器 -->
                        <ElColorPicker
                           v-if="index === colors.length - 1"
                           v-model="customColor"
                           popper-class="!z-[9999]"
                           @active-change="handleCustomColorActiveChange"
                           @change="handleCustomColorChange"
                        />
                     </div>
                  </div>
               </div>

               <!-- 标注列表 -->
               <div
                  v-if="annotations.length > 0"
                  class="panel-section list-section"
               >
                  <div class="section-header">
                     <span class="section-title"
                        >标注列表 ({{ annotations.length }})</span
                     >
                     <ElButton
                        size="small"
                        type="primary"
                        @click="handleExportExcel"
                     >
                        导出Excel
                     </ElButton>
                  </div>
                  <div class="annotation-list">
                     <div
                        v-for="(annotation, index) in annotations"
                        :key="annotation.id"
                        :class="[
                           'annotation-item',
                           { active: selectedAnnotationIndex === index },
                        ]"
                        @click="handleAnnotationClick(annotation, index)"
                     >
                        <div class="annotation-header">
                           <div class="annotation-left">
                              <span class="annotation-index">{{
                                 index + 1
                              }}</span>
                              <span class="annotation-type">{{
                                 getAnnotationTypeLabel(annotation.type)
                              }}</span>
                           </div>
                           <div
                              class="annotation-color"
                              :style="{ backgroundColor: annotation.color }"
                           ></div>
                        </div>

                        <!-- 备注显示区域 -->
                        <div
                           v-if="
                              annotation.info &&
                              annotation.info !== '' &&
                              (!editingIndex || editingIndex !== index)
                           "
                           class="annotation-content"
                        >
                           {{ annotation.info }}
                        </div>

                        <!-- 备注编辑区域 -->
                        <div
                           v-if="editingIndex === index"
                           class="annotation-content editing"
                        >
                           <ElInput
                              v-model="editingInfo"
                              type="textarea"
                              :rows="2"
                              placeholder="请输入备注"
                              maxlength="50"
                              show-word-limit
                              @click.stop
                           />
                        </div>

                        <!-- 操作按钮 -->
                        <div
                           v-if="
                              selectedAnnotationIndex === index &&
                              editingIndex !== index
                           "
                           class="annotation-actions"
                        >
                           <span
                              class="edit-text"
                              @click.stop="handleStartMove(annotation, index)"
                           >
                              编辑
                           </span>
                           <span
                              class="edit-text"
                              @click.stop="handleStartEdit(annotation, index)"
                           >
                              备注
                           </span>
                        </div>

                        <!-- 保存和取消按钮（编辑时显示） -->
                        <div
                           v-if="editingIndex === index"
                           class="annotation-actions editing-actions"
                        >
                           <ElButton
                              size="small"
                              @click.stop="handleCancelEdit"
                           >
                              取消
                           </ElButton>
                           <ElButton
                              size="small"
                              type="primary"
                              @click.stop="handleSaveEdit(annotation)"
                           >
                              保存
                           </ElButton>
                        </div>

                        <!-- 保存和取消按钮（移动时显示） -->
                        <div
                           v-if="movingIndex === index"
                           class="annotation-actions editing-actions"
                        >
                           <ElButton
                              size="small"
                              @click.stop="handleCancelMove"
                           >
                              取消
                           </ElButton>
                           <ElButton
                              size="small"
                              type="primary"
                              @click.stop="handleSaveMove(annotation)"
                           >
                              保存
                           </ElButton>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </transition>
   </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Close } from '@element-plus/icons-vue';
import { ElInput, ElButton, ElMessage } from 'element-plus';
import { useAnnotationStore } from '@/store/modules/annotation';
import type {
   Annotation,
   AnnotationType,
   ColorOption,
   ShapeOption,
} from '@/types/annotation';
import * as XLSX from 'xlsx';

// Props
interface Props {
   visible: boolean;
   zoomValue?: number;
}

const props = withDefaults(defineProps<Props>(), {
   zoomValue: 1,
});

// Emits
const emit = defineEmits<{
   (e: 'close'): void;
   (e: 'shape-select', type: AnnotationType): void;
   (e: 'annotation-select', annotation: Annotation): void;
   (e: 'annotation-move-start', annotation: Annotation): void;
   (e: 'annotation-move-save', annotation: Annotation): void;
   (e: 'annotation-move-cancel'): void;
   (e: 'annotation-color-change'): void;
}>();

// Store
const annotationStore = useAnnotationStore();

// 响应式数据
const selectedShapeIndex = ref<number | null>(null);
const selectedColorIndex = ref<number | null>(0);
const customColor = ref<string>('#ff0000');
const squareSize = ref<number>(256);

// 编辑状态
const editingIndex = ref<number | null>(null);
const editingInfo = ref<string>('');
const movingIndex = ref<number | null>(null);

// 计算属性
const annotations = computed(() => annotationStore.annotations);

const selectedShapeType = computed(() => {
   if (selectedShapeIndex.value !== null) {
      return annotationStore.DefaultShapes[selectedShapeIndex.value].type;
   }
   return null;
});

const isMultiMode = computed({
   get: () => annotationStore.isMultiMode,
   set: (value: boolean) => {
      annotationStore.setMultiMode(value);
   },
});

const selectedAnnotationIndex = computed(() => annotationStore.selectedIndex);

// 是否正在编辑（备注或移动）
const isEditing = computed(() => {
   return editingIndex.value !== null || movingIndex.value !== null;
});

// 颜色列表
const colors = computed((): ColorOption[] => {
   const defaultColors = annotationStore.DefaultColors.map((c) => ({
      ...c,
      color: c.color,
   }));
   return [...defaultColors, { color: 'custom', name: '自定义' }];
});

// 图形列表
const shapes = computed(() => annotationStore.DefaultShapes);

// 方法
const getAnnotationTypeLabel = (type: AnnotationType) => {
   const typeMap: Record<AnnotationType, string> = {
      marker: '标记',
      line: '线段',
      circle: '圆形',
      ellipse: '椭圆',
      rect: '矩形',
      square: '正方形',
      polygon: '多边形',
      freehand: '自由绘制',
   };

   return typeMap[type] || type;
};

const handleShapeClick = (shape: ShapeOption, index: number) => {
   // 如果正在编辑某个标注（备注或移动），阻止操作
   if (isEditing.value) {
      ElMessage.warning('标注编辑尚未完成，请勿进行其他操作！');
      return;
   }

   if (selectedShapeIndex.value === index) {
      // 取消选择
      selectedShapeIndex.value = null;
      annotationStore.setCurrentType(null);
      emit('shape-select', null as any);
   } else {
      selectedShapeIndex.value = index;
      annotationStore.setCurrentType(shape.type);
      annotationStore.setCurrentColor(
         selectedColorIndex.value === colors.value.length - 1
            ? customColor.value
            : selectedColorIndex.value !== null
            ? colors.value[selectedColorIndex.value].color
            : '#ff0000'
      );
      emit('shape-select', shape.type);
   }
};

const handleColorClick = (color: ColorOption, index: number) => {
   selectedColorIndex.value = index;

   if (color.color !== 'custom') {
      annotationStore.setCurrentColor(color.color);

      // 仅在移动标注模式下，更新选中标注的颜色
      if (
         movingIndex.value !== null &&
         selectedAnnotationIndex.value !== null
      ) {
         const annotation =
            annotationStore.annotations[selectedAnnotationIndex.value];
         if (annotation) {
            annotation.color = color.color;
            emit('annotation-color-change');
         }
      }
   }
   // 自定义颜色的处理由颜色选择器通过 @active-change 事件处理
};

const handleCustomColorChange = (color: string) => {
   annotationStore.setCurrentColor(color);

   // 仅在移动标注模式下，更新选中标注的颜色
   if (movingIndex.value !== null && selectedAnnotationIndex.value !== null) {
      const annotation =
         annotationStore.annotations[selectedAnnotationIndex.value];
      if (annotation) {
         annotation.color = color;
         emit('annotation-color-change');
      }
   }
};

const handleCustomColorActiveChange = (color: string) => {
   // 颜色选择器打开时，自动应用选中的颜色
   annotationStore.setCurrentColor(color);
   selectedColorIndex.value = colors.value.length - 1; // 选中自定义颜色

   // 仅在移动标注模式下，更新选中标注的颜色
   if (movingIndex.value !== null && selectedAnnotationIndex.value !== null) {
      const annotation =
         annotationStore.annotations[selectedAnnotationIndex.value];
      if (annotation) {
         annotation.color = color;
         emit('annotation-color-change');
      }
   }
};

const handleSquareSizeChange = (value: number) => {
   // 如果正在编辑某个标注（备注或移动），阻止操作
   if (isEditing.value) {
      ElMessage.warning('标注编辑尚未完成，请勿进行其他操作！');
      return;
   }
   annotationStore.setSquareSize(value);
   emit('shape-select', 'square'); // 重新设置以应用新尺寸
};

const handleMultiModeChange = (value: boolean) => {
   // 如果正在编辑某个标注（备注或移动），阻止操作
   if (isEditing.value) {
      ElMessage.warning('标注编辑尚未完成，请勿进行其他操作！');
      return;
   }
   // 如果取消连续标注模式，重置选中的图形
   if (!value) {
      selectedShapeIndex.value = null;
      annotationStore.setCurrentType(null);
   }
};

const handleAnnotationClick = (annotation: Annotation, index: number) => {
   // 检查是否正在编辑某个标注
   if (isEditing.value) {
      ElMessage.warning('标注编辑尚未完成，请勿进行其他操作！');
      return;
   }

   // 选中标注
   annotationStore.setSelectedIndex(index);
   emit('annotation-select', annotation);
};

const handleStartMove = (annotation: Annotation, index: number) => {
   // 如果正在编辑某个标注（备注或移动），阻止操作
   if (isEditing.value) {
      ElMessage.warning('标注编辑尚未完成，请勿进行其他操作！');
      return;
   }

   // 开始移动标注
   movingIndex.value = index;
   emit('annotation-move-start', annotation);
};

const handleStartEdit = (annotation: Annotation, index: number) => {
   // 如果正在编辑某个标注（备注或移动），阻止操作
   if (isEditing.value) {
      ElMessage.warning('标注编辑尚未完成，请勿进行其他操作！');
      return;
   }

   // 开始编辑备注
   editingIndex.value = index;
   editingInfo.value = annotation.info || '';
};

const handleSaveEdit = (annotation: Annotation) => {
   // 更新标注的备注信息
   annotation.info = editingInfo.value;
   // 更新 store 中的标注数据
   const index = annotationStore.annotations.findIndex(
      (a) => a.id === annotation.id
   );
   if (index !== -1) {
      annotationStore.annotations[index].info = editingInfo.value;
   }
   editingIndex.value = null;
};

const handleCancelEdit = () => {
   editingIndex.value = null;
   editingInfo.value = '';
};

const handleSaveMove = (annotation: Annotation) => {
   emit('annotation-move-save', annotation);
   movingIndex.value = null;
};

const handleCancelMove = () => {
   emit('annotation-move-cancel');
   movingIndex.value = null;
};

const handleClose = () => {
   emit('close');
};

/**
 * 导出标注数据到 Excel
 */
const handleExportExcel = () => {
   if (annotations.value.length === 0) {
      ElMessage.warning('暂无标注数据可导出');
      return;
   }

   // 像素转微米的比例因子
   const pixelToMicron = 0.46;

   // 准备导出数据
   const exportData = annotations.value.map((annotation, index) => {
      const params = annotation.params as any;
      let x = 0,
         y = 0,
         horizontalDiameter = 0,
         verticalDiameter = 0,
         area = 0;

      switch (annotation.type) {
         case 'marker':
            x = params.x;
            y = params.y;
            break;
         case 'line':
            x = (params.x1 + params.x2) / 2;
            y = (params.y1 + params.y2) / 2;
            const lineLength = Math.sqrt(
               Math.pow(params.x2 - params.x1, 2) +
                  Math.pow(params.y2 - params.y1, 2)
            );
            horizontalDiameter = lineLength;
            verticalDiameter = lineLength;
            break;
         case 'circle':
            x = params.cx;
            y = params.cy;
            horizontalDiameter = params.r * 2;
            verticalDiameter = params.r * 2;
            area = Math.PI * params.r * params.r;
            break;
         case 'ellipse':
            x = params.cx;
            y = params.cy;
            horizontalDiameter = params.rx * 2;
            verticalDiameter = params.ry * 2;
            area = Math.PI * params.rx * params.ry;
            break;
         case 'rect':
            x = params.x + params.width / 2;
            y = params.y + params.height / 2;
            horizontalDiameter = params.width;
            verticalDiameter = params.height;
            area = params.width * params.height;
            break;
         case 'square':
            x = params.x + params.side / 2;
            y = params.y + params.side / 2;
            horizontalDiameter = params.side;
            verticalDiameter = params.side;
            area = params.side * params.side;
            break;
         case 'polygon':
         case 'freehand':
            const points = params.points || [];
            if (points.length > 0) {
               const xs = points.map((p: { x: number; y: number }) => p.x);
               const ys = points.map((p: { x: number; y: number }) => p.y);
               x =
                  xs.reduce((a: number, b: number) => a + b, 0) / points.length;
               y =
                  ys.reduce((a: number, b: number) => a + b, 0) / points.length;
               horizontalDiameter = Math.max(...xs) - Math.min(...xs);
               verticalDiameter = Math.max(...ys) - Math.min(...ys);
            }
            break;
      }

      return {
         形状: getAnnotationTypeLabel(annotation.type),
         x坐标: Math.round(x * pixelToMicron * 100) / 100,
         y坐标: Math.round(y * pixelToMicron * 100) / 100,
         倍率: props.zoomValue,
         '水平直径(μm)':
            Math.round(horizontalDiameter * pixelToMicron * 100) / 100,
         '垂直直径(μm)':
            Math.round(verticalDiameter * pixelToMicron * 100) / 100,
         '面积(μm²)':
            Math.round(area * pixelToMicron * pixelToMicron * 100) / 100,
         备注: annotation.info || '',
         标题: '', // 标注数据中没有标题字段，留空
         颜色: annotation.color,
         旋转角度: 0, // 标注数据中没有旋转角度字段，默认为0
      };
   });

   // 创建工作簿
   const wb = XLSX.utils.book_new();
   const ws = XLSX.utils.json_to_sheet(exportData);

   // 设置列宽
   ws['!cols'] = [
      { wch: 10 }, // 形状
      { wch: 12 }, // x坐标
      { wch: 12 }, // y坐标
      { wch: 8 }, // 倍率
      { wch: 15 }, // 水平直径
      { wch: 15 }, // 垂直直径
      { wch: 15 }, // 面积
      { wch: 20 }, // 备注
      { wch: 15 }, // 标题
      { wch: 10 }, // 颜色
      { wch: 10 }, // 旋转角度
   ];

   XLSX.utils.book_append_sheet(wb, ws, '标注数据');

   // 导出文件
   const fileName = `标注数据_${new Date()
      .toLocaleDateString()
      .replace(/\//g, '-')}.xlsx`;
   XLSX.writeFile(wb, fileName);

   ElMessage.success('导出成功');
};

/**
 * 重置形状选择状态
 */
const resetShapeSelection = () => {
   selectedShapeIndex.value = null;
   annotationStore.setCurrentType(null);
};

// 暴露方法给父组件
defineExpose({
   resetShapeSelection,
});

// 监听 visible 变化
watch(
   () => props.visible,
   (newVal) => {
      if (!newVal) {
         // 面板关闭时，重置选中状态
         if (!annotationStore.isMultiMode) {
            selectedShapeIndex.value = null;
            annotationStore.setCurrentType(null);
         }
      }
   }
);
</script>

<style scoped lang="scss">
.annotation-panel {
   position: fixed;
   top: 80px;
   right: 20px;
   z-index: 9998;
   display: flex;
   flex-direction: column;
   width: 280px;
   max-height: calc(100vh - 120px);
   overflow: hidden;
   background-color: #ffffff;
   border-radius: 8px;
   box-shadow: 0 2px 12px rgb(0 0 0 / 15%);
}
.panel-header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding: 12px 16px;
   color: #ffffff;
   background: linear-gradient(90deg, #409eff 0%, #66b1ff 100%);
}
.panel-title {
   font-size: 16px;
   font-weight: 600;
}
.close-icon {
   cursor: pointer;
   transition: opacity 0.2s;
   &:hover {
      opacity: 0.8;
   }
}
.panel-body {
   flex: 1;
   padding: 12px;
   overflow-y: auto;
}
.panel-section {
   margin-bottom: 16px;
   &:last-child {
      margin-bottom: 0;
   }
}
.section-header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding-bottom: 8px;
   margin-bottom: 8px;
   border-bottom: 1px solid #ebeef5;
}
.section-title {
   font-size: 14px;
   font-weight: 600;
   color: #303133;
}
.shape-grid {
   display: grid;
   grid-template-columns: repeat(4, 1fr);
   gap: 8px;
}
.shape-item {
   display: flex;
   align-items: center;
   justify-content: center;
   width: 50px;
   height: 50px;
   cursor: pointer;
   background-color: #56677d;
   border-radius: 4px;
   transition: all 0.2s;
   &:hover {
      background-color: #6c809a;
   }
   &.active {
      background-color: #409eff;
   }
}

// 使用 sprite 图标
.shape-icon {
   width: 32px;
   height: 34px;
   background-image: url('@/assets/remark/remarkScape.png');
   background-repeat: no-repeat;
}
.icon-1 {
   // point
   background-position: -3px 2px;
}
.icon-2 {
   // line
   background-position: -32px 0;
}
.icon-3 {
   // ellipse
   background-position: -64px 0;
}
.icon-4 {
   // rect
   background-position: -96px 0;
}
.icon-5 {
   // polygon
   background-position: 0 -34px;
}
.icon-6 {
   // freehand
   background-position: -32px -34px;
}
.icon-7 {
   // circle
   background-position: -60px -32px;
}
.icon-8 {
   // square
   background-position: -91px -31px;
}
.square-size-section {
   display: flex;
   gap: 8px;
   align-items: center;
   margin-top: 8px;
   .label {
      font-size: 12px;
      color: #606266;
   }
}
.color-grid {
   display: grid;
   grid-template-columns: repeat(3, 1fr);
   gap: 8px;
}
.color-item {
   position: relative;
   display: flex;
   align-items: center;
   justify-content: center;
   height: 36px;
   cursor: pointer;
   background-color: #f5f7fa;
   border-radius: 4px;
   transition: all 0.2s;
   &:hover {
      background-color: #e6e8eb;
   }
   &.active {
      background-color: #409eff;
   }
}
.color-circle {
   width: 20px;
   height: 20px;
   border: 2px solid #ffffff;
   border-radius: 50%;
}

// 自定义颜色选择器样式 - 参考slideviewer-java实现
:deep(.custom-color-picker) {
   position: absolute;
   top: 0;
   left: 0;
   width: 100%;
   height: 100%;
   opacity: 0;
}
.list-section {
   display: flex;
   flex: 1;
   flex-direction: column;
   overflow: hidden;
}
.annotation-list {
   flex: 1;
   padding-right: 4px;
   margin-top: 8px;
   overflow-y: auto;
   &::-webkit-scrollbar {
      width: 6px;
   }
   &::-webkit-scrollbar-thumb {
      background-color: #c0c4cc;
      border-radius: 3px;
   }
   &::-webkit-scrollbar-track {
      background-color: #f5f7fa;
   }
}
.annotation-item {
   padding: 8px;
   margin-bottom: 8px;
   cursor: pointer;
   background-color: #f5f7fa;
   border-radius: 4px;
   transition: all 0.2s;
   &:hover {
      background-color: #e6e8eb;
   }
   &.active {
      background-color: #e6f7ff;
      border: 1px solid #409eff;
   }
}
.annotation-header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   margin-bottom: 4px;
}
.annotation-left {
   display: flex;
   gap: 6px;
   align-items: center;
}
.annotation-index {
   font-size: 12px;
   font-weight: 600;
   color: #909399;
}
.annotation-type {
   font-size: 12px;
   color: #606266;
}
.annotation-color {
   width: 6px;
   height: 6px;
   border-radius: 50%;
}
.annotation-content {
   padding: 6px;
   margin-bottom: 8px;
   font-size: 12px;
   color: #606266;
   word-break: break-all;
   background-color: #ffffff;
   border-radius: 4px;
   &.editing {
      padding: 0;
      margin-bottom: 8px;
   }
}
.annotation-actions {
   display: flex;
   gap: 8px;
   justify-content: flex-end;
   &.editing-actions {
      margin-top: 8px;
   }
}
.edit-text {
   font-size: 12px;
   color: #409eff;
   cursor: pointer;
   transition: opacity 0.2s;
   &:hover {
      opacity: 0.8;
   }
}

// 动画
.panel-slide-enter-active,
.panel-slide-leave-active {
   transition: all 0.3s ease;
}
.panel-slide-enter-from {
   opacity: 0;
   transform: translateX(100%);
}
.panel-slide-leave-to {
   opacity: 0;
   transform: translateX(100%);
}
</style>
