<template>
   <div
      element-loading-text="切片加载中..."
      element-loading-background="rgba(255, 255, 255, 0.3)"
      class="h-screen flex flex-col"
   >
      <!-- 顶部工具栏 -->
      <div
         class="bg-gradient-to-r to-indigo-600 text-white p-3 shadow-md relative z-10"
      >
         <div class="flex justify-between items-center">
            <div class="flex min-w-[200px] gap-3">
               <button
                  class="bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 font-medium py-2 px-3 rounded-lg shadow-lg transition duration-200 flex items-center cursor-pointer"
                  @click="toggleSlideList"
               >
                  <ElIcon :size="20">
                     <Document />
                  </ElIcon>
               </button>
               <button
                  v-if="showResetButton"
                  class="bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 font-medium py-2 px-3 rounded-lg shadow-lg transition duration-200 flex items-center cursor-pointer"
                  @click="resetView"
               >
                  <ElIcon :size="20">
                     <Refresh />
                  </ElIcon>
               </button>
               <button
                  class="bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 font-medium py-2 px-3 rounded-lg shadow-lg transition duration-200 flex items-center cursor-pointer"
                  @click="toggleFullScreen"
               >
                  <ElIcon :size="20">
                     <FullScreen />
                  </ElIcon>
               </button>
               <button
                  class="bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 font-medium py-2 px-3 rounded-lg shadow-lg transition duration-200 flex items-center cursor-pointer"
                  :class="{ '!bg-indigo-600 !text-white': isRulerModeActive }"
                  @click="toggleRulerMode"
               >
                  <ElIcon :size="20">
                     <Crop />
                  </ElIcon>
               </button>
               <button
                  class="bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 font-medium py-2 px-3 rounded-lg shadow-lg transition duration-200 flex items-center cursor-pointer"
                  :class="{ '!bg-indigo-600 !text-white': annotationVisible }"
                  @click="toggleAnnotation"
               >
                  <ElIcon :size="20">
                     <Edit />
                  </ElIcon>
               </button>
            </div>

            <!-- 缩放控制区域 -->
            <div class="flex items-center gap-2">
               <div
                  class="flex gap-1 bg-white bg-opacity-80 p-1 rounded-lg shadow-lg"
               >
                  <button
                     v-for="zoom in zoomLevels"
                     :key="zoom.value"
                     class="px-2 py-1 text-xs font-medium rounded text-gray-800 hover:bg-indigo-600 hover:text-white transition-all duration-200 cursor-pointer"
                     @click="setZoomLevel(zoom.value)"
                  >
                     {{ zoom.label }}
                  </button>
               </div>
               <button
                  class="bg-white bg-opacity-80 hover:bg-opacity-100 font-medium py-2 px-3 rounded-lg shadow-lg transition duration-200 flex items-center cursor-pointer"
                  :class="
                     zoomValue > Number(imageInfo.viewInfo.scanRate)
                        ? 'text-red-600'
                        : 'text-gray-800'
                  "
               >
                  {{ zoomValue }}x
               </button>
            </div>

            <!-- <div class="flex space-x-2">
               <button @click="togglePlay"
                  class="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center">
                  <ElIcon :size="18" class="mr-1">
                     <VideoPlay v-if="!isPlaying" />
                     <VideoPause v-else />
                  </ElIcon>
                  {{ isPlaying ? '暂停' : '播放' }}
               </button>

               <div class="flex items-center space-x-2">
                  <span class="text-sm">间隔:</span>
                  <select v-model="playInterval" class="bg-white bg-opacity-20 text-white rounded py-1 px-2 text-sm">
                     <option value="500">0.5秒</option>
                     <option value="1000">1秒</option>
                     <option value="2000">2秒</option>
                     <option value="3000">3秒</option>
                     <option value="5000">5秒</option>
                  </select>
               </div>

               <div class="flex items-center space-x-2">
                  <span class="text-sm">方向:</span>
                  <select v-model="playDirection" class="bg-white bg-opacity-20 text-white rounded py-1 px-2 text-sm">
                     <option value="forward">正向</option>
                     <option value="backward">反向</option>
                  </select>
               </div>
            </div> -->
         </div>
      </div>

      <!-- 切片列表浮动面板 -->
      <transition name="slide-left">
         <DndProvider :backend="HTML5Backend">
            <SlideListPanel
               ref="slideListPanelRef"
               :slide-list-visible="slideListVisible"
               :initial-current-index="0"
               :initial-image-list="imageList"
               @toggle-slide-list="toggleSlideList"
               @prev-image="prevImage"
               @next-image="nextImage"
               @select-image="selectImage"
            />
         </DndProvider>
      </transition>
      <!-- 主图像区域 -->
      <div id="openseadragon1" class="w-full h-full bg-gray-100 relative"></div>
      <!-- 导航视图 -->
      <NavigatorView
         :viewer="viewer"
         :image-list="imageList"
         :current-index="getCurrentIndex"
      />
      <RulerMeasure ref="rulerMeasureRef" :viewer="viewer" />

      <!-- 标注面板 -->
      <AnnotationPanel
         ref="annotationPanelRef"
         :visible="annotationVisible"
         @shape-select="handleShapeSelect"
         @annotation-select="handleAnnotationSelect"
         @annotation-move-start="handleAnnotationMoveStart"
         @annotation-move-save="handleAnnotationMoveSave"
         @annotation-move-cancel="handleAnnotationMoveCancel"
         @annotation-color-change="handleAnnotationColorChange"
         @close="annotationVisible = false"
      />

      <!-- 标注弹窗 -->
      <AnnotationPopup
         :visible="annotationPopupVisible"
         :params="annotationPopupParams"
         @close="annotationPopupVisible = false"
         @delete="handlePopupDelete"
         @edit="handlePopupEdit"
      />

      <ScaleBar
         :rate="String(imageInfo.baseInfo.rate)"
         :calibration="String(imageInfo.baseInfo.calibration)"
         :tile-source-params="{ width: imageInfo.baseInfo.width }"
         :viewer="() => viewer"
      />
   </div>
