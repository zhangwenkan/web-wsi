<template>
   <div
      ref="thumbnailRef"
      class="fixed w-[180px] h-[166px] z-[100] top-[80px] left-[10px] border border-[#25b0e5] cursor-pointer overflow-hidden"
   >
      <canvas ref="navCanvasRef" class="absolute top-0 left-0"></canvas>
      <div
         class="absolute h-[1px] bg-red-600 w-full pointer-events-none"
         :style="hLineStyle"
      ></div>
      <div
         class="absolute w-[1px] bg-red-600 h-full pointer-events-none"
         :style="vLineStyle"
      ></div>
      <div
         ref="viewRectRef"
         class="absolute border-1 border-red-600 pointer-events-none bg-white z-[10] opacity-50"
         :style="viewRectStyle"
      ></div>
   </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import OpenSeadragon from 'openseadragon';

interface Props {
   viewer?: any;
   imageList: Array<{ slideName: string; adoptedPart: string; url: string }>;
   currentIndex: number;
}

const props = defineProps<Props>();

// 使用ref替代直接的DOM访问
const thumbnailRef = ref<HTMLElement | null>(null);
const navCanvasRef = ref<HTMLCanvasElement | null>(null);
const navCtx = ref<CanvasRenderingContext2D | null>(null);

// 响应式状态
const isDragging = ref(false);
const dragOffsetX = ref(0); // 记录鼠标点击位置与红框中心的偏移 X
const dragOffsetY = ref(0); // 记录鼠标点击位置与红框中心的偏移 Y

// 响应式数据用于驱动视图
const viewRectStyle = ref({
   left: '0px',
   top: '0px',
   width: '0px',
   height: '0px',
   display: 'block',
});

const hLineStyle = ref({
   top: '50%',
   display: 'block',
});

const vLineStyle = ref({
   left: '50%',
   display: 'block',
});

const updateNavigatorView = () => {
   if (!props.viewer || !navCanvasRef.value) return;

   // 获取视口相对于图像的坐标和尺寸 (0到1之间)
   const bounds = props.viewer.viewport.getBounds();

   // 获取图片实际尺寸
   const tiledImage = props.viewer.world.getItemAt(0);
   if (!tiledImage) return;

   const imageWidth = tiledImage.source.dimensions.x;
   const imageHeight = tiledImage.source.dimensions.y;
   const aspectRatio = imageWidth / imageHeight;

   // 参考网站逻辑：以 180px 宽度为基准计算比例
   const navImageWidth = 180;
   const navImageHeight = 180 / aspectRatio;

   // 计算偏移量以居中显示在 180x166 容器中 (注意: 容器高度实际为 166)
   const navOffsetX = 0;
   const navOffsetY = (166 - navImageHeight) / 2;

   // 计算视口在缩略图中的位置和尺寸
   const viewRectX = bounds.x * navImageWidth + navOffsetX;
   const viewRectY = bounds.y * navImageWidth + navOffsetY; // 垂直位置也基于宽度比例计算
   const viewRectW = bounds.width * navImageWidth;
   const viewRectH = bounds.height * navImageWidth; // 高度同样基于宽度比例

   // 参考网站逻辑：十字线反映视口的中心点 (Viewport Center)
   // 直接获取当前视口中心点在图像上的归一化坐标 (0~1)
   const viewportCenter = props.viewer.viewport.getCenter();
   const centerX = viewportCenter.x * navImageWidth + navOffsetX;
   const centerY = viewportCenter.y * navImageWidth + navOffsetY;

   // 更新视口矩形的样式数据
   viewRectStyle.value = {
      left: `${viewRectX}px`,
      top: `${viewRectY}px`,
      width: `${viewRectW}px`,
      height: `${viewRectH}px`,
      // 如果视口完全在可视区域外，隐藏矩形
      display:
         viewRectX + viewRectW > 0 &&
         viewRectX < 180 &&
         viewRectY + viewRectH > 0 &&
         viewRectY < 166
            ? 'block'
            : 'none',
   };

   // 更新十字线位置的样式数据
   hLineStyle.value = {
      top: `${centerY}px`,
      display: 'block',
   };

   vLineStyle.value = {
      left: `${centerX}px`,
      display: 'block',
   };
};

const drawThumbnail = async () => {
   await nextTick(); // 确保DOM元素已渲染

   const canvas = navCanvasRef.value;
   if (!canvas) return;

   // 设置canvas尺寸
   canvas.width = 180;
   canvas.height = 166;

   const ctx = canvas.getContext('2d');
   if (!ctx) return;

   navCtx.value = ctx;

   // 绘制缩略图（使用当前图片）
   const img = new Image();
   img.crossOrigin = 'anonymous';
   img.onload = () => {
      if (navCtx.value) {
         // 计算缩放比例以适应canvas
         const scale = Math.min(180 / img.width, 166 / img.height);
         const width = img.width * scale;
         const height = img.height * scale;
         const x = (180 - width) / 2;
         const y = (166 - height) / 2;

         // 清空并绘制
         navCtx.value.clearRect(0, 0, 180, 166);
         navCtx.value.drawImage(img, x, y, width, height);
      }
   };
   img.src = props.imageList[props.currentIndex].url;
};

