<template>
   <div class="ruler-overlay"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import OpenSeadragon from 'openseadragon';

// 定义props
type Props = {
   viewer: any;
};

const props = withDefaults(defineProps<Props>(), {});

// 响应式数据
const isRulerMode = ref<boolean>(false);
const rulerStartPoint = ref<any>(null);
const rulerEndPoint = ref<any>(null);
const isDrawingRuler = ref<boolean>(false);
const rulerCanvas = ref<HTMLCanvasElement | null>(null);
const rulerCanvasContext = ref<CanvasRenderingContext2D | null>(null);
const rulerMeasurements = ref<any[]>([]);
const pixelPerMicron = ref<number>(0.46);
const rulerLineColor = ref<string>('#FF0000'); // 红色
const rulerTextColor = ref<string>('#FF0000'); // 红色

// OpenSeadragon 事件处理器引用
let _osdRulerAnimationHandler: any = null;
let _osdRulerResizeHandler: any = null;

// 计算两点之间的实际距离（微米）
const calculateDistance = (start: any, end: any): number => {
   if (!start || !end) return 0;
   const dx = end.x - start.x;
   const dy = end.y - start.y;
   const pixelDistance = Math.sqrt(dx * dx + dy * dy);
   return pixelDistance * pixelPerMicron.value; // μm
};

// 设置viewer光标样式
const setViewerCursor = (cursorStyle: string) => {
   if (props.viewer?.element) {
      // props.viewer.element.style.cursor = cursorStyle;
   }
};

// 清除Canvas
const clearRulerCanvas = () => {
   if (
      rulerCanvas.value &&
      props.viewer.container.contains(rulerCanvas.value)
   ) {
      props.viewer.container.removeChild(rulerCanvas.value);
      rulerCanvas.value = null;
      rulerCanvasContext.value = null;
   }
};

// 创建Canvas和距离显示元素
const createRulerCanvas = () => {
   if (rulerCanvas.value) return;

   const viewerElement = props.viewer.container; // 这是 OpenSeadragon 的主容器
   rulerCanvas.value = document.createElement('canvas');
   rulerCanvas.value.width = viewerElement.clientWidth;
   rulerCanvas.value.height = viewerElement.clientHeight;
   rulerCanvas.value.style.position = 'absolute';
   rulerCanvas.value.style.left = '0';
   rulerCanvas.value.style.top = '0';
   rulerCanvas.value.style.pointerEvents = 'none'; // 让鼠标事件穿透
   rulerCanvas.value.style.zIndex = '20'; // 设置高于标注SVG层(z-index: 9)的层级
   viewerElement.appendChild(rulerCanvas.value);
   rulerCanvasContext.value = rulerCanvas.value.getContext('2d');

   // 创建绑定的事件处理器函数，确保可以正确移除
   _osdRulerAnimationHandler = updateRulerCanvas;
   _osdRulerResizeHandler = updateRulerCanvas;

   // 监听视口变化
   props.viewer.addHandler('animation', _osdRulerAnimationHandler);
   props.viewer.addHandler('resize', _osdRulerResizeHandler);
};

// 更新Canvas绘制
const updateRulerCanvas = () => {
   if (!rulerCanvas.value || !rulerCanvasContext.value) return;

   const viewerElement = props.viewer.container;
   rulerCanvas.value.width = viewerElement.clientWidth;
   rulerCanvas.value.height = viewerElement.clientHeight;
   const ctx = rulerCanvasContext.value;
   ctx.clearRect(0, 0, rulerCanvas.value.width, rulerCanvas.value.height);

   // 画所有历史测量
   for (const m of rulerMeasurements.value) {
      const start = props.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(m.startPoint.x, m.startPoint.y)
      );
      const end = props.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(m.endPoint.x, m.endPoint.y)
      );
      ctx.strokeStyle = rulerLineColor.value;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const distanceText =
         m.distance > 1000
            ? (m.distance / 1000).toFixed(2) + 'mm'
            : m.distance.toFixed(2) + 'μm';

      ctx.font = '14px Arial';
      // 绘制文本背景（现在是透明的，所以不绘制矩形框）
      const textWidth = ctx.measureText(distanceText).width;
      // ctx.fillRect(end.x - textWidth / 2 - 4, end.y - 28, textWidth + 8, 22);
      ctx.fillStyle = rulerTextColor.value;
      ctx.fillText(distanceText, end.x - textWidth / 2, end.y - 12);
   }

   // 画当前正在测量的线
   if (isDrawingRuler.value && rulerStartPoint.value && rulerEndPoint.value) {
      const start = props.viewer.viewport.imageToViewerElementCoordinates(
         rulerStartPoint.value
      );
      const end = props.viewer.viewport.imageToViewerElementCoordinates(
         rulerEndPoint.value
      );

      ctx.strokeStyle = rulerLineColor.value;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const distance = calculateDistance(
         rulerStartPoint.value,
         rulerEndPoint.value
      );

      const distanceText =
         distance > 1000
            ? (distance / 1000).toFixed(2) + 'mm'
            : distance.toFixed(2) + 'μm';

      ctx.font = '14px Arial';
      // 绘制文本背景（现在是透明的，所以不绘制矩形框）
      const textWidth = ctx.measureText(distanceText).width;
      // ctx.fillRect(end.x - textWidth / 2 - 4, end.y - 28, textWidth + 8, 22);
      ctx.fillStyle = rulerTextColor.value;
      ctx.fillText(distanceText, end.x - textWidth / 2, end.y - 12);
   }
};