</template>

<script lang="ts" setup>
import OpenSeadragon from 'openseadragon';
import {
   onMounted,
   onUnmounted,
   ref,
   reactive,
   computed,
   shallowRef,
   watch,
} from 'vue';
import { DndProvider } from 'vue3-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import SlideListPanel from '@/components/SlideListPanel.vue';
import NavigatorView from '@/components/NavigatorView.vue';
import RulerMeasure from '@/components/RulerMeasure.vue';
import ScaleBar from '@/components/ScaleBar.vue';

import { ElIcon } from 'element-plus';
import {
   Document,
   Refresh,
   FullScreen,
   Crop,
   Edit,
} from '@element-plus/icons-vue';
import AnnotationPanel from '@/components/AnnotationPanel.vue';
import AnnotationPopup from '@/components/AnnotationPopup.vue';
import { CanvasAnnotationEditor } from '@/utils/CanvasAnnotationEditor';
import { useAnnotationStore } from '@/store/modules/annotation';

// 图像列表
const imageList = reactive([
   {
      slideName: '切片1',
      adoptedPart: '甲状腺',
      url: '/src/assets/images/slice/1.jpg',
   },
   {
      slideName: '切片2',
      adoptedPart: '甲状腺',
      url: '/src/assets/images/slice/2.jpg',
   },
   {
      slideName: '切片3',
      adoptedPart: '甲状腺',
      url: '/src/assets/images/slice/3.jpg',
   },
   {
      slideName: '切片4',
      adoptedPart: '甲状腺',
      url: '/src/assets/images/slice/4.jpg',
   },
   {
      slideName: '切片5',
      adoptedPart: '甲状腺',
      url: '/src/assets/images/slice/5.jpg',
   },
   {
      slideName: '切片6',
      adoptedPart: '甲状腺',
      url: '/src/assets/images/slice/6.jpg',
   },
]);

