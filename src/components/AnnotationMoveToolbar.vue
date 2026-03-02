<template>
   <Teleport to="body">
      <div v-if="visible" class="annotation-move-toolbar" :style="toolbarStyle">
         <div class="move-toolbar-content">
            <div class="move-icon" title="拖动移动">
               <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
               >
                  <path
                     d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"
                  />
               </svg>
            </div>
            <button class="move-toolbar-btn save-btn" @click="handleSave">
               保存
            </button>
            <button class="move-toolbar-btn cancel-btn" @click="handleCancel">
               取消
            </button>
         </div>
      </div>
   </Teleport>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
   visible: boolean;
   position: { left: number; top: number };
}

const props = defineProps<Props>();

const emit = defineEmits<{
   (e: 'save'): void;
   (e: 'cancel'): void;
}>();

const toolbarStyle = computed(() => ({
   left: `${props.position.left}px`,
   top: `${props.position.top}px`,
   transform: 'translate(-50%, 0)',
}));

const handleSave = () => {
   emit('save');
};

const handleCancel = () => {
   emit('cancel');
};
</script>

<style scoped>
.annotation-move-toolbar {
   position: fixed;
   z-index: 9999;
   pointer-events: auto;
}

.move-toolbar-content {
   display: flex;
   gap: 8px;
   align-items: center;
   padding: 8px 12px;
   background: #ffffff;
   border-radius: 6px;
   box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.move-icon {
   display: flex;
   align-items: center;
   justify-content: center;
   width: 24px;
   height: 24px;
   color: #606266;
   cursor: move;
}

.move-toolbar-btn {
   padding: 4px 12px;
   font-size: 12px;
   border: none;
   border-radius: 4px;
   cursor: pointer;
   transition: all 0.2s;
}

.save-btn {
   color: #ffffff;
   background: #409eff;
}

.save-btn:hover {
   background: #66b1ff;
}

.cancel-btn {
   color: #606266;
   background: #f5f7fa;
   border: 1px solid #dcdfe6;
}

.cancel-btn:hover {
   color: #409eff;
   border-color: #c6e2ff;
   background: #ecf5ff;
}
</style>