// 清除所有测量
const clearAllMeasurements = () => {
   // 清空测量数组
   rulerMeasurements.value = [];
   console.log('已清除所有测量');
};

// 绑定测量事件监听器
const bindRulerEvents = () => {
   const canvas = props.viewer.canvas;
   canvas.addEventListener('mousedown', handleRulerMouseDown);
   canvas.addEventListener('mousemove', handleRulerMouseMove);
   canvas.addEventListener('mouseup', handleRulerMouseUp);
};

// 解绑测量事件监听器
const unbindRulerEvents = () => {
   const canvas = props.viewer.canvas;
   canvas.removeEventListener('mousedown', handleRulerMouseDown);
   console.log('已移除mousedown事件监听器');
   canvas.removeEventListener('mousemove', handleRulerMouseMove);
   console.log('已移除mousemove事件监听器');
   canvas.removeEventListener('mouseup', handleRulerMouseUp);
   console.log('已移除mouseup事件监听器');

   // 移除OpenSeadragon事件监听器
   if (_osdRulerAnimationHandler) {
      props.viewer.removeHandler('animation', _osdRulerAnimationHandler);
      console.log('已移除OpenSeadragon animation事件监听器');
   }
   if (_osdRulerResizeHandler) {
      props.viewer.removeHandler('resize', _osdRulerResizeHandler);
      console.log('已移除OpenSeadragon resize事件监听器');
   }
};

// 处理鼠标按下事件
const handleRulerMouseDown = (e: MouseEvent) => {
   if (!isRulerMode.value || e.button !== 0) return; // 只处理左键

   const rect = props.viewer.canvas.getBoundingClientRect();
   const x = e.clientX - rect.left;
   const y = e.clientY - rect.top;

   const viewportPoint = props.viewer.viewport.pointFromPixel(
      new OpenSeadragon.Point(x, y)
   );
   const imagePoint =
      props.viewer.viewport.viewportToImageCoordinates(viewportPoint);

   rulerStartPoint.value = imagePoint;
   rulerEndPoint.value = imagePoint;
   isDrawingRuler.value = true;
   createRulerCanvas();
};

// 处理鼠标移动事件
const handleRulerMouseMove = (e: MouseEvent) => {
   if (!isRulerMode.value || !isDrawingRuler.value) return;

   const rect = props.viewer.canvas.getBoundingClientRect();
   const x = e.clientX - rect.left;
   const y = e.clientY - rect.top;

   const viewportPoint = props.viewer.viewport.pointFromPixel(
      new OpenSeadragon.Point(x, y)
   );
   const imagePoint =
      props.viewer.viewport.viewportToImageCoordinates(viewportPoint);

   rulerEndPoint.value = imagePoint;
   updateRulerCanvas();
};

// 处理鼠标释放事件
const handleRulerMouseUp = (e: MouseEvent) => {
   if (!isRulerMode.value || !isDrawingRuler.value || e.button !== 0) return; // 只处理左键

   const rect = props.viewer.canvas.getBoundingClientRect();
   const x = e.clientX - rect.left;
   const y = e.clientY - rect.top;

   const viewportPoint = props.viewer.viewport.pointFromPixel(
      new OpenSeadragon.Point(x, y)
   );
   const imagePoint =
      props.viewer.viewport.viewportToImageCoordinates(viewportPoint);

   rulerEndPoint.value = imagePoint;

   // 计算距离
   const distance = calculateDistance(
      rulerStartPoint.value,
      rulerEndPoint.value
   );

   if (distance >= 0.001) {
      rulerMeasurements.value.push({
         id: 'ruler-' + Date.now(),
         startPoint: { x: rulerStartPoint.value.x, y: rulerStartPoint.value.y },
         endPoint: { x: rulerEndPoint.value.x, y: rulerEndPoint.value.y },
         distance: distance,
      });
   }

   isDrawingRuler.value = false;
   rulerStartPoint.value = null;
   rulerEndPoint.value = null;
   updateRulerCanvas();
};

// 开始尺子测量模式
const startRulerMode = () => {
   // 设置鼠标样式
   setViewerCursor('crosshair');
   // 禁用鼠标导航
   props.viewer.setMouseNavEnabled(false);
   // 屏蔽标注事件（如果存在）
   // 由于 __vue__ 属性不是标准类型，这里使用类型断言或暂时跳过
   try {
      const parentNode: any = props.viewer.container.parentNode;
      if (parentNode.__vue__) {
         const parentComponent = parentNode.__vue__;
         if (parentComponent && parentComponent.annotationEditor) {
            parentComponent.annotationEditor.disableAnnotationEvents();
            console.log('已屏蔽标注事件');
         }
      }
   } catch (e) {
      console.warn('无法访问父组件的标注编辑器:', e);
   }
   // 绑定事件监听器
   bindRulerEvents();
   console.log('进入测量模式');
};

