<template>
   <teleport to="body">
      <div
         v-if="visible"
         class="annotation-popup"
         :style="{
            left: `${position.left}px`,
            top: `${position.top}px`,
         }"
      >
         <!-- 标题栏 -->
         <div class="popup-header">
            <div class="header-left">
               <div
                  class="color-dot"
                  :style="{ backgroundColor: annotation?.color }"
               ></div>
               <span class="header-title">{{
                  getAnnotationTypeLabel(annotation?.type)
               }}</span>
            </div>
            <div class="header-right">
               <ElIcon class="close-icon" :size="18" @click="handleClose">
                  <Close />
               </ElIcon>
            </div>
         </div>

         <!-- 属性显示 -->
         <div
            v-if="properties && Object.keys(properties).length > 0"
            class="popup-properties"
         >
            <div
               v-for="(value, key) in properties"
               :key="key"
               class="property-item"
            >
               <span class="property-label">{{ getPropertyLabel(key) }}:</span>
               <span class="property-value">{{
                  formatPropertyValue(key, value)
               }}</span>
            </div>
         </div>

         <!-- 备注显示 -->
         <div
            v-if="annotation?.info && annotation.info !== ''"
            class="popup-remark"
         >
            <div class="remark-label">备注:</div>
            <div class="remark-content">{{ annotation.info }}</div>
         </div>

         <!-- 操作按钮 -->
         <div class="popup-footer">
            <ElButton
               v-if="showEdit"
               size="small"
               type="primary"
               @click="handleEdit"
            >
               编辑
            </ElButton>
            <ElButton
               v-if="showDelete"
               size="small"
               type="danger"
               @click="handleDelete"
            >
               删除
            </ElButton>
         </div>
      </div>
   </teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { Close } from '@element-plus/icons-vue';
import type { PopupParams } from '@/types/annotation';

// Props
interface Props {
   visible: boolean;
   params: PopupParams | null;
   showDelete?: boolean;
   showEdit?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
   showDelete: true,
   showEdit: true,
});

// Emits
const emit = defineEmits<{
   (e: 'close'): void;
   (e: 'delete', id: string): void;
   (e: 'edit', annotation: any): void;
}>();

// 响应式数据
const info = ref('');
const position = reactive({ left: 0, top: 0 });

// 计算属性
const annotation = computed(() => props.params?.annotation);

const properties = computed(() => props.params?.properties);

// 方法
const getAnnotationTypeLabel = (type?: string) => {
   if (!type) return '';

   const typeMap: Record<string, string> = {
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

const getPropertyLabel = (key: string) => {
   const labelMap: Record<string, string> = {
      length: '长度',
      area: '面积',
      width: '宽度',
      height: '高度',
      horizontalDiameter: '水平直径',
      verticalDiameter: '垂直直径',
   };

   return labelMap[key] || key;
};

const formatPropertyValue = (key: string, value: number | undefined) => {
   if (value === undefined) return '-';

   // 将像素转换为微米（假设比例因子，实际应根据图像分辨率调整）
   const pixelToMicron = 0.46; // 默认比例因子

   if (key === 'area') {
      // 面积是二维单位，需要乘以 pixelToMicron²
      const microns = value * pixelToMicron * pixelToMicron;
      if (microns > 1000000) {
         return `${(microns / 1000000).toFixed(2)} mm²`;
      }
      return `${microns.toFixed(2)} μm²`;
   } else {
      // 长度是一维单位，乘以 pixelToMicron
      const microns = value * pixelToMicron;
      if (microns > 1000) {
         return `${(microns / 1000).toFixed(2)} mm`;
      }
      return `${microns.toFixed(2)} μm`;
   }
};

// 事件处理
const handleClose = () => {
   emit('close');
};

const handleDelete = () => {
   if (annotation.value) {
      emit('delete', annotation.value.id);
   }
};

const handleEdit = () => {
   if (annotation.value) {
      emit('edit', annotation.value);
      emit('close');
   }
};

// 监听 props 变化
const updatePopupInfo = () => {
   if (props.params?.annotation) {
      info.value = props.params.annotation.info;
   }
};

// 监听位置变化
const updatePopupPosition = () => {
   if (props.params?.left !== undefined && props.params?.top !== undefined) {
      position.left = props.params.left;
      position.top = props.params.top;
   }
};

// 生命周期
onMounted(() => {
   updatePopupInfo();
   updatePopupPosition();
});

// 监听 visible 变化
watch(
   () => props.visible,
   (newVal) => {
      if (newVal) {
         updatePopupInfo();
         updatePopupPosition();
      }
   }
);

watch(
   () => props.params,
   (newParams) => {
      if (newParams) {
         updatePopupInfo();
         updatePopupPosition();
      }
   },
   { deep: true }
);

onUnmounted(() => {
   // 组件卸载时无需清理
});
</script>

<style scoped lang="scss">
.annotation-popup {
   position: fixed;
   z-index: 67;
   width: 340px;
   background-color: #ffffff;
   border: 1px solid #dcdfe6;
   border-radius: 8px;
   box-shadow: 0 2px 12px rgb(0 0 0 / 15%);
   transform: translate(-50%, 0);
}
.popup-header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding: 12px 16px;
   user-select: none;
   border-bottom: 1px solid #ebeef5;
}
.header-left {
   display: flex;
   gap: 8px;
   align-items: center;
}
.color-dot {
   flex-shrink: 0;
   width: 8px;
   height: 8px;
   border-radius: 50%;
}
.header-title {
   font-size: 14px;
   font-weight: 600;
   color: #303133;
}
.header-right {
   cursor: pointer;
}
.close-icon {
   color: #909399;
   transition: color 0.2s;
   &:hover {
      color: #409eff;
   }
}
.popup-properties {
   padding: 12px 16px;
   background-color: #f5f7fa;
   border-bottom: 1px solid #ebeef5;
}
.popup-remark {
   padding: 12px 16px;
   background-color: #fafafa;
   border-bottom: 1px solid #ebeef5;
}
.remark-label {
   margin-bottom: 4px;
   font-size: 12px;
   color: #909399;
}
.remark-content {
   font-size: 13px;
   line-height: 1.5;
   color: #303133;
   word-break: break-all;
}
.property-item {
   display: flex;
   align-items: center;
   justify-content: space-between;
   font-size: 12px;
   line-height: 1.8;
}
.property-label {
   color: #909399;
}
.property-value {
   font-weight: 600;
   color: #303133;
}
.popup-body {
   padding: 12px 16px;
}
.popup-footer {
   display: flex;
   gap: 8px;
   justify-content: flex-end;
   padding: 12px 16px;
   border-top: 1px solid #ebeef5;
}
</style>
