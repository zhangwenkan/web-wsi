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
         <div
            class="popup-header"
            :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
            @mousedown="startDrag"
         >
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
               <ElIcon class="close-icon" :size="18" @click="handleCancel">
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

         <!-- 备注输入 -->
         <div
            v-if="!(properties && Object.keys(properties).length > 0)"
            class="popup-body"
         >
            <ElInput
               v-model="info"
               type="textarea"
               :rows="3"
               placeholder="请输入标注信息"
               maxlength="50"
               show-word-limit
            />
         </div>

         <!-- 操作按钮 -->
         <div class="popup-footer">
            <ElButton
               v-if="showDelete"
               size="small"
               type="danger"
               @click="handleDelete"
            >
               删除
            </ElButton>
            <ElButton size="small" @click="handleCancel">取消</ElButton>
            <ElButton size="small" type="primary" @click="handleConfirm">
               确定
            </ElButton>
         </div>
      </div>
   </teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { Close } from '@element-plus/icons-vue';
import type { Annotation, PopupParams } from '@/types/annotation';

// Props
interface Props {
   visible: boolean;
   params: PopupParams | null;
   showDelete?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
   showDelete: true,
});

// Emits
const emit = defineEmits<{
   (e: 'ok', annotation: Annotation): void;
   (e: 'cancel'): void;
   (e: 'delete', id: string): void;
}>();

// 响应式数据
const info = ref('');
const position = reactive({ left: 0, top: 0 });
const isDragging = ref(false);
const dragStartPos = reactive({ x: 0, y: 0 });
const dragOffset = reactive({ x: 0, y: 0 });

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

const formatPropertyValue = (key: string, value: number) => {
   // 将像素转换为微米（假设比例因子，实际应根据图像分辨率调整）
   const pixelToMicron = 0.46; // 默认比例因子
   const microns = value * pixelToMicron;

   if (key === 'area') {
      if (microns > 1000000) {
         return `${(microns / 1000000).toFixed(2)} mm²`;
      }
      return `${microns.toFixed(2)} μm²`;
   } else {
      if (microns > 1000) {
         return `${(microns / 1000).toFixed(2)} mm`;
      }
      return `${microns.toFixed(2)} μm`;
   }
};

// 拖拽处理
const startDrag = (e: MouseEvent) => {
   e.preventDefault();
   isDragging.value = true;
   dragStartPos.x = e.clientX;
   dragStartPos.y = e.clientY;
   dragOffset.x = e.clientX - position.left;
   dragOffset.y = e.clientY - position.top;

   document.addEventListener('mousemove', onDrag);
   document.addEventListener('mouseup', stopDrag);
   document.body.style.userSelect = 'none';
};

const onDrag = (e: MouseEvent) => {
   if (!isDragging.value) return;

   const newLeft = e.clientX - dragOffset.x;
   const newTop = e.clientY - dragOffset.y;

   // 边界检查
   const popupWidth = 340;
   const popupHeight = 300;
   const viewportWidth = window.innerWidth;
   const viewportHeight = window.innerHeight;

   position.left = Math.max(0, Math.min(newLeft, viewportWidth - popupWidth));
   position.top = Math.max(0, Math.min(newTop, viewportHeight - popupHeight));
};

const stopDrag = () => {
   isDragging.value = false;
   document.removeEventListener('mousemove', onDrag);
   document.removeEventListener('mouseup', stopDrag);
   document.body.style.userSelect = '';
};

// 事件处理
const handleConfirm = () => {
   if (annotation.value) {
      emit('ok', {
         ...annotation.value,
         info: info.value,
      });
   }
};

const handleCancel = () => {
   emit('cancel');
};

const handleDelete = () => {
   if (annotation.value) {
      emit('delete', annotation.value.id);
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
   document.removeEventListener('mousemove', onDrag);
   document.removeEventListener('mouseup', stopDrag);
   document.body.style.userSelect = '';
});
</script>

<style scoped lang="scss">
.annotation-popup {
   position: fixed;
   z-index: 9999;
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