// 图像具体信息
const imageInfo = reactive({
   baseInfo: {
      fileId: 'e6e1c5b355e4bd9844731d71bc9da574',
      rate: 20,
      tileSize: 254,
      maxLevel: 14,
      calibration: 0.4672897160053253,
      rotationAngle: 0,
      lense: 20,
      width: 10000,
      height: 9000,
      vender: 'kfb',
   },
   extraInfo: [
      {
         name: '免疫组化',
         value: '否',
      },
      {
         name: '取材部位',
         value: '甲状腺',
      },
   ],
   viewInfo: {
      fileName: '切片示例-006.kfb',
      fileSize: '67(MB)',
      currentRes: '0.467289716005325(μm/Pixel)',
      imagePixel: '14073×13022(px)',
      scanRate: '20',
   },
   userSetting: {
      displayRuler: true,
      displayRate: true,
      displayNav: true,
      navSizePc: 180,
      qpInfoPreference: 1,
   },
   additionalInfoList: [
      {
         type: 'label',
         path: 'https://qp-hz.91360.com:9001/LabelImage/2026/1/label_0dc47649-df91-4294-b57b-9bd2b1fe3b7e.jpg',
      },
      {
         type: 'macro',
         path: 'https://qp-hz.91360.com:9001/OriginalImage/2026/1/macro_6eb7bdb0-2f9f-4c6f-a504-0ff377ce9a7b.jpg',
      },
   ],
   buttonList: {
      caseInfo: true,
      qpInfo: true,
      userSet: true,
      fullPage: true,
      language: true,
      allQps: true,
      exportQp: true,
      screenshots: true,
      mark: true,
      imageAdjust: true,
      auxiliaryDiagnosis: false,
      userSetSave: true,
      autoPlay: true,
      splitScreen: true,
      qrCode: false,
      prostateDiagnosis: false,
      dualScreen: false,
      hideQpNameAndLabel: false,
      replaceQpName: null,
      waterMark: false,
      waterMarkText: null,
      waterMarkColor: null,
      waterMarkFont: null,
      importAnnotations: null,
      keepQpListOpen: null,
      auxiliaryAnalysis: false,
      prostateAnalysis: false,
      lake: '',
      anoTypes: [],
      autoCropWidth: 160,
      cropFix: [4, 3],
      exportAnnotations: true,
   },
   seoInfo: {
      title: '数字病理会诊平台',
      iconUrl: 'https://hz.91360.com/api/media/system/favicon.ico',
      description: '数字病理会诊平台',
   },
   goTrans: false,
   userKey: '',
   isArchived: true,
});

const viewer = shallowRef<any>(null);
let playTimer: any = null;
let initialZoom = 1; // 记录初始缩放级别
let canvasOverlay: HTMLCanvasElement | null = null; // Canvas 覆盖层
let annotationEditor: CanvasAnnotationEditor | null = null; // 标注编辑器实例
let navigatingAnnotationId: string | null = null; // 正在跳转的标注 ID

const slideListPanelRef = ref<InstanceType<typeof SlideListPanel> | null>(null);
const rulerMeasureRef = shallowRef<InstanceType<typeof RulerMeasure> | null>(
   null
);

// 响应式变量
const isPlaying = ref(false);
const playInterval = ref(2000);
const playDirection = ref('forward');
const zoomValue = ref(1);
const zoomPercent = ref(100);
const slideListVisible = ref(false); // 切片列表面板是否可见
const annotationVisible = ref(false); // 标注面板是否可见
const annotationPopupVisible = ref(false); // 标注弹窗是否可见
const annotationPopupParams = ref<any>(null); // 标注弹窗参数
const annotationPanelRef = ref<any>(null);

// 用于追踪标注数量变化
let previousAnnotationCount = 0;

// Store
const annotationStore = useAnnotationStore();

// 缩放倍数级别
const zoomLevels = [
   { label: '1x', value: 1 },
   { label: '2x', value: 2 },
   { label: '4x', value: 4 },
   { label: '10x', value: 10 },
   { label: '20x', value: 20 },
   { label: '40x', value: 40 },
   { label: '1:1', value: 1 }, // 1:1 相当于原始大小
];

// 计算属性:判断是否显示复位按钮
const showResetButton = computed(() => {
   if (!slideListVisible.value || !slideListPanelRef.value) {
      return false;
   }
   // 检查面板是否在初始位置
   const position = slideListPanelRef.value.position;
   return position.x !== 60 || position.y !== 175; // 恢复初始位置判断
});

// 计算属性:判断测量模式是否激活
const isRulerModeActive = computed(() => {
   return rulerMeasureRef.value && rulerMeasureRef.value.isRulerMode;
});