// 停止尺子测量模式
const stopRulerMode = () => {
   console.log('开始停止测量模式');

   // 恢复鼠标样式
   setViewerCursor('default');

   // 恢复鼠标导航
   props.viewer.setMouseNavEnabled(true);

   // 恢复标注事件（如果存在）
   try {
      const parentNode: any = props.viewer.container.parentNode;
      if (parentNode.__vue__) {
         const parentComponent = parentNode.__vue__;
         if (parentComponent && parentComponent.annotationEditor) {
            parentComponent.annotationEditor.enableAnnotationEvents();
            console.log('已恢复标注事件');
         }
      }
   } catch (e) {
      console.warn('无法访问父组件的标注编辑器:', e);
   }

   // 移除事件监听器
   unbindRulerEvents();

   // 移除Canvas
   if (
      rulerCanvas.value &&
      props.viewer.container.contains(rulerCanvas.value)
   ) {
      console.log('移除Canvas');
      props.viewer.container.removeChild(rulerCanvas.value);
      rulerCanvas.value = null;
      rulerCanvasContext.value = null;
   }

   // 移除事件监听
   if (_osdRulerAnimationHandler) {
      props.viewer.removeHandler('animation', _osdRulerAnimationHandler);
      _osdRulerAnimationHandler = null;
   }
   if (_osdRulerResizeHandler) {
      props.viewer.removeHandler('resize', _osdRulerResizeHandler);
      _osdRulerResizeHandler = null;
   }

   // 重置绘制状态
   isDrawingRuler.value = false;
   rulerStartPoint.value = null;
   rulerEndPoint.value = null;

   // 清除所有测量线
   clearAllMeasurements();

   // 确保恢复鼠标导航
   if (props.viewer) {
      props.viewer.setMouseNavEnabled(true);
      console.log('已恢复OpenSeadragon鼠标导航');

      // 强制刷新viewer状态
      props.viewer.forceRedraw();
   }

   console.log('测量模式停止完成');
};

// 切换尺子测量模式
const toggleRulerMode = () => {
   console.log(isRulerMode.value);
   isRulerMode.value = !isRulerMode.value;

   if (isRulerMode.value) {
      // 进入测量模式
      startRulerMode();
   } else {
      // 退出测量模式
      stopRulerMode();
      clearAllMeasurements();
   }
};

// 隐藏尺子功能
const hiddenRuler = () => {
   if (isRulerMode.value) {
      toggleRulerMode();
   }
};

// 监听测量模式状态变化，通知父组件
watch(
   isRulerMode,
   (newVal) => {
      // 向父组件发送测量模式状态变化事件
      // emit('ruler-mode-change', newVal); // 需要在defineEmits中定义
   },
   { immediate: true }
);

// 组件挂载时获取分辨率
onMounted(() => {
   // 如果有store中的分辨率信息，可以在这里设置
   // pixelPerMicron.value = store.state.filmViewer.resolution;
});

// 组件卸载前清理
onUnmounted(() => {
   console.log('rulerMeasure组件即将销毁，清理资源');

   // 如果还在测量模式，先停止
   if (isRulerMode.value) {
      stopRulerMode();
   }

   // 确保移除所有事件监听器
   unbindRulerEvents();

   // 清理Canvas
   clearRulerCanvas();

   console.log('rulerMeasure组件资源清理完成');
});

// 定义emit事件
const emit = defineEmits(['ruler-mode-change']);

// 暴露方法给父组件
defineExpose({
   toggleRulerMode,
   hiddenRuler,
});
</script>

<style scoped lang="scss">
.subviewClass {
   display: flex;
   align-items: center;
   justify-content: center;
   width: 46px;
   height: 46px;
   margin-right: 10px;
   font-size: 14px;
   color: #ffffff;
   cursor: pointer;
   background-color: rgb(40 49 66 / 60%);
   border-radius: 23px;
}
.subviewClass:not(.subviewselectedClass):hover {
   background-color: rgb(40 49 66 / 80%);
}
.subviewselectedClass {
   background-color: rgb(255 0 0 / 70%);

   /* 红色 */
}

/* 与页面其他按钮保持一致的样式 */
.ruler-tool-container {
   display: inline-block;
}
.ruler-toggle-btn {
   display: flex;
   align-items: center;
   justify-content: center;
   width: 2.5rem;
   height: 2.5rem;
   padding: 0.5rem;
   margin-right: 0.75rem;
   cursor: pointer;
   background-color: rgb(255 255 255 / 80%);
   border: none;
   border-radius: 0.5rem;
   transition: background-color 0.2s ease-in-out;
}
.ruler-toggle-btn:hover {
   background-color: rgb(255 255 255 / 100%);
}
.ruler-active {
   background-color: rgb(37 176 229 / 70%);

   /* 红色背景 */
}
.ruler-active:hover {
   background-color: rgb(37 176 229 / 90%);

   /* 更深的红色 */
}
</style>
