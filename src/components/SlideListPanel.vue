<template>
   <transition name="slide-panel">
      <div
         v-if="slideListVisible"
         :ref="setRefs"
         class="fixed w-[250px] min-h-[200px] bg-white shadow-xl z-[900] p-4 panel-transition"
         :class="{ 'enable-transition': enableTransition }"
         :style="{
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
         }"
      >
         <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg text-gray-800">切片列表</h3>
            <!-- 导航控件区域 -->
            <div class="p-3 bg-gray-50 rounded-lg">
               <div class="flex items-center">
                  <button
                     class="flex items-center justify-center bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition duration-200 cursor-pointer"
                     @click="handlePrevImage"
                  >
                     <ElIcon>
                        <ArrowLeft />
                     </ElIcon>
                  </button>
                  <div
                     class="flex-1 mx-[5px] text-center text-sm font-medium text-gray-700"
                  >
                     {{ currentIndex + 1 }} / {{ imageList.length }}
                  </div>
                  <button
                     class="flex items-center justify-center bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition duration-200 cursor-pointer"
                     @click="handleNextImage"
                  >
                     <ElIcon>
                        <ArrowRight />
                     </ElIcon>
                  </button>
               </div>
            </div>
            <button
               class="text-gray-500 hover:text-gray-700 cursor-pointer"
               @click="handleToggleSlideList"
            >
               <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
               >
                  <path
                     stroke-linecap="round"
                     stroke-linejoin="round"
                     stroke-width="2"
                     d="M6 18L18 6M6 6l12 12"
                  />
               </svg>
            </button>
         </div>

         <ul class="space-y-2 overflow-y-auto h-[calc(100%-140px)]">
            <li
               v-for="(element, index) in imageList"
               :key="index"
               :class="[
                  'p-3 cursor-pointer rounded-lg transition duration-200 border',
                  currentIndex === index
                     ? 'border-blue-500 bg-blue-50'
                     : 'border-gray-200 hover:bg-gray-50',
               ]"
               @click="handleSelectImage(index)"
            >
               <div class="flex items-center">
                  <div
                     class="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-md overflow-hidden mr-3"
                  >
                     <img
                        :src="element.url"
                        :alt="element.slideName"
                        class="w-full h-full object-cover"
                     />
                  </div>
                  <div class="flex-1 min-w-0">
                     <div class="font-medium text-gray-800 truncate">
                        {{ element.slideName }}
                     </div>
                     <div class="text-sm text-gray-600">
                        {{ element.adoptedPart }}
                     </div>
                  </div>
               </div>
            </li>
         </ul>
      </div>
   </transition>
</template>

<script lang="ts" setup>
import { ElIcon } from 'element-plus';
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import { useDrag } from 'vue3-dnd';
import { ref, reactive, computed } from 'vue';

interface ImageItem {
   slideName: string;
   adoptedPart: string;
   url: string;
}

interface Props {
   slideListVisible: boolean;
   initialCurrentIndex?: number;
   initialImageList?: ImageItem[];
}

interface Emits {
   (event: 'toggle-slide-list'): void;
   (event: 'prev-image'): void;
   (event: 'next-image'): void;
   (event: 'select-image', index: number): void;
}

const props = withDefaults(defineProps<Props>(), {
   initialCurrentIndex: 0,
   initialImageList: () => [],
});
const emit = defineEmits<Emits>();

// 切片列表数据
const imageList = ref<ImageItem[]>(props.initialImageList);
const currentIndex = ref<number>(props.initialCurrentIndex);

// 面板DOM引用
const panelRef = ref<HTMLElement | null>(null);

// 面板位置状态
const position = reactive({
   x: 60,
   y: 175,
});

const isDragging = ref(false);
const enableTransition = ref(false); // 控制是否启用位置过渡动画

// 组合设置多个ref
const setRefs = (el: any) => {
   if (el && el instanceof HTMLElement) {
      panelRef.value = el;
      dragSource(el);
   }
};

// 切换到上一张图片
const handlePrevImage = () => {
   if (currentIndex.value > 0) {
      currentIndex.value--;
      emit('select-image', currentIndex.value);
   }
};

// 切换到下一张图片
const handleNextImage = () => {
   if (currentIndex.value < imageList.value.length - 1) {
      currentIndex.value++;
      emit('select-image', currentIndex.value);
   }
};

const handleToggleSlideList = () => {
   emit('toggle-slide-list');
};

const handleSelectImage = (index: number) => {
   currentIndex.value = index;
   emit('select-image', index);
};

// 重置面板位置到初始位置
const resetPosition = () => {
   // 启用过渡动画
   enableTransition.value = true;

   // 设置初始位置
   position.x = 60;
   position.y = 175;

   // 动画结束后禁用过渡，以免影响拖拽
   setTimeout(() => {
      enableTransition.value = false;
   }, 500); // 500ms 与 CSS 过渡时间一致
};

// 判断是否在初始位置
const isAtInitialPosition = () => {
   return position.x === 60 && position.y === 175;
};

// 暴露方法给父组件调用
defineExpose({
   resetPosition,
   isAtInitialPosition,
   position,
   setCurrentIndex: (index: number) => {
      currentIndex.value = index;
   },
   getImageList: () => imageList.value,
   getCurrentIndex: () => currentIndex.value,
});

const [, dragSource] = useDrag(() => ({
   type: 'SLIDE_LIST',
   item: () => {
      isDragging.value = true;
      return {
         type: 'SLIDE_LIST',
         initialX: position.x,
         initialY: position.y,
      };
   },
   collect: (monitor) => ({
      isDragging: monitor.isDragging(),
      diff: monitor.getDifferenceFromInitialOffset(),
   }),
   end(item, monitor) {
      isDragging.value = false;
      const diff = monitor.getDifferenceFromInitialOffset();
      if (diff && item) {
         // 基于初始位置和拖拽偏移量计算新位置
         let newX = item.initialX + diff.x;
         let newY = item.initialY + diff.y;

         // 获取面板实际尺寸和视窗尺寸
         const panelWidth = 250; // 面板宽度
         const panelHeight = panelRef.value?.offsetHeight || 200; // 获取面板实际高度，有可能获取失败(比如元素还未渲染)，使用默认最小值200
         const windowWidth = window.innerWidth;
         const windowHeight = window.innerHeight;

         // 边界检测：左边界
         if (newX < 0) {
            newX = 0;
         }
         // 边界检测：右边界
         if (newX + panelWidth > windowWidth) {
            newX = windowWidth - panelWidth;
         }
         // 边界检测：上边界
         if (newY < 0) {
            newY = 0;
         }
         // 边界检测：下边界
         if (newY + panelHeight > windowHeight) {
            newY = windowHeight - panelHeight;
         }

         position.x = newX;
         position.y = newY;
      }
   },
}));
</script>

<style scoped>
/* 面板位置过渡动画 */
.panel-transition.enable-transition {
   transition: left 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
      top 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* 面板显隐过渡动画 */
.slide-panel-enter-active,
.slide-panel-leave-active {
   transition: opacity 0.3s ease, transform 0.3s ease;
}
.slide-panel-enter-from {
   opacity: 0;
   transform: translateX(-30px);
}
.slide-panel-leave-to {
   opacity: 0;
   transform: translateX(-30px);
}
</style>