const getCurrentIndex = computed(() => {
   if (slideListPanelRef.value) {
      return slideListPanelRef.value.getCurrentIndex();
   }
   return 0;
});

// 初始化标注功能
const initAnnotation = () => {
   // 创建 Canvas overlay
   if (!canvasOverlay) {
      canvasOverlay = document.createElement('canvas');
      canvasOverlay.setAttribute('id', 'annotation-canvas');
      canvasOverlay.style.position = 'absolute';
      canvasOverlay.style.top = '0';
      canvasOverlay.style.left = '0';
      canvasOverlay.style.width = '100%';
      canvasOverlay.style.height = '100%';
      canvasOverlay.style.pointerEvents = 'none';
      canvasOverlay.style.overflow = 'visible';

      // 尝试多个方式找到正确的容器
      const viewerContainer = document.getElementById('openseadragon1');
      const osdCanvas = document.querySelector('.openseadragon-canvas');

      if (osdCanvas) {
         // 方法 1：添加到 canvas 的父节点
         osdCanvas.parentNode?.appendChild(canvasOverlay);
      } else if (viewerContainer) {
         // 方法 2：直接添加到 viewer 容器
         viewerContainer.appendChild(canvasOverlay);
      } else {
         console.error('无法找到合适的容器添加 Canvas overlay');
         return;
      }
   }

   // 初始化 CanvasAnnotationEditor
   const viewerContainer = document.getElementById('openseadragon1');
   if (canvasOverlay && viewerContainer && viewer.value) {
      // 销毁旧的实例
      if (annotationEditor) {
         annotationEditor.destroy();
      }

      annotationEditor = new CanvasAnnotationEditor();
      annotationEditor.init(canvasOverlay, viewer.value, viewerContainer, {
         allowMulti: annotationStore.isMultiMode,
         onEdit: (annotations) => {
            // 标注更新时的回调
            // 检测是否是新添加的标注（通过长度变化）
            const isNewAnnotation =
               annotations.length > previousAnnotationCount;

            // 更新标注列表
            annotationStore.setAnnotations(annotations);

            // 如果是新添加的标注，且不是连续标注模式
            if (isNewAnnotation && !annotationStore.isMultiMode) {
               // 1. 取消标注列表选中
               annotationStore.setSelectedIndex(null);

               // 2. 取消形状选中
               if (annotationPanelRef.value) {
                  annotationPanelRef.value.resetShapeSelection();
               }
            } else if (isNewAnnotation && annotationStore.isMultiMode) {
               // 如果是新添加的标注，且是连续标注模式
               // 只取消标注列表选中，不取消形状选中，以便继续绘制
               annotationStore.setSelectedIndex(null);
            }

            // 更新计数
            previousAnnotationCount = annotations.length;
         },
         onShowAnnotationPopup: (params) => {
            // 显示标注弹窗
            annotationPopupParams.value = params;
            annotationPopupVisible.value = true;
         },
         onAnnotationSelected: (annotation) => {
            // 标注选中时的回调
            if (annotation) {
               annotationStore.setSelectedIndex(
                  annotationStore.annotations.findIndex(
                     (a) => a.id === annotation.id
                  )
               );
            } else {
               annotationStore.setSelectedIndex(null);
            }
         },
      });

      // 设置初始颜色
      annotationEditor.setCurrentColor(annotationStore.currentColor);
   }
};