// 事件处理函数
const performMove = (e: MouseEvent, useOffset = true) => {
   if (!props.viewer || !thumbnailRef.value) return;

   const rect = thumbnailRef.value.getBoundingClientRect();
   let clickX = e.clientX - rect.left;
   let clickY = e.clientY - rect.top;

   // 如果是拖拽状态，需要减去初始偏移量，保持红框与鼠标相对位置不变
   if (useOffset && isDragging.value) {
      clickX -= dragOffsetX.value;
      clickY -= dragOffsetY.value;
   }

   // 使用与 updateNavigatorView 中一致的计算方法
   const tiledImage = props.viewer.world.getItemAt(0);
   if (!tiledImage) return;

   const imageWidth = tiledImage.source.dimensions.x;
   const imageHeight = tiledImage.source.dimensions.y;
   const aspectRatio = imageWidth / imageHeight;

   // 参考网站逻辑：以 180px 宽度为基准计算比例
   const navImageWidth = 180;
   const navImageHeight = 180 / aspectRatio;

   // 计算偏移量以居中显示在 180x166 容器中
   const navOffsetX = 0;
   const navOffsetY = (166 - navImageHeight) / 2;

   const normalizedX = (clickX - navOffsetX) / navImageWidth;
   const normalizedY = (clickY - navOffsetY) / navImageHeight;

   props.viewer.viewport.panTo(
      new OpenSeadragon.Point(normalizedX, normalizedY),
      true
   );
};

// 鼠标按下事件处理
const handleMouseDown = (e: MouseEvent) => {
   if (!thumbnailRef.value) return;

   const rect = thumbnailRef.value.getBoundingClientRect();
   const mouseX = e.clientX - rect.left;
   const mouseY = e.clientY - rect.top;

   // 获取当前 viewRect 的实时位置和尺寸
   // 优先使用响应式数据
   const vrLeft = parseFloat(viewRectStyle.value.left || '0');
   const vrTop = parseFloat(viewRectStyle.value.top || '0');
   const vrWidth = parseFloat(viewRectStyle.value.width || '0');
   const vrHeight = parseFloat(viewRectStyle.value.height || '0');

   // 计算红框中心点
   const vrCenterX = vrLeft + vrWidth / 2;
   const vrCenterY = vrTop + vrHeight / 2;

   // 判断鼠标是否在红框内
   const isInside =
      mouseX >= vrLeft &&
      mouseX <= vrLeft + vrWidth &&
      mouseY >= vrTop &&
      mouseY <= vrTop + vrHeight;

   if (isInside) {
      isDragging.value = true;
      // 记录点击位置相对于红框中心的偏移量
      dragOffsetX.value = mouseX - vrCenterX;
      dragOffsetY.value = mouseY - vrCenterY;
   } else {
      // 在红框外点击：只跳转，不开启拖动
      isDragging.value = false;
      performMove(e, false); // 跳转时不需要偏移
   }
};

// 鼠标移动事件处理
const handleMouseMove = (e: MouseEvent) => {
   if (!isDragging.value || !props.viewer || !thumbnailRef.value) return;

   const rect = thumbnailRef.value.getBoundingClientRect();
   const mouseX = e.clientX - rect.left;
   const mouseY = e.clientY - rect.top;

   // 1. 检查鼠标是否超出了 thumbnail 容器范围 (180x166)
   if (mouseX < 0 || mouseX > 180 || mouseY < 0 || mouseY > 166) {
      isDragging.value = false;
      return;
   }

   // 执行移动
   performMove(e);
};

// 鼠标释放事件处理
const handleMouseUp = () => {
   isDragging.value = false;
};

onMounted(async () => {
   // 绘制缩略图
   await drawThumbnail();

   // 添加事件监听器
   if (thumbnailRef.value) {
      thumbnailRef.value.addEventListener('mousedown', handleMouseDown);
   }

   window.addEventListener('mousemove', handleMouseMove);
   window.addEventListener('mouseup', handleMouseUp);

   // 初始更新导航视图
   setTimeout(updateNavigatorView, 100);
});

// 监听viewer的变化并添加事件处理器
watch(
   () => props.viewer,
   (newViewer, oldViewer) => {
      // 移除旧的事件监听器
      if (oldViewer) {
         oldViewer.removeHandler('zoom', updateNavigatorView);
         oldViewer.removeHandler('pan', updateNavigatorView);
         oldViewer.removeHandler('open', updateNavigatorView);
      }

      // 添加新的事件监听器
      if (newViewer) {
         newViewer.addHandler('zoom', updateNavigatorView);
         newViewer.addHandler('pan', updateNavigatorView);
         newViewer.addHandler('open', updateNavigatorView); // 当新图像打开时更新
      }
   },
   { immediate: true }
);

// 监听图像索引变化，重新绘制缩略图
watch(
   () => props.currentIndex,
   async () => {
      await drawThumbnail();
   }
);

onUnmounted(() => {
   // 清理viewer事件监听器
   if (props.viewer) {
      props.viewer.removeHandler('zoom', updateNavigatorView);
      props.viewer.removeHandler('pan', updateNavigatorView);
      props.viewer.removeHandler('open', updateNavigatorView);
   }

   // 移除事件监听器
   if (thumbnailRef.value) {
      thumbnailRef.value.removeEventListener('mousedown', handleMouseDown);
   }
   window.removeEventListener('mousemove', handleMouseMove);
   window.removeEventListener('mouseup', handleMouseUp);
});
</script>