// 初始化OpenSeadragon
const initOpenSeadragon = () => {
   if (viewer.value) {
      viewer.value.destroy();
   }

   // 创建一个函数来根据视口边界设置拖动控制
   const updatePanControls = () => {
      const bounds = viewer.value.viewport.getBounds();

      // 计算当前视口的宽高相对于图像的比例
      // 当视口边界小于图像边界时，表示图像比视口大，可以拖动
      const isViewSmallerThanImageHorizontally =
         bounds.x > 0 || bounds.x + bounds.width < 1;
      const isViewSmallerThanImageVertically =
         bounds.y > 0 || bounds.y + bounds.height < 1;

      // 当视口完全包含在图像内部时（红框小于导航视图范围），允许上下左右拖动
      if (
         isViewSmallerThanImageHorizontally &&
         isViewSmallerThanImageVertically
      ) {
         viewer.value.panHorizontal = true;
         viewer.value.panVertical = true;
      }
      // 当视口在某一个维度上与图像相等时（红框刚好等于导航视图范围），只允许另一个维度拖动
      else if (isViewSmallerThanImageHorizontally) {
         // 水平方向上视口小于图像，允许水平拖动
         viewer.value.panHorizontal = true;
         viewer.value.panVertical = false; // 垂直方向已满，不允许垂直拖动
      } else if (isViewSmallerThanImageVertically) {
         // 垂直方向上视口小于图像，允许垂直拖动
         viewer.value.panHorizontal = false; // 水平方向已满，不允许水平拖动
         viewer.value.panVertical = true;
      } else {
         // 当视口超出图像边界时（红框大于导航视图范围），不允许拖动
         viewer.value.panHorizontal = false;
         viewer.value.panVertical = false;
      }
   };

   viewer.value = OpenSeadragon({
      id: 'openseadragon1',
      showNavigationControl: false,
      prefixUrl: '/src/assets/images/openseadragon/',
      tileSources: getCurrentTileSource(),

      // tileSources: '/assets/kfb_cells_10000.dzi',
      // 添加缩放事件监听
      zoomPerClick: 1.2,
      visibilityRatio: 0.1,
      constrainDuringPan: true, // 启用缩放和平移期间的约束
      minZoomLevel: 0.01,
      gestureSettingsMouse: {
         clickToZoom: false, // 禁用鼠标单击
         dblClickToZoom: false, // 禁用默认双击缩放
         zoomToRefPoint: true, // 默认以鼠标为中心缩放
      },
      // 关闭原生Navigator，使用自定义导航视图
      showNavigator: false,
   });

   // 自定义双击事件处理，实现第一次双击放大到4x，第二次双击放大到20x，之后不再响应双击缩放
   viewer.value.addHandler('canvas-double-click', function () {
      console.log('initialZoom', zoomValue.value);
      if (
         zoomValue.value === 1 ||
         zoomValue.value < 4 ||
         (zoomValue.value <= 20 && zoomValue.value > 4)
      ) {
         viewer.value.viewport.zoomTo(initialZoom * 4);
         console.log('55', zoomValue.value);
      } else if (zoomValue.value === 4 || zoomValue.value > 20) {
         viewer.value.viewport.zoomTo(initialZoom * 20);
      }
   });

   // 等待图片加载完成后记录初始zoom值并设置动态约束
   viewer.value.addHandler('open', function () {
      initialZoom = viewer.value.viewport.getHomeZoom(); // 获取初始适配视口的zoom值

      // 动态设置最大缩放：倍数(80x) * 初始zoom
      const maxMultiplier = Number(imageInfo.viewInfo.scanRate) * 4;
      viewer.value.viewport.maxZoomLevel = initialZoom * maxMultiplier;
      // 允许缩小到 0.1x
      viewer.value.viewport.minZoomLevel = initialZoom * 0.1;

      // 初始时根据当前缩放级别设置zoomToRefPoint
      const currentMultiplier = viewer.value.viewport.getZoom() / initialZoom;
      if (currentMultiplier < 1) {
         viewer.value.gestureSettingsMouse.zoomToRefPoint = false; // 以画布为中心缩放
      } else {
         viewer.value.gestureSettingsMouse.zoomToRefPoint = true; // 以鼠标位置为中心缩放
      }

      // 根据导航视图中红框大小设置初始拖动状态
      updatePanControls();

      // 初始更新导航视图
      // 注意：现在通过 NavigatorView 组件内部处理

      // 初始化标注功能
      initAnnotation();
   });

   // 监听缩放变化
   viewer.value.addHandler('zoom', function () {
      const currentZoom = viewer.value.viewport.getZoom();
      // 计算相对于初始zoom的倍数
      const actualMultiplier = initialZoom > 0 ? currentZoom / initialZoom : 1;

      zoomValue.value = Math.round(actualMultiplier * 10) / 10; // 保留一位小数
      zoomPercent.value = Math.round(actualMultiplier * 100);

      // 当缩放比例小于1:1时，动态调整zoomToRefPoint设置以实现画布中心缩放
      if (actualMultiplier < 1) {
         viewer.value.gestureSettingsMouse.zoomToRefPoint = false; // 以画布为中心缩放
      } else {
         viewer.value.gestureSettingsMouse.zoomToRefPoint = true; // 以鼠标位置为中心缩放
      }

      // 动态控制拖动功能：根据导航视图中红框大小来判断
      updatePanControls();

      // 如果缩放到足够小，强制居中
      if (actualMultiplier < 1) {
         // 应用约束以确保图像在视口范围内
         viewer.value.viewport.applyConstraints(true);
      }
   });

   // 监听缩放结束事件，处理居中逻辑
   viewer.value.addHandler('zoom-end', function () {
      const currentZoom = viewer.value.viewport.getZoom();
      // 计算相对于初始zoom的倍数
      const actualMultiplier = initialZoom > 0 ? currentZoom / initialZoom : 1;

      // 当缩放比例小于1:1时，动态调整zoomToRefPoint设置以实现画布中心缩放
      if (actualMultiplier < 1) {
         viewer.value.gestureSettingsMouse.zoomToRefPoint = false; // 以画布为中心缩放
      } else {
         viewer.value.gestureSettingsMouse.zoomToRefPoint = true; // 以鼠标位置为中心缩放
      }

      // 动态控制拖动功能：根据导航视图中红框大小来判断
      updatePanControls();

      // 当缩放到足够小时（小于1:1），自动居中
      if (actualMultiplier < 1) {
         // 当缩放到小于1:1时自动居中
         // 延迟执行居中操作，确保约束已应用
         setTimeout(() => {
            viewer.value.viewport.goHome(true); // 平滑移动到居中位置
         }, 50);
      }
   });

   // 监听位置变化
   viewer.value.addHandler('pan', function () {
      // 当缩放倍数小于1且位置偏离中心时，适当约束位置
      const currentZoom = viewer.value.viewport.getZoom();
      const actualMultiplier = initialZoom > 0 ? currentZoom / initialZoom : 1;

      if (actualMultiplier < 1) {
         // 应用约束以确保图像不会完全移出视野
         viewer.value.viewport.applyConstraints(true);
      }
   });

   // 监听动画事件，更新 popup 位置使其跟随标注图形
   viewer.value.addHandler('animation', function () {
      if (
         annotationEditor &&
         annotationPopupVisible.value &&
         annotationPopupParams.value?.annotation
      ) {
         annotationEditor.showPopupForAnnotation(
            annotationPopupParams.value.annotation.id
         );
      }
   });

   // 监听动画完成事件，清除跳转标注标记
   viewer.value.addHandler('animation-finish', function () {
      navigatingAnnotationId = null;
   });
};

// 切换到上一张图片
const prevImage = () => {
   if (slideListPanelRef.value) {
      const currentIndex = slideListPanelRef.value.getCurrentIndex();
      if (currentIndex > 0) {
         slideListPanelRef.value.setCurrentIndex(currentIndex - 1);
         initOpenSeadragon();
      }
   }
};

// 切换到下一张图片
const nextImage = () => {
   if (slideListPanelRef.value) {
      const currentIndex = slideListPanelRef.value.getCurrentIndex();
      if (currentIndex < imageList.length - 1) {
         slideListPanelRef.value.setCurrentIndex(currentIndex + 1);
         initOpenSeadragon();
      }
   }
};

// 选择特定图片
const selectImage = (index: number) => {
   if (slideListPanelRef.value) {
      slideListPanelRef.value.setCurrentIndex(index);
      initOpenSeadragon();
   }
};

// 播放/暂停
const togglePlay = () => {
   isPlaying.value = !isPlaying.value;

   if (isPlaying.value) {
      startPlay();
   } else {
      stopPlay();
   }
};

// 开始播放
const startPlay = () => {
   if (playTimer) clearInterval(playTimer);

   playTimer = setInterval(() => {
      if (slideListPanelRef.value) {
         const currentIndex = slideListPanelRef.value.getCurrentIndex();
         let newIndex;
         if (playDirection.value === 'forward') {
            newIndex = (currentIndex + 1) % imageList.length;
         } else {
            newIndex = (currentIndex - 1 + imageList.length) % imageList.length;
         }
         slideListPanelRef.value.setCurrentIndex(newIndex);
         initOpenSeadragon();
      }
   }, playInterval.value);
};

// 停止播放
const stopPlay = () => {
   if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
   }
};

// 设置缩放倍数级别
const setZoomLevel = (level: number) => {
   if (viewer.value && initialZoom > 0) {
      // 根据倍数和初始zoom值计算目标zoom
      // 例如: 如果初始zoom是0.5, 要达到2倍, 目标zoom应该是0.5 * 2 = 1.0
      const targetZoom = initialZoom * level;
      viewer.value.viewport.zoomTo(targetZoom);
      viewer.value.viewport.applyConstraints();
      zoomValue.value = level;
      zoomPercent.value = level * 100;
   }
};

// 切换切片列表面板显示/隐藏
const toggleSlideList = () => {
   slideListVisible.value = !slideListVisible.value;
};

// 切换测量尺模式
const toggleRulerMode = () => {
   if (rulerMeasureRef.value) {
      // 在切换模式前，先取消当前的绘制状态和选中状态
      if (annotationEditor) {
         annotationEditor.cancelDraw();
         annotationEditor.clearSelection();
         console.log('切换测量模式前，已取消绘制状态和选中状态');
      }

      // 清除 store 中的选中状态
      annotationStore.setSelectedIndex(null);

      // 重置标注面板中的形状选择状态
      if (annotationPanelRef.value) {
         annotationPanelRef.value.resetShapeSelection();
      }

      // 先调用子组件的切换方法
      rulerMeasureRef.value.toggleRulerMode();

      // 现在检查切换后的状态并相应地启用/禁用标注事件
      if (!rulerMeasureRef.value.isRulerMode) {
         // 切换后不是测量模式，说明退出了测量模式，恢复标注事件
         if (annotationEditor) {
            annotationEditor.enableEvents();
            console.log('测量模式退出，已恢复标注事件');
         }
      } else {
         // 切换后是测量模式，说明进入了测量模式，禁用标注事件
         if (annotationEditor) {
            annotationEditor.disableEvents();
            console.log('测量模式进入，已禁用标注事件');
         }
      }
   }
};

// 切换标注面板
const toggleAnnotation = () => {
   annotationVisible.value = !annotationVisible.value;
   // 如果关闭标注面板，取消当前的绘制状态
   if (!annotationVisible.value && annotationEditor) {
      annotationEditor.cancelDraw();
      console.log('关闭标注面板，已取消绘制状态');
   }
};

// 标注相关方法
const handleShapeSelect = (type: any) => {
   // 如果当前在测量模式，先退出测量模式
   if (rulerMeasureRef.value && rulerMeasureRef.value.isRulerMode) {
      console.log('检测到测量模式，退出测量模式');
      // 调用父组件的切换方法，确保事件正确恢复
      toggleRulerMode();
   }

   // 关闭现有 popup
   annotationPopupVisible.value = false;
   if (annotationEditor) {
      // 如果是正方形，传递尺寸参数
      if (type === 'square') {
         annotationEditor.setDrawType(type, annotationStore.squareSize);
      } else {
         annotationEditor.setDrawType(type);
      }
      // 同步颜色到AnnotationEditor
      annotationEditor.setCurrentColor(annotationStore.currentColor);
   }
};

// 监听store颜色变化并同步到AnnotationEditor
watch(
   () => annotationStore.currentColor,
   (newColor) => {
      if (annotationEditor) {
         annotationEditor.setCurrentColor(newColor);
      }
   }
);

// 监听连续标注模式变化并同步到AnnotationEditor
watch(
   () => annotationStore.isMultiMode,
   (newVal) => {
      if (annotationEditor) {
         annotationEditor.setAllowMulti(newVal);
         console.log('连续标注模式已更新:', newVal);
      }
   }
);

const handleAnnotationSelect = (annotation: any) => {
   console.log('选择标注:', annotation);

   if (annotationEditor && annotation && viewer.value) {
      // 获取标注的图像坐标中心点
      const center = annotationEditor.getAnnotationCenter(annotation.id);
      if (center) {
         // 将图像坐标转换为视口坐标
         const viewportPoint = viewer.value.viewport.imageToViewportCoordinates(
            new OpenSeadragon.Point(center.x, center.y)
         );

         // 设置正在跳转的标注 ID，用于动画过程中更新 popup 位置
         navigatingAnnotationId = annotation.id;

         // 平滑移动到标注位置（false 表示使用动画过渡）
         viewer.value.viewport.panTo(viewportPoint, false);

         // 立即显示 popup
         annotationEditor.showPopupForAnnotation(annotation.id);
      }
   }
};

const handleAnnotationMoveStart = (annotation: any) => {
   // 进入标注移动模式
   if (annotationEditor && annotation) {
      // 关闭标注信息弹窗
      annotationPopupVisible.value = false;
      annotationEditor.startMoveAnnotation(annotation.id);
   }
};

const handleAnnotationMoveSave = (annotation: any) => {
   // 保存标注移动
   if (annotationEditor && annotation) {
      annotationEditor.saveMoveAnnotation();
   }
};

const handleAnnotationMoveCancel = () => {
   // 取消标注移动
   if (annotationEditor) {
      annotationEditor.cancelMoveAnnotation();
   }
};

const handleAnnotationColorChange = () => {
   // 标注颜色改变，重新渲染
   if (annotationEditor) {
      annotationEditor.render();
   }
};

const handlePopupDelete = () => {
   if (annotationPopupParams.value?.annotation && annotationEditor) {
      annotationEditor.deleteAnnotation(
         annotationPopupParams.value.annotation.id
      );
   }
   annotationPopupVisible.value = false;
};

const handlePopupEdit = (annotation: any) => {
   // 进入标注移动模式
   if (annotationEditor && annotation) {
      // 关闭标注信息弹窗
      annotationPopupVisible.value = false;
      annotationEditor.startMoveAnnotation(annotation.id);
   }
};

// 复位切片列表
const resetView = () => {
   // 重置切片列表面板到初始位置
   if (slideListPanelRef.value) {
      slideListPanelRef.value.resetPosition();
   }
};

// 切换全屏模式
const toggleFullScreen = () => {
   if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
         console.error(`进入全屏模式失败: ${err.message}`);
      });
   } else {
      if (document.exitFullscreen) {
         document.exitFullscreen();
      }
   }
};

// 根据文件扩展名获取适当的tileSources配置
const getCurrentTileSource = () => {
   const currentIndex = slideListPanelRef.value
      ? slideListPanelRef.value.getCurrentIndex()
      : 0;
   const currentImage = imageList[currentIndex];
   if (currentIndex === 0) {
      // 第一张切片直接返回URL字符串
      return '/assets/kfb_cells_10000.dzi';
   } else {
      // 对于普通图像文件，返回对象格式
      return {
         type: 'image',
         url: currentImage.url,
      };
   }
};

// 处理键盘缩放快捷键
const handleKeyDown = (event: KeyboardEvent) => {
   const key = event.key.toLowerCase();
   const zoomMap: Record<string, number> = {
      q: 2,
      w: 4,
      e: 10,
      r: 20,
      t: 40,
   };

   if (zoomMap[key]) {
      setZoomLevel(zoomMap[key]);
   }
};

onMounted(() => {
   initOpenSeadragon();
   window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
   if (viewer.value) {
      viewer.value.destroy();
      viewer.value = null;
   }

   if (annotationEditor) {
      annotationEditor.destroy();
      annotationEditor = null;
   }

   if (canvasOverlay && canvasOverlay.parentNode) {
      canvasOverlay.parentNode.removeChild(canvasOverlay);
      canvasOverlay = null;
   }

   if (playTimer) {
      clearInterval(playTimer);
   }

   window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
/* 过渡动画 */
.slide-enter-active,
.slide-leave-active {
   transition: transform 0.3s ease;
}
.slide-enter-from {
   transform: translateX(-100%);
}
.slide-leave-to {
   transform: translateX(-100%);
}
.slide-left-enter-active,
.slide-left-leave-active {
   transition: transform 0.3s ease;
}
.slide-left-enter-from {
   transform: translateX(-100%);
}
.slide-left-leave-to {
   transform: translateX(-100%);
}
</style>
