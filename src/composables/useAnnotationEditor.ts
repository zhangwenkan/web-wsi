import OpenSeadragon from 'openseadragon';
import { ref } from 'vue';
import type {
   Annotation,
   AnnotationEditorOptions,
   AnnotationType,
   PopupParams,
   MarkerParams,
   LineParams,
   CircleParams,
   EllipseParams,
   RectParams,
   SquareParams,
   PolygonParams,
   FreehandParams,
} from '@/types/annotation';

/**
 * Vue3 Composable 版本的 Canvas 标注编辑器
 * 将 Class 改写为 Composable，使用 ref 管理状态
 */
export function useAnnotationEditor() {
   // ============ 响应式状态 ============

   // Canvas 覆盖层
   const canvas = ref<HTMLCanvasElement | null>(null);
   const ctx = ref<CanvasRenderingContext2D | null>(null);

   // OpenSeadragon viewer 实例
   const viewer = ref<any>(null);

   // Viewer 容器
   const viewerContainer = ref<HTMLElement | null>(null);

   // 标注列表
   const annotations = ref<Annotation[]>([]);

   // 配置选项
   const options = ref<AnnotationEditorOptions>({});

   // 当前颜色
   const currentColor = ref('#ff0000');

   // 当前绘制类型
   const currentType = ref<AnnotationType | null>(null);

   // 是否正在绘制
   const drawing = ref(false);

   // 下一个ID
   const nextId = ref(1);

   // 正方形尺寸
   const squareSize = ref(256);

   // 是否允许多次标注
   const allowMulti = ref(true);

   // 绘制临时变量
   const markerPosition = ref<{ x: number; y: number } | null>(null);
   const lineStart = ref<{ x: number; y: number } | null>(null);
   const lineEnd = ref<{ x: number; y: number } | null>(null);
   const circleCenter = ref<{ x: number; y: number } | null>(null);
   const circleRadius = ref<number | null>(null);
   const ellipseCenter = ref<{ x: number; y: number } | null>(null);
   const ellipseRadiusX = ref<number | null>(null);
   const ellipseRadiusY = ref<number | null>(null);
   const rectStart = ref<{ x: number; y: number } | null>(null);
   const rectWidth = ref<number | null>(null);
   const rectHeight = ref<number | null>(null);
   const squareStart = ref<{ x: number; y: number } | null>(null);
   const polygonPoints = ref<Array<{ x: number; y: number }>>([]);
   const freehandPoints = ref<Array<{ x: number; y: number }>>([]);

   // 多边形预览鼠标位置
   const polygonPreviewPoint = ref<{ x: number; y: number } | null>(null);

   // 当前选中的标注ID
   const selectedAnnotationId = ref<string | null>(null);

   // 移动标注相关
   const movingAnnotationId = ref<string | null>(null);
   const isDragging = ref(false);
   const movingAnnotationOffset = ref<{ x: number; y: number } | null>(null);
   const originalAnnotationData = ref<any>(null);

   // 事件处理器绑定
   let handleMouseDownBound: any = null;
   let handleMouseMoveBound: any = null;
   let handleMouseUpBound: any = null;
   let handleDoubleClickBound: any = null;
   let handleKeyDownBound: any = null;
   let handleWheelBound: any = null;
   let handleViewerMouseMoveBound: any = null;
   let renderHandler: any = null;

   // 渲染请求标志（用于节流）
   let renderRequested = false;

   // 控制点相关
   const controlPoints = ref<
      Array<{ x: number; y: number; type: string; index?: number }>
   >([]);
   const activeControlPoint = ref<number | null>(null);
   const isDraggingControlPoint = ref(false);
   const draggingControlPointInfo = ref<{
      type: string;
      index?: number;
   } | null>(null);
   const ellipseOriginalRatio = ref(1);

   // ============ 初始化和销毁 ============

   const init = (
      canvasOverlay: HTMLCanvasElement,
      viewerInstance: any,
      container: HTMLElement,
      opts: AnnotationEditorOptions = {}
   ) => {
      canvas.value = canvasOverlay;
      ctx.value = canvasOverlay.getContext('2d');
      viewer.value = viewerInstance;
      viewerContainer.value = container;

      options.value = opts;
      allowMulti.value = opts.allowMulti !== undefined ? opts.allowMulti : true;
      currentColor.value = '#ff0000';
      currentType.value = null;
      drawing.value = false;

      // 创建事件处理器绑定
      renderHandler = () => render();
      handleMouseDownBound = handleMouseDown;
      handleMouseMoveBound = handleMouseMove;
      handleMouseUpBound = handleMouseUp;
      handleDoubleClickBound = handleDoubleClick;
      handleKeyDownBound = handleKeyDown;
      handleWheelBound = handleWheel;
      handleViewerMouseMoveBound = handleViewerMouseMove;

      // 绑定 OpenSeadragon 事件
      viewer.value.addHandler('animation', renderHandler);
      viewer.value.addHandler('resize', renderHandler);

      // 绑定 Canvas 事件
      canvas.value.addEventListener('mousedown', handleMouseDownBound);
      canvas.value.addEventListener('mousemove', handleMouseMoveBound);
      canvas.value.addEventListener('mouseup', handleMouseUpBound);
      canvas.value.addEventListener('dblclick', handleDoubleClickBound);
      canvas.value.addEventListener('wheel', handleWheelBound, {
         passive: false,
      });

      // 绑定 viewerContainer 的鼠标移动事件
      viewerContainer.value.addEventListener(
         'mousemove',
         handleViewerMouseMoveBound
      );

      // 绑定键盘事件
      document.addEventListener('keydown', handleKeyDownBound);

      // 初始化 Canvas 大小
      resizeCanvas();

      // 初始化 pointerEvents 为 none
      canvas.value.style.pointerEvents = 'none';

      // 初始渲染
      render();
   };

   const destroy = () => {
      if (viewer.value) {
         viewer.value.removeHandler('animation', renderHandler);
         viewer.value.removeHandler('resize', renderHandler);
      }

      if (canvas.value) {
         canvas.value.removeEventListener('mousedown', handleMouseDownBound);
         canvas.value.removeEventListener('mousemove', handleMouseMoveBound);
         canvas.value.removeEventListener('mouseup', handleMouseUpBound);
         canvas.value.removeEventListener('dblclick', handleDoubleClickBound);
         canvas.value.removeEventListener('wheel', handleWheelBound);
      }

      if (viewerContainer.value) {
         viewerContainer.value.removeEventListener(
            'mousemove',
            handleViewerMouseMoveBound
         );
      }

      document.removeEventListener('keydown', handleKeyDownBound);

      // 清理引用
      canvas.value = null;
      ctx.value = null;
      viewer.value = null;
      annotations.value = [];
   };

   // ============ 公共方法 ============

   const setAnnotations = (list: Annotation[]) => {
      annotations.value = list;
      selectedAnnotationId.value = null;
      render();
   };

   const clearSelection = () => {
      selectedAnnotationId.value = null;
      render();
   };

   const addAnnotation = (annotation: Annotation) => {
      annotations.value.push(annotation);
      render();

      if (options.value.onEdit) {
         options.value.onEdit(annotations.value);
      }
   };

   const deleteAnnotation = (id: string) => {
      const index = annotations.value.findIndex((a) => a.id === id);
      if (index !== -1) {
         annotations.value.splice(index, 1);
         if (selectedAnnotationId.value === id) {
            selectedAnnotationId.value = null;
         }
         render();
         if (options.value.onEdit) {
            options.value.onEdit(annotations.value);
         }
      }
   };

   const startMoveAnnotation = (id: string) => {
      const annotation = annotations.value.find((a) => a.id === id);
      if (annotation) {
         movingAnnotationId.value = id;
         originalAnnotationData.value = JSON.parse(JSON.stringify(annotation));

         if (canvas.value) {
            canvas.value.style.pointerEvents = 'auto';
         }

         setCursor('move');
         render();

         // 通知外部显示工具栏
         if (options.value.onMoveToolbarShow) {
            const boundingBox = getShapeBoundingBox(id);
            if (boundingBox) {
               options.value.onMoveToolbarShow({
                  left: boundingBox.left + boundingBox.width / 2,
                  top: boundingBox.bottom + 8,
               });
            }
         }
      }
   };

   const saveMoveAnnotation = () => {
      if (movingAnnotationId.value) {
         movingAnnotationId.value = null;
         originalAnnotationData.value = null;

         if (canvas.value) {
            canvas.value.style.pointerEvents = 'none';
         }

         setCursor('default');

         // 通知外部隐藏工具栏
         if (options.value.onMoveToolbarHide) {
            options.value.onMoveToolbarHide();
         }

         render();

         if (options.value.onEdit) {
            options.value.onEdit(annotations.value);
         }
      }
   };

   const cancelMoveAnnotation = () => {
      if (movingAnnotationId.value && originalAnnotationData.value) {
         const index = annotations.value.findIndex(
            (a) => a.id === movingAnnotationId.value
         );
         if (index !== -1) {
            annotations.value[index] = originalAnnotationData.value;
         }

         movingAnnotationId.value = null;
         originalAnnotationData.value = null;

         if (canvas.value) {
            canvas.value.style.pointerEvents = 'none';
         }

         setCursor('default');

         // 通知外部隐藏工具栏
         if (options.value.onMoveToolbarHide) {
            options.value.onMoveToolbarHide();
         }

         render();
      }
   };

   const setCurrentColor = (color: string) => {
      currentColor.value = color;
   };

   const setDrawType = (type: AnnotationType, size = 256) => {
      currentType.value = type;
      setCursor('crosshair');

      drawing.value = false;

      if (canvas.value) {
         canvas.value.style.pointerEvents = 'auto';
      }

      if (type === 'marker') {
         markerPosition.value = null;
      } else if (type === 'line') {
         lineStart.value = null;
         lineEnd.value = null;
      } else if (type === 'circle') {
         circleCenter.value = null;
         circleRadius.value = null;
      } else if (type === 'ellipse') {
         ellipseCenter.value = null;
         ellipseRadiusX.value = null;
         ellipseRadiusY.value = null;
      } else if (type === 'rect') {
         rectStart.value = null;
         rectWidth.value = null;
         rectHeight.value = null;
      } else if (type === 'square') {
         squareSize.value = size;
         squareStart.value = null;
      } else if (type === 'polygon') {
         polygonPoints.value = [];
         polygonPreviewPoint.value = null;
      } else if (type === 'freehand') {
         freehandPoints.value = [];
      }
   };

   const cancelDraw = () => {
      currentType.value = null;
      drawing.value = false;
      setViewPortEnable();
      setCursor('default');

      if (canvas.value) {
         canvas.value.style.pointerEvents = 'none';
      }

      markerPosition.value = null;
      lineStart.value = null;
      lineEnd.value = null;
      circleCenter.value = null;
      circleRadius.value = null;
      ellipseCenter.value = null;
      ellipseRadiusX.value = null;
      ellipseRadiusY.value = null;
      rectStart.value = null;
      rectWidth.value = null;
      rectHeight.value = null;
      squareStart.value = null;
      polygonPoints.value = [];
      polygonPreviewPoint.value = null;
      freehandPoints.value = [];
   };

   const showPopupForAnnotation = (annotationId: string): void => {
      const annotation = annotations.value.find((a) => a.id === annotationId);
      if (!annotation) return;

      selectedAnnotationId.value = annotationId;
      render();

      switch (annotation.type) {
         case 'marker':
            showAnnotationPopupForMarker(annotation);
            break;
         case 'line':
            showAnnotationPopupForLine(annotation);
            break;
         case 'circle':
            showAnnotationPopupForCircle(annotation);
            break;
         case 'ellipse':
            showAnnotationPopupForEllipse(annotation);
            break;
         case 'rect':
            showAnnotationPopupForRect(annotation);
            break;
         case 'square':
            showAnnotationPopupForSquare(annotation);
            break;
         case 'polygon':
            showAnnotationPopupForPolygon(annotation);
            break;
         case 'freehand':
            showAnnotationPopupForFreehand(annotation);
            break;
      }
   };

   const getAnnotationCenter = (
      annotationId: string
   ): { x: number; y: number } | null => {
      const annotation = annotations.value.find((a) => a.id === annotationId);
      if (!annotation) return null;

      const params = annotation.params as any;

      switch (annotation.type) {
         case 'marker':
            return { x: params.x, y: params.y };
         case 'line':
            return {
               x: (params.x1 + params.x2) / 2,
               y: (params.y1 + params.y2) / 2,
            };
         case 'circle':
            return { x: params.cx, y: params.cy };
         case 'ellipse':
            return { x: params.cx, y: params.cy };
         case 'rect':
            return {
               x: params.x + params.width / 2,
               y: params.y + params.height / 2,
            };
         case 'square':
            return {
               x: params.x + params.side / 2,
               y: params.y + params.side / 2,
            };
         case 'polygon':
         case 'freehand': {
            const points = params.points || [];
            if (points.length === 0) return null;
            const centerX =
               points.reduce(
                  (sum: number, p: { x: number; y: number }) => sum + p.x,
                  0
               ) / points.length;
            const centerY =
               points.reduce(
                  (sum: number, p: { x: number; y: number }) => sum + p.y,
                  0
               ) / points.length;
            return { x: centerX, y: centerY };
         }
         default:
            return null;
      }
   };

   const disableEvents = () => {
      if (canvas.value) {
         canvas.value.removeEventListener('mousedown', handleMouseDownBound);
         canvas.value.removeEventListener('mousemove', handleMouseMoveBound);
         canvas.value.removeEventListener('mouseup', handleMouseUpBound);
         canvas.value.style.pointerEvents = 'none';
      }
   };

   const enableEvents = () => {
      handleMouseDownBound = handleMouseDown;
      handleMouseMoveBound = handleMouseMove;
      handleMouseUpBound = handleMouseUp;

      if (canvas.value) {
         canvas.value.addEventListener('mousedown', handleMouseDownBound);
         canvas.value.addEventListener('mousemove', handleMouseMoveBound);
         canvas.value.addEventListener('mouseup', handleMouseUpBound);
         canvas.value.style.pointerEvents = 'none';
      }
   };

   const setAllowMulti = (allow: boolean) => {
      allowMulti.value = allow;
   };

   const setCursor = (cursorStyle: string) => {
      if (canvas.value) {
         canvas.value.style.cursor = cursorStyle;
      }
   };

   const setViewPortDisable = () => {
      if (viewer.value) {
         viewer.value.panHorizontal = false;
         viewer.value.panVertical = false;
      }
   };

   const setViewPortEnable = () => {
      if (viewer.value) {
         viewer.value.panHorizontal = true;
         viewer.value.panVertical = true;
      }
   };

   const render = () => {
      if (!canvas.value || !ctx.value) return;

      const { width, height } = canvas.value;

      ctx.value.setTransform(1, 0, 0, 1, 0, 0);
      ctx.value.clearRect(0, 0, width, height);

      // 渲染所有标注
      annotations.value.forEach((annotation) => {
         const isSelected = annotation.id === selectedAnnotationId.value;
         switch (annotation.type) {
            case 'marker':
               renderMarker(annotation);
               break;
            case 'line':
               renderLine(annotation);
               break;
            case 'circle':
               renderCircle(annotation, isSelected);
               break;
            case 'ellipse':
               renderEllipse(annotation, isSelected);
               break;
            case 'rect':
               renderRect(annotation, isSelected);
               break;
            case 'square':
               renderSquare(annotation, isSelected);
               break;
            case 'polygon':
               renderPolygon(annotation, isSelected);
               break;
            case 'freehand':
               renderFreehand(annotation, isSelected);
               break;
         }
      });

      // 渲染预览图形
      if (drawing.value) {
         renderPreview();
      }

      // 渲染控制点
      if (movingAnnotationId.value) {
         calculateControlPoints();
         renderControlPoints();
      }

      // 更新工具栏位置
      if (movingAnnotationId.value && options.value.onMoveToolbarUpdate) {
         const boundingBox = getShapeBoundingBox(movingAnnotationId.value);
         if (boundingBox) {
            options.value.onMoveToolbarUpdate({
               left: boundingBox.left + boundingBox.width / 2,
               top: boundingBox.bottom + 8,
            });
         }
      }
   };

   // ============ 私有方法 ============

   const resizeCanvas = () => {
      if (!canvas.value || !viewerContainer.value) return;

      const rect = viewerContainer.value.getBoundingClientRect();
      canvas.value.width = rect.width;
      canvas.value.height = rect.height;

      render();
   };

   const requestRender = () => {
      if (!renderRequested) {
         renderRequested = true;
         requestAnimationFrame(() => {
            render();
            renderRequested = false;
         });
      }
   };

   const getImagePoint = (event: MouseEvent): { x: number; y: number } => {
      if (!canvas.value || !viewer.value) return { x: 0, y: 0 };

      const rect = canvas.value.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const viewportPoint = viewer.value.viewport.pointFromPixel(
         new OpenSeadragon.Point(x, y)
      );
      const imagePoint =
         viewer.value.viewport.viewportToImageCoordinates(viewportPoint);

      return { x: imagePoint.x, y: imagePoint.y };
   };

   const getScreenPoint = (imagePoint: {
      x: number;
      y: number;
   }): { x: number; y: number } => {
      if (!viewer.value) return { x: 0, y: 0 };

      const screenPoint = viewer.value.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(imagePoint.x, imagePoint.y)
      );
      return { x: screenPoint.x, y: screenPoint.y };
   };

   const getViewportPoint = (imagePoint: {
      x: number;
      y: number;
   }): { x: number; y: number } => {
      const screenPoint = getScreenPoint(imagePoint);
      const containerRect = viewerContainer.value?.getBoundingClientRect();
      const offsetX = containerRect?.left || 0;
      const offsetY = containerRect?.top || 0;
      return { x: screenPoint.x + offsetX, y: screenPoint.y + offsetY };
   };

   // ============ 事件处理 ============

   const handleMouseDown = (e: MouseEvent): void => {
      if (movingAnnotationId.value) {
         const annotation = annotations.value.find(
            (a) => a.id === movingAnnotationId.value
         );
         if (annotation) {
            const rect = canvas.value?.getBoundingClientRect();
            if (!rect) return;

            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const controlPointIndex = getControlPointAt(clickX, clickY);
            if (controlPointIndex !== null) {
               activeControlPoint.value = controlPointIndex;
               isDraggingControlPoint.value = true;
               const cp = controlPoints.value[controlPointIndex];
               draggingControlPointInfo.value = {
                  type: cp.type,
                  index: cp.index,
               };

               if (annotation.type === 'ellipse') {
                  const params = annotation.params as any;
                  ellipseOriginalRatio.value =
                     params.ry > 0 ? params.rx / params.ry : 1;
               }
               return;
            }

            if (isPointInAnnotation(clickX, clickY, annotation)) {
               const pt = getImagePoint(e);
               movingAnnotationOffset.value = { x: pt.x, y: pt.y };
               isDragging.value = true;
            }
         }
         return;
      }

      if (!currentType.value) {
         handleShapeClick(e);
         return;
      }

      const pt = getImagePoint(e);

      switch (currentType.value) {
         case 'marker':
            handleMarkerMouseDown(e, pt);
            break;
         case 'line':
            handleLineMouseDown(e, pt);
            break;
         case 'circle':
            handleCircleMouseDown(e, pt);
            break;
         case 'ellipse':
            handleEllipseMouseDown(e, pt);
            break;
         case 'rect':
            handleRectMouseDown(e, pt);
            break;
         case 'square':
            handleSquareMouseDown(e, pt);
            break;
         case 'polygon':
            handlePolygonMouseDown(e, pt);
            break;
         case 'freehand':
            handleFreehandMouseDown(e, pt);
            break;
      }
   };

   const handleMouseMove = (e: MouseEvent): void => {
      if (isDraggingControlPoint.value && activeControlPoint.value !== null) {
         handleControlPointDrag(e);
         return;
      }

      if (
         isDragging.value &&
         movingAnnotationId.value &&
         movingAnnotationOffset.value
      ) {
         const annotation = annotations.value.find(
            (a) => a.id === movingAnnotationId.value
         );
         if (annotation) {
            const pt = getImagePoint(e);
            const dx = pt.x - movingAnnotationOffset.value.x;
            const dy = pt.y - movingAnnotationOffset.value.y;

            moveAnnotation(annotation, dx, dy);
            render();
         }
         return;
      }

      if (!currentType.value) {
         forwardEventToOpenSeadragon(e);
         return;
      }

      const pt = getImagePoint(e);

      switch (currentType.value) {
         case 'line':
            handleLineMouseMove(e, pt);
            break;
         case 'circle':
            handleCircleMouseMove(e, pt);
            break;
         case 'ellipse':
            handleEllipseMouseMove(e, pt);
            break;
         case 'rect':
            handleRectMouseMove(e, pt);
            break;
         case 'square':
            handleSquareMouseMove();
            break;
         case 'polygon':
            handlePolygonMouseMove(e, pt);
            break;
         case 'freehand':
            handleFreehandMouseMove(e, pt);
            break;
      }
   };

   const handleMouseUp = (e: MouseEvent): void => {
      if (isDraggingControlPoint.value) {
         isDraggingControlPoint.value = false;
         activeControlPoint.value = null;
         draggingControlPointInfo.value = null;
         render();
         return;
      }

      if (isDragging.value) {
         isDragging.value = false;
         movingAnnotationOffset.value = null;
         render();
         return;
      }

      if (!currentType.value) {
         forwardEventToOpenSeadragon(e);
         return;
      }

      const pt = getImagePoint(e);

      switch (currentType.value) {
         case 'marker':
            handleMarkerMouseUp();
            break;
         case 'line':
            handleLineMouseUp(e, pt);
            break;
         case 'circle':
            handleCircleMouseUp(e, pt);
            break;
         case 'ellipse':
            handleEllipseMouseUp(e, pt);
            break;
         case 'rect':
            handleRectMouseUp(e, pt);
            break;
         case 'square':
            handleSquareMouseUp(e, pt);
            break;
         case 'polygon':
            handlePolygonMouseUp(e, pt);
            break;
         case 'freehand':
            handleFreehandMouseUp(e, pt);
            break;
      }
   };

   const handleDoubleClick = (e: MouseEvent): void => {
      if (currentType.value === 'polygon' && drawing.value) {
         e.stopPropagation();
         finishPolygonDraw();
      }
   };

   const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && drawing.value) {
         cancelDraw();
      }
   };

   const handleWheel = (e: WheelEvent): void => {
      if (!viewer.value) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = viewerContainer.value!.getBoundingClientRect();
      const point = new OpenSeadragon.Point(
         e.clientX - rect.left,
         e.clientY - rect.top
      );

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const viewportPoint = viewer.value.viewport.pointFromPixel(point);

      viewer.value.viewport.zoomBy(delta, viewportPoint);
   };

   const handleViewerMouseMove = (e: MouseEvent): void => {
      if (!canvas.value) return;

      if (currentType.value) {
         canvas.value.style.pointerEvents = 'auto';
         return;
      }

      if (movingAnnotationId.value) {
         canvas.value.style.pointerEvents = 'auto';

         const rect = canvas.value.getBoundingClientRect();
         if (rect) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const controlPointIndex = getControlPointAt(mouseX, mouseY);

            if (controlPointIndex !== null) {
               setCursor('nwse-resize');
            } else {
               const annotation = annotations.value.find(
                  (a) => a.id === movingAnnotationId.value
               );
               if (
                  annotation &&
                  isPointInAnnotation(mouseX, mouseY, annotation)
               ) {
                  setCursor('move');
               } else {
                  setCursor('default');
               }
            }
         }
         return;
      }

      const rect = canvas.value.getBoundingClientRect();
      if (!rect) {
         canvas.value.style.pointerEvents = 'none';
         return;
      }

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let isOverAnnotation = false;
      for (let i = annotations.value.length - 1; i >= 0; i--) {
         if (isPointInAnnotation(mouseX, mouseY, annotations.value[i])) {
            isOverAnnotation = true;
            break;
         }
      }

      canvas.value.style.pointerEvents = isOverAnnotation ? 'auto' : 'none';
   };

   const handleShapeClick = (e: MouseEvent): void => {
      const rect = canvas.value?.getBoundingClientRect();
      if (!rect) {
         forwardEventToOpenSeadragon(e);
         return;
      }

      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      for (let i = annotations.value.length - 1; i >= 0; i--) {
         const annotation = annotations.value[i];
         if (isPointInAnnotation(clickX, clickY, annotation)) {
            showPopupForAnnotation(annotation.id);
            if (options.value.onAnnotationSelected) {
               options.value.onAnnotationSelected(annotation);
            }
            return;
         }
      }

      forwardEventToOpenSeadragon(e);
   };

   const handleControlPointDrag = (e: MouseEvent) => {
      if (!movingAnnotationId.value || !draggingControlPointInfo.value) return;

      const annotation = annotations.value.find(
         (a) => a.id === movingAnnotationId.value
      );
      if (!annotation) return;

      const pt = getImagePoint(e);
      const controlPoint = draggingControlPointInfo.value;
      const params = annotation.params as any;

      switch (annotation.type) {
         case 'line': {
            if (controlPoint.index === 0) {
               params.x1 = pt.x;
               params.y1 = pt.y;
            } else if (controlPoint.index === 1) {
               params.x2 = pt.x;
               params.y2 = pt.y;
            }
            break;
         }
         case 'circle': {
            const minRadius = 5;
            const dx = pt.x - params.cx;
            const dy = pt.y - params.cy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            params.r = Math.max(minRadius, distance);
            break;
         }
         case 'ellipse': {
            const minRadius = 5;
            const dx = pt.x - params.cx;
            const dy = pt.y - params.cy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const ratio = ellipseOriginalRatio.value;
            if (ratio > 0) {
               const newRx = distance / Math.sqrt(1 + 1 / (ratio * ratio));
               const newRy = newRx / ratio;
               params.rx = Math.max(minRadius, newRx);
               params.ry = Math.max(minRadius, newRy);
            }
            break;
         }
         case 'rect': {
            if (controlPoint.index === undefined) break;
            const minSize = 10;
            const oppositeIndex = [2, 3, 0, 1][controlPoint.index];

            let oppositeCorner: { x: number; y: number };
            switch (oppositeIndex) {
               case 0:
                  oppositeCorner = { x: params.x, y: params.y };
                  break;
               case 1:
                  oppositeCorner = { x: params.x + params.width, y: params.y };
                  break;
               case 2:
                  oppositeCorner = {
                     x: params.x + params.width,
                     y: params.y + params.height,
                  };
                  break;
               case 3:
                  oppositeCorner = { x: params.x, y: params.y + params.height };
                  break;
               default:
                  oppositeCorner = { x: params.x, y: params.y };
            }

            const newX = Math.min(pt.x, oppositeCorner.x);
            const newY = Math.min(pt.y, oppositeCorner.y);
            const newWidth = Math.abs(pt.x - oppositeCorner.x);
            const newHeight = Math.abs(pt.y - oppositeCorner.y);

            if (newWidth >= minSize && newHeight >= minSize) {
               params.x = newX;
               params.y = newY;
               params.width = newWidth;
               params.height = newHeight;
            }
            break;
         }
         case 'square': {
            if (controlPoint.index === undefined) break;
            const minSize = 10;
            const center = {
               x: params.x + params.side / 2,
               y: params.y + params.side / 2,
            };

            const dx = pt.x - center.x;
            const dy = pt.y - center.y;
            const newHalfSide = Math.max(Math.abs(dx), Math.abs(dy));

            if (newHalfSide * 2 >= minSize) {
               params.x = center.x - newHalfSide;
               params.y = center.y - newHalfSide;
               params.side = newHalfSide * 2;
            }
            break;
         }
         case 'polygon': {
            if (controlPoint.index !== undefined) {
               params.points[controlPoint.index] = { x: pt.x, y: pt.y };
            }
            break;
         }
      }

      render();
   };

   const forwardEventToOpenSeadragon = (e: MouseEvent): void => {
      if (!viewer.value || !viewerContainer.value) return;

      const newEvent = new MouseEvent(e.type, {
         bubbles: true,
         cancelable: true,
         clientX: e.clientX,
         clientY: e.clientY,
         button: e.button,
         buttons: e.buttons,
         relatedTarget: e.relatedTarget,
         screenX: e.screenX,
         screenY: e.screenY,
         movementX: e.movementX,
         movementY: e.movementY,
         ctrlKey: e.ctrlKey,
         shiftKey: e.shiftKey,
         altKey: e.altKey,
         metaKey: e.metaKey,
      });

      viewerContainer.value.dispatchEvent(newEvent);
   };

   // ============ 碰撞检测 ============

   const isPointInAnnotation = (
      x: number,
      y: number,
      annotation: Annotation
   ): boolean => {
      const params = annotation.params as any;

      switch (annotation.type) {
         case 'marker':
            return isPointInMarker(x, y, params);
         case 'line':
            return isPointNearLine(x, y, params);
         case 'circle':
            return isPointInCircle(x, y, params);
         case 'ellipse':
            return isPointInEllipse(x, y, params);
         case 'rect':
         case 'square':
            return isPointInRect(x, y, params);
         case 'polygon':
            return isPointInPolygon(x, y, params);
         case 'freehand':
            return isPointInFreehand(x, y, params);
         default:
            return false;
      }
   };

   const isPointInMarker = (
      x: number,
      y: number,
      params: MarkerParams
   ): boolean => {
      const screenPt = getScreenPoint(params);
      const markerSize = 21;
      const dx = x - screenPt.x;
      const dy = y - screenPt.y;
      return Math.sqrt(dx * dx + dy * dy) < markerSize;
   };

   const isPointNearLine = (
      x: number,
      y: number,
      params: LineParams
   ): boolean => {
      const pt1 = getScreenPoint({ x: params.x1, y: params.y1 });
      const pt2 = getScreenPoint({ x: params.x2, y: params.y2 });

      const A = x - pt1.x;
      const B = y - pt1.y;
      const C = pt2.x - pt1.x;
      const D = pt2.y - pt1.y;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;

      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;

      if (param < 0) {
         xx = pt1.x;
         yy = pt1.y;
      } else if (param > 1) {
         xx = pt2.x;
         yy = pt2.y;
      } else {
         xx = pt1.x + param * C;
         yy = pt1.y + param * D;
      }

      const dx = x - xx;
      const dy = y - yy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < 10;
   };

   const isPointInCircle = (
      x: number,
      y: number,
      params: CircleParams
   ): boolean => {
      const center = getScreenPoint({ x: params.cx, y: params.cy });
      const radiusPt = getScreenPoint({
         x: params.cx + params.r,
         y: params.cy,
      });
      const radius = Math.abs(radiusPt.x - center.x);

      const dx = x - center.x;
      const dy = y - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
   };

   const isPointInEllipse = (
      x: number,
      y: number,
      params: EllipseParams
   ): boolean => {
      const center = getScreenPoint({ x: params.cx, y: params.cy });
      const rxScreen = getScreenPoint({
         x: params.cx + params.rx,
         y: params.cy,
      });
      const ryScreen = getScreenPoint({
         x: params.cx,
         y: params.cy + params.ry,
      });

      const rx = Math.abs(rxScreen.x - center.x);
      const ry = Math.abs(ryScreen.y - center.y);

      const dx = x - center.x;
      const dy = y - center.y;

      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
   };

   const isPointInRect = (
      x: number,
      y: number,
      params: RectParams | SquareParams
   ): boolean => {
      const xVal =
         (params as RectParams).x !== undefined
            ? (params as RectParams).x
            : (params as SquareParams).x;
      const yVal =
         (params as RectParams).y !== undefined
            ? (params as RectParams).y
            : (params as SquareParams).y;
      const widthVal =
         (params as RectParams).width !== undefined
            ? (params as RectParams).width
            : (params as SquareParams).side;
      const heightVal =
         (params as RectParams).height !== undefined
            ? (params as RectParams).height
            : (params as SquareParams).side;

      const start = getScreenPoint({ x: xVal, y: yVal });
      const end = getScreenPoint({ x: xVal + widthVal, y: yVal + heightVal });

      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      return x >= minX && x <= maxX && y >= minY && y <= maxY;
   };

   const isPointInPolygon = (
      x: number,
      y: number,
      params: PolygonParams
   ): boolean => {
      const screenPoints = params.points.map((p) => getScreenPoint(p));

      let inside = false;
      for (
         let i = 0, j = screenPoints.length - 1;
         i < screenPoints.length;
         j = i++
      ) {
         const xi = screenPoints[i].x,
            yi = screenPoints[i].y;
         const xj = screenPoints[j].x,
            yj = screenPoints[j].y;

         const intersect =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

         if (intersect) inside = !inside;
      }

      return inside;
   };

   const isPointInFreehand = (
      x: number,
      y: number,
      params: FreehandParams
   ): boolean => {
      const screenPoints = params.points.map((p) => getScreenPoint(p));

      let inside = false;
      for (
         let i = 0, j = screenPoints.length - 1;
         i < screenPoints.length;
         j = i++
      ) {
         const xi = screenPoints[i].x,
            yi = screenPoints[i].y;
         const xj = screenPoints[j].x,
            yj = screenPoints[j].y;

         const intersect =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

         if (intersect) inside = !inside;
      }

      return inside;
   };

   // ============ 绘制方法 ============

   // Marker
   const handleMarkerMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();
      markerPosition.value = pt;
      finishMarkerDraw();
   };

   const handleMarkerMouseUp = () => {};

   const finishMarkerDraw = () => {
      if (!markerPosition.value) return;

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'marker',
         color: currentColor.value,
         info: '',
         params: {
            x: markerPosition.value.x,
            y: markerPosition.value.y,
         } as MarkerParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      markerPosition.value = null;
   };

   // Line
   const handleLineMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();
      drawing.value = true;
      lineStart.value = pt;
      lineEnd.value = pt;
   };

   const handleLineMouseMove = (
      _e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      lineEnd.value = pt;
      requestRender();
   };

   const handleLineMouseUp = (
      _e: MouseEvent,
      _pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      drawing.value = false;
      finishLineDraw();
   };

   const finishLineDraw = () => {
      if (!lineStart.value || !lineEnd.value) return;

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'line',
         color: currentColor.value,
         info: '',
         params: {
            x1: lineStart.value.x,
            y1: lineStart.value.y,
            x2: lineEnd.value.x,
            y2: lineEnd.value.y,
         } as LineParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      lineStart.value = null;
      lineEnd.value = null;
   };

   // Circle
   const handleCircleMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();
      drawing.value = true;
      circleCenter.value = pt;
      circleRadius.value = 0;
   };

   const handleCircleMouseMove = (
      _e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      if (!drawing.value || !circleCenter.value) return;

      const dx = pt.x - circleCenter.value.x;
      const dy = pt.y - circleCenter.value.y;
      circleRadius.value = Math.sqrt(dx * dx + dy * dy);

      requestRender();
   };

   const handleCircleMouseUp = (
      _e: MouseEvent,
      _pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      drawing.value = false;
      finishCircleDraw();
   };

   const finishCircleDraw = () => {
      if (!circleCenter.value || circleRadius.value === null) return;

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'circle',
         color: currentColor.value,
         info: '',
         params: {
            cx: circleCenter.value.x,
            cy: circleCenter.value.y,
            r: circleRadius.value,
         } as CircleParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      circleCenter.value = null;
      circleRadius.value = null;
   };

   // Rect
   const handleRectMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();
      drawing.value = true;
      rectStart.value = pt;
      rectWidth.value = 0;
      rectHeight.value = 0;
   };

   const handleRectMouseMove = (
      _e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      if (!drawing.value || !rectStart.value) return;

      rectWidth.value = Math.abs(pt.x - rectStart.value.x);
      rectHeight.value = Math.abs(pt.y - rectStart.value.y);

      requestRender();
   };

   const handleRectMouseUp = (
      _e: MouseEvent,
      _pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      drawing.value = false;
      finishRectDraw();
   };

   const finishRectDraw = () => {
      if (
         !rectStart.value ||
         rectWidth.value === null ||
         rectHeight.value === null
      )
         return;

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'rect',
         color: currentColor.value,
         info: '',
         params: {
            x: Math.min(rectStart.value.x, rectStart.value.x + rectWidth.value),
            y: Math.min(
               rectStart.value.y,
               rectStart.value.y + rectHeight.value
            ),
            width: rectWidth.value,
            height: rectHeight.value,
         } as RectParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      rectStart.value = null;
      rectWidth.value = null;
      rectHeight.value = null;
   };

   // Ellipse
   const handleEllipseMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();
      drawing.value = true;
      ellipseCenter.value = pt;
   };

   const handleEllipseMouseMove = (
      _e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      if (!drawing.value || !ellipseCenter.value) return;
      const dx = Math.abs(pt.x - ellipseCenter.value.x);
      const dy = Math.abs(pt.y - ellipseCenter.value.y);
      ellipseRadiusX.value = dx;
      ellipseRadiusY.value = dy;
      requestRender();
   };

   const handleEllipseMouseUp = (
      _e: MouseEvent,
      _pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      drawing.value = false;
      finishEllipseDraw();
   };

   const finishEllipseDraw = () => {
      if (
         !ellipseCenter.value ||
         ellipseRadiusX.value === null ||
         ellipseRadiusY.value === null
      )
         return;

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'ellipse',
         color: currentColor.value,
         info: '',
         params: {
            cx: ellipseCenter.value.x,
            cy: ellipseCenter.value.y,
            rx: ellipseRadiusX.value,
            ry: ellipseRadiusY.value,
         } as EllipseParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      ellipseCenter.value = null;
      ellipseRadiusX.value = null;
      ellipseRadiusY.value = null;
   };

   // Square
   const handleSquareMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();
      drawing.value = true;
      squareStart.value = pt;
   };

   const handleSquareMouseMove = () => {};

   const handleSquareMouseUp = (
      _e: MouseEvent,
      _pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      drawing.value = false;
      finishSquareDraw();
   };

   const finishSquareDraw = () => {
      if (!squareStart.value) return;

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'square',
         color: currentColor.value,
         info: '',
         params: {
            x: squareStart.value.x,
            y: squareStart.value.y,
            side: squareSize.value,
         } as SquareParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      squareStart.value = null;
   };

   // Polygon
   const handlePolygonMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();

      if (polygonPoints.value.length >= 3) {
         const firstPoint = polygonPoints.value[0];
         const firstPointScreen = getScreenPoint(firstPoint);
         const clickPointScreen = getScreenPoint(pt);

         const distance = Math.sqrt(
            Math.pow(clickPointScreen.x - firstPointScreen.x, 2) +
               Math.pow(clickPointScreen.y - firstPointScreen.y, 2)
         );

         if (distance < 15) {
            finishPolygonDraw();
            return;
         }
      }

      if (polygonPoints.value.length === 0) {
         drawing.value = true;
      }
      polygonPoints.value.push(pt);
      requestRender();
   };

   const handlePolygonMouseMove = (
      _e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      if (!drawing.value || polygonPoints.value.length === 0) return;
      polygonPreviewPoint.value = pt;
      requestRender();
   };

   const handlePolygonMouseUp = (
      _e: MouseEvent,
      _pt: { x: number; y: number }
   ) => {};

   const finishPolygonDraw = () => {
      if (polygonPoints.value.length < 3) return;

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'polygon',
         color: currentColor.value,
         info: '',
         params: { points: [...polygonPoints.value] } as PolygonParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      polygonPoints.value = [];
   };

   // Freehand
   const handleFreehandMouseDown = (
      e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      e.stopPropagation();
      drawing.value = true;
      freehandPoints.value = [pt];
   };

   const handleFreehandMouseMove = (
      _e: MouseEvent,
      pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      freehandPoints.value.push(pt);
      requestRender();
   };

   const handleFreehandMouseUp = (
      _e: MouseEvent,
      _pt: { x: number; y: number }
   ) => {
      if (!drawing.value) return;
      drawing.value = false;
      finishFreehandDraw();
   };

   const finishFreehandDraw = () => {
      if (freehandPoints.value.length < 2) return;

      const d = freehandPoints.value
         .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
         .join(' ');

      const annotation: Annotation = {
         id: String(nextId.value++),
         type: 'freehand',
         color: currentColor.value,
         info: '',
         params: { d, points: [...freehandPoints.value] } as FreehandParams,
      };

      addAnnotation(annotation);

      if (!allowMulti.value) {
         cancelDraw();
      }

      freehandPoints.value = [];
   };

   // ============ 预览渲染 ============

   const renderPreview = () => {
      if (!ctx.value) return;

      ctx.value.save();
      ctx.value.strokeStyle = currentColor.value;
      ctx.value.lineWidth = 2;
      ctx.value.setLineDash([5, 5]);

      switch (currentType.value) {
         case 'line':
            renderPreviewLine();
            break;
         case 'circle':
            renderPreviewCircle();
            break;
         case 'ellipse':
            renderPreviewEllipse();
            break;
         case 'rect':
            renderPreviewRect();
            break;
         case 'polygon':
            renderPreviewPolygon();
            break;
         case 'freehand':
            renderPreviewFreehand();
            break;
      }

      ctx.value.restore();
   };

   const renderPreviewLine = () => {
      if (!ctx.value || !lineStart.value || !lineEnd.value) return;

      const pt1 = getScreenPoint(lineStart.value);
      const pt2 = getScreenPoint(lineEnd.value);

      ctx.value.beginPath();
      ctx.value.moveTo(pt1.x, pt1.y);
      ctx.value.lineTo(pt2.x, pt2.y);
      ctx.value.stroke();
   };

   const renderPreviewCircle = () => {
      if (!ctx.value || !circleCenter.value || circleRadius.value === null)
         return;

      const center = getScreenPoint(circleCenter.value);
      const radiusPt = getScreenPoint({
         x: circleCenter.value.x + circleRadius.value,
         y: circleCenter.value.y,
      });
      const radius = Math.abs(radiusPt.x - center.x);

      ctx.value.beginPath();
      ctx.value.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.value.stroke();
   };

   const renderPreviewRect = () => {
      if (
         !ctx.value ||
         !rectStart.value ||
         rectWidth.value === null ||
         rectHeight.value === null
      )
         return;

      const startScreen = getScreenPoint(rectStart.value);
      const endScreen = getScreenPoint({
         x: rectStart.value.x + rectWidth.value,
         y: rectStart.value.y + rectHeight.value,
      });

      const x = Math.min(startScreen.x, endScreen.x);
      const y = Math.min(startScreen.y, endScreen.y);
      const width = Math.abs(endScreen.x - startScreen.x);
      const height = Math.abs(endScreen.y - startScreen.y);

      ctx.value.beginPath();
      ctx.value.rect(x, y, width, height);
      ctx.value.stroke();
   };

   const renderPreviewEllipse = () => {
      if (
         !ctx.value ||
         !ellipseCenter.value ||
         ellipseRadiusX.value === null ||
         ellipseRadiusY.value === null
      )
         return;

      const centerScreen = getScreenPoint(ellipseCenter.value);
      const rxScreen = getScreenPoint({
         x: ellipseCenter.value.x + ellipseRadiusX.value,
         y: ellipseCenter.value.y,
      });
      const ryScreen = getScreenPoint({
         x: ellipseCenter.value.x,
         y: ellipseCenter.value.y + ellipseRadiusY.value,
      });

      const rx = Math.abs(rxScreen.x - centerScreen.x);
      const ry = Math.abs(ryScreen.y - centerScreen.y);

      ctx.value.beginPath();
      ctx.value.ellipse(
         centerScreen.x,
         centerScreen.y,
         rx,
         ry,
         0,
         0,
         Math.PI * 2
      );
      ctx.value.stroke();
   };

   const renderPreviewPolygon = () => {
      if (!ctx.value || polygonPoints.value.length === 0) return;

      const screenPoints = polygonPoints.value.map((p) => getScreenPoint(p));
      const c = ctx.value!;

      screenPoints.forEach((pt) => {
         c.beginPath();
         c.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
         c.fillStyle = currentColor.value;
         c.fill();
      });

      if (screenPoints.length >= 2) {
         c.beginPath();
         c.moveTo(screenPoints[0].x, screenPoints[0].y);
         for (let i = 1; i < screenPoints.length; i++) {
            c.lineTo(screenPoints[i].x, screenPoints[i].y);
         }
         c.stroke();
      }

      if (polygonPreviewPoint.value && screenPoints.length > 0) {
         const previewScreen = getScreenPoint(polygonPreviewPoint.value);
         const lastPoint = screenPoints[screenPoints.length - 1];

         c.save();
         c.setLineDash([5, 5]);
         c.beginPath();
         c.moveTo(lastPoint.x, lastPoint.y);
         c.lineTo(previewScreen.x, previewScreen.y);
         c.stroke();
         c.restore();
      }

      if (screenPoints.length >= 3 && polygonPreviewPoint.value) {
         c.save();
         c.setLineDash([5, 5]);
         c.globalAlpha = 0.3;
         c.beginPath();
         const lastPoint = screenPoints[screenPoints.length - 1];
         c.moveTo(lastPoint.x, lastPoint.y);
         c.lineTo(screenPoints[0].x, screenPoints[0].y);
         c.stroke();
         c.restore();
      }
   };

   const renderPreviewFreehand = () => {
      if (!ctx.value || freehandPoints.value.length < 2) return;

      const screenPoints = freehandPoints.value.map((p) => getScreenPoint(p));

      ctx.value.beginPath();
      ctx.value.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
         ctx.value.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      ctx.value.stroke();
   };

   // ============ 图形渲染 ============

   const renderMarker = (ann: Annotation) => {
      if (!ctx.value) return;

      const params = ann.params as MarkerParams;
      const screenPt = getScreenPoint({ x: params.x, y: params.y });

      const scaleFactor = 0.04;

      ctx.value.save();
      ctx.value.translate(screenPt.x - 21, screenPt.y - 39);
      ctx.value.scale(scaleFactor, scaleFactor);

      const path = new Path2D(
         'M533 240c80 0 145 65 145 145S612 530 532 530s-145-65-145-145S453 240 532 240zM850 385c0-175-142-317-317-317S215 210 215 385c0 64 18 123 51 173L266 558l238 380c5 10 16 18 28 18s23-7 28-17l238-380L798 558C831 508 850 449 850 385'
      );

      ctx.value.fillStyle = ann.color;
      ctx.value.fill(path);

      ctx.value.restore();
   };

   const renderLine = (ann: Annotation) => {
      if (!ctx.value) return;

      const params = ann.params as LineParams;
      const pt1 = getScreenPoint({ x: params.x1, y: params.y1 });
      const pt2 = getScreenPoint({ x: params.x2, y: params.y2 });

      ctx.value.beginPath();
      ctx.value.moveTo(pt1.x, pt1.y);
      ctx.value.lineTo(pt2.x, pt2.y);
      ctx.value.strokeStyle = ann.color;
      ctx.value.lineWidth = 2;
      ctx.value.stroke();
   };

   const renderCircle = (ann: Annotation, isSelected: boolean) => {
      if (!ctx.value) return;

      const params = ann.params as CircleParams;
      const center = getScreenPoint({ x: params.cx, y: params.cy });
      const radiusPt = getScreenPoint({
         x: params.cx + params.r,
         y: params.cy,
      });
      const radius = Math.abs(radiusPt.x - center.x);

      ctx.value.beginPath();
      ctx.value.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.value.strokeStyle = ann.color;
      ctx.value.lineWidth = 2;
      ctx.value.stroke();

      ctx.value.fillStyle = '#334c6b';
      ctx.value.globalAlpha = isSelected ? 0.2 : 0;
      ctx.value.fill();
      ctx.value.globalAlpha = 1;
   };

   const renderEllipse = (ann: Annotation, isSelected: boolean) => {
      if (!ctx.value) return;

      const params = ann.params as EllipseParams;
      const center = getScreenPoint({ x: params.cx, y: params.cy });
      const rxScreen = getScreenPoint({
         x: params.cx + params.rx,
         y: params.cy,
      });
      const ryScreen = getScreenPoint({
         x: params.cx,
         y: params.cy + params.ry,
      });

      const rx = Math.abs(rxScreen.x - center.x);
      const ry = Math.abs(ryScreen.y - center.y);

      ctx.value.beginPath();
      ctx.value.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.value.strokeStyle = ann.color;
      ctx.value.lineWidth = 2;
      ctx.value.stroke();

      ctx.value.fillStyle = '#334c6b';
      ctx.value.globalAlpha = isSelected ? 0.2 : 0;
      ctx.value.fill();
      ctx.value.globalAlpha = 1;
   };

   const renderRect = (ann: Annotation, isSelected: boolean) => {
      if (!ctx.value) return;

      const params = ann.params as RectParams;
      const start = getScreenPoint({ x: params.x, y: params.y });
      const end = getScreenPoint({
         x: params.x + params.width,
         y: params.y + params.height,
      });

      const x = start.x;
      const y = start.y;
      const width = end.x - start.x;
      const height = end.y - start.y;

      ctx.value.beginPath();
      ctx.value.rect(x, y, width, height);
      ctx.value.strokeStyle = ann.color;
      ctx.value.lineWidth = 2;
      ctx.value.stroke();

      ctx.value.fillStyle = '#334c6b';
      ctx.value.globalAlpha = isSelected ? 0.2 : 0;
      ctx.value.fill();
      ctx.value.globalAlpha = 1;
   };

   const renderSquare = (ann: Annotation, isSelected: boolean) => {
      if (!ctx.value) return;

      const params = ann.params as SquareParams;
      const start = getScreenPoint({ x: params.x, y: params.y });
      const end = getScreenPoint({
         x: params.x + params.side,
         y: params.y + params.side,
      });

      const x = start.x;
      const y = start.y;
      const width = end.x - start.x;
      const height = end.y - start.y;

      ctx.value.beginPath();
      ctx.value.rect(x, y, width, height);
      ctx.value.strokeStyle = ann.color;
      ctx.value.lineWidth = 2;
      ctx.value.stroke();

      ctx.value.fillStyle = '#334c6b';
      ctx.value.globalAlpha = isSelected ? 0.2 : 0;
      ctx.value.fill();
      ctx.value.globalAlpha = 1;
   };

   const renderPolygon = (ann: Annotation, isSelected: boolean) => {
      if (!ctx.value) return;

      const params = ann.params as PolygonParams;
      const screenPoints = params.points.map((p) => getScreenPoint(p));

      if (screenPoints.length < 3) return;

      ctx.value.beginPath();
      ctx.value.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
         ctx.value.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      ctx.value.closePath();

      ctx.value.strokeStyle = ann.color;
      ctx.value.lineWidth = 2;
      ctx.value.stroke();

      ctx.value.fillStyle = '#334c6b';
      ctx.value.globalAlpha = isSelected ? 0.2 : 0;
      ctx.value.fill();
      ctx.value.globalAlpha = 1;
   };

   const renderFreehand = (ann: Annotation, isSelected: boolean) => {
      if (!ctx.value) return;

      const params = ann.params as FreehandParams;
      const screenPoints = params.points.map((p) => getScreenPoint(p));

      if (screenPoints.length < 2) return;

      ctx.value.beginPath();
      ctx.value.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
         ctx.value.lineTo(screenPoints[i].x, screenPoints[i].y);
      }

      ctx.value.strokeStyle = ann.color;
      ctx.value.lineWidth = 2;
      ctx.value.stroke();

      ctx.value.fillStyle = '#334c6b';
      ctx.value.globalAlpha = isSelected ? 0.2 : 0;
      ctx.value.fill();
      ctx.value.globalAlpha = 1;
   };

   // ============ 控制点 ============

   const calculateControlPoints = () => {
      controlPoints.value = [];
      if (!movingAnnotationId.value) return;

      const annotation = annotations.value.find(
         (a) => a.id === movingAnnotationId.value
      );
      if (!annotation) return;

      const params = annotation.params as any;

      switch (annotation.type) {
         case 'line':
            controlPoints.value.push(
               { x: params.x1, y: params.y1, type: 'endpoint', index: 0 },
               { x: params.x2, y: params.y2, type: 'endpoint', index: 1 }
            );
            break;
         case 'circle':
            controlPoints.value.push(
               { x: params.cx, y: params.cy - params.r, type: 'edge-top' },
               { x: params.cx + params.r, y: params.cy, type: 'edge-right' },
               { x: params.cx, y: params.cy + params.r, type: 'edge-bottom' },
               { x: params.cx - params.r, y: params.cy, type: 'edge-left' }
            );
            break;
         case 'ellipse':
            controlPoints.value.push({
               x: params.cx + params.rx,
               y: params.cy + params.ry,
               type: 'scale',
            });
            break;
         case 'rect':
            controlPoints.value.push(
               { x: params.x, y: params.y, type: 'corner', index: 0 },
               {
                  x: params.x + params.width,
                  y: params.y,
                  type: 'corner',
                  index: 1,
               },
               {
                  x: params.x + params.width,
                  y: params.y + params.height,
                  type: 'corner',
                  index: 2,
               },
               {
                  x: params.x,
                  y: params.y + params.height,
                  type: 'corner',
                  index: 3,
               }
            );
            break;
         case 'square':
            controlPoints.value.push(
               { x: params.x, y: params.y, type: 'corner', index: 0 },
               {
                  x: params.x + params.side,
                  y: params.y,
                  type: 'corner',
                  index: 1,
               },
               {
                  x: params.x + params.side,
                  y: params.y + params.side,
                  type: 'corner',
                  index: 2,
               },
               {
                  x: params.x,
                  y: params.y + params.side,
                  type: 'corner',
                  index: 3,
               }
            );
            break;
         case 'polygon':
            params.points.forEach(
               (point: { x: number; y: number }, index: number) => {
                  controlPoints.value.push({
                     x: point.x,
                     y: point.y,
                     type: 'vertex',
                     index,
                  });
               }
            );
            break;
         case 'marker':
         case 'freehand':
            break;
      }
   };

   const renderControlPoints = () => {
      if (!ctx.value || !movingAnnotationId.value) return;

      const annotation = annotations.value.find(
         (a) => a.id === movingAnnotationId.value
      );
      if (!annotation) return;

      const params = annotation.params as any;
      let points: Array<{ x: number; y: number }> = [];

      switch (annotation.type) {
         case 'line':
            points = [
               { x: params.x1, y: params.y1 },
               { x: params.x2, y: params.y2 },
            ];
            break;
         case 'circle':
            points = [
               { x: params.cx, y: params.cy - params.r },
               { x: params.cx + params.r, y: params.cy },
               { x: params.cx, y: params.cy + params.r },
               { x: params.cx - params.r, y: params.cy },
            ];
            break;
         case 'ellipse':
            points = [{ x: params.cx + params.rx, y: params.cy + params.ry }];
            break;
         case 'rect':
            points = [
               { x: params.x, y: params.y },
               { x: params.x + params.width, y: params.y },
               { x: params.x + params.width, y: params.y + params.height },
               { x: params.x, y: params.y + params.height },
            ];
            break;
         case 'square':
            points = [
               { x: params.x, y: params.y },
               { x: params.x + params.side, y: params.y },
               { x: params.x + params.side, y: params.y + params.side },
               { x: params.x, y: params.y + params.side },
            ];
            break;
         case 'polygon':
            points = params.points.map((p: { x: number; y: number }) => ({
               x: p.x,
               y: p.y,
            }));
            break;
         case 'marker':
         case 'freehand':
            return;
      }

      ctx.value.save();

      points.forEach((point) => {
         const screenPt = getScreenPoint({ x: point.x, y: point.y });

         ctx.value!.beginPath();
         ctx.value!.arc(screenPt.x, screenPt.y, 8, 0, Math.PI * 2);
         ctx.value!.fillStyle = '#ffffff';
         ctx.value!.fill();
         ctx.value!.strokeStyle = '#409eff';
         ctx.value!.lineWidth = 2;
         ctx.value!.stroke();
      });

      ctx.value.restore();
   };

   const getControlPointAt = (x: number, y: number): number | null => {
      for (let i = controlPoints.value.length - 1; i >= 0; i--) {
         const point = controlPoints.value[i];
         const screenPt = getScreenPoint({ x: point.x, y: point.y });
         const dx = x - screenPt.x;
         const dy = y - screenPt.y;
         if (Math.sqrt(dx * dx + dy * dy) < 15) {
            return i;
         }
      }
      return null;
   };

   // ============ 移动标注 ============

   const moveAnnotation = (annotation: Annotation, dx: number, dy: number) => {
      const params = annotation.params as any;

      switch (annotation.type) {
         case 'marker':
            params.x += dx;
            params.y += dy;
            break;
         case 'line':
            params.x1 += dx;
            params.y1 += dy;
            params.x2 += dx;
            params.y2 += dy;
            break;
         case 'circle':
            params.cx += dx;
            params.cy += dy;
            break;
         case 'ellipse':
            params.cx += dx;
            params.cy += dy;
            break;
         case 'rect':
            params.x += dx;
            params.y += dy;
            break;
         case 'square':
            params.x += dx;
            params.y += dy;
            break;
         case 'polygon':
            params.points.forEach((point: { x: number; y: number }) => {
               point.x += dx;
               point.y += dy;
            });
            break;
         case 'freehand':
            params.points.forEach((point: { x: number; y: number }) => {
               point.x += dx;
               point.y += dy;
            });
            break;
      }

      if (movingAnnotationOffset.value) {
         movingAnnotationOffset.value.x += dx;
         movingAnnotationOffset.value.y += dy;
      }
   };

   // ============ 弹窗显示 ============

   const getShapeBoundingBox = (annotationId: string): DOMRect | null => {
      const annotation = annotations.value.find((a) => a.id === annotationId);
      if (!annotation) return null;

      const containerRect = viewerContainer.value?.getBoundingClientRect();
      const offsetX = containerRect?.left || 0;
      const offsetY = containerRect?.top || 0;

      const params = annotation.params as any;
      let minX = Infinity,
         minY = Infinity,
         maxX = -Infinity,
         maxY = -Infinity;

      switch (annotation.type) {
         case 'marker': {
            const screenPt = getScreenPoint(params);
            const markerSize = 21;
            minX = screenPt.x - markerSize + offsetX;
            minY = screenPt.y - markerSize * 2 + offsetY;
            maxX = screenPt.x + markerSize + offsetX;
            maxY = screenPt.y + markerSize + offsetY;
            break;
         }
         case 'line': {
            const pt1 = getScreenPoint({ x: params.x1, y: params.y1 });
            const pt2 = getScreenPoint({ x: params.x2, y: params.y2 });
            minX = Math.min(pt1.x, pt2.x) + offsetX;
            minY = Math.min(pt1.y, pt2.y) + offsetY;
            maxX = Math.max(pt1.x, pt2.x) + offsetX;
            maxY = Math.max(pt1.y, pt2.y) + offsetY;
            break;
         }
         case 'circle': {
            const center = getScreenPoint({ x: params.cx, y: params.cy });
            const radiusPt = getScreenPoint({
               x: params.cx + params.r,
               y: params.cy,
            });
            const radius = Math.abs(radiusPt.x - center.x);
            minX = center.x - radius + offsetX;
            minY = center.y - radius + offsetY;
            maxX = center.x + radius + offsetX;
            maxY = center.y + radius + offsetY;
            break;
         }
         case 'ellipse': {
            const center = getScreenPoint({ x: params.cx, y: params.cy });
            const rxScreen = getScreenPoint({
               x: params.cx + params.rx,
               y: params.cy,
            });
            const ryScreen = getScreenPoint({
               x: params.cx,
               y: params.cy + params.ry,
            });
            const rx = Math.abs(rxScreen.x - center.x);
            const ry = Math.abs(ryScreen.y - center.y);
            minX = center.x - rx + offsetX;
            minY = center.y - ry + offsetY;
            maxX = center.x + rx + offsetX;
            maxY = center.y + ry + offsetY;
            break;
         }
         case 'rect':
         case 'square': {
            const xVal = params.x;
            const yVal = params.y;
            const widthVal =
               params.width !== undefined ? params.width : params.side;
            const heightVal =
               params.height !== undefined ? params.height : params.side;

            const start = getScreenPoint({ x: xVal, y: yVal });
            const end = getScreenPoint({
               x: xVal + widthVal,
               y: yVal + heightVal,
            });

            minX = Math.min(start.x, end.x) + offsetX;
            minY = Math.min(start.y, end.y) + offsetY;
            maxX = Math.max(start.x, end.x) + offsetX;
            maxY = Math.max(start.y, end.y) + offsetY;
            break;
         }
         case 'polygon':
         case 'freehand': {
            const points = params.points || [];
            points.forEach((p: { x: number; y: number }) => {
               const screenPt = getScreenPoint(p);
               minX = Math.min(minX, screenPt.x + offsetX);
               minY = Math.min(minY, screenPt.y + offsetY);
               maxX = Math.max(maxX, screenPt.x + offsetX);
               maxY = Math.max(maxY, screenPt.y + offsetY);
            });
            break;
         }
      }

      if (minX === Infinity || minY === Infinity) return null;

      return new DOMRect(minX, minY, maxX - minX, maxY - minY);
   };

   const showAnnotationPopupForMarker = (annotation: Annotation) => {
      const params = annotation.params as MarkerParams;
      const viewportPt = getViewportPoint({ x: params.x, y: params.y });

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : viewportPt.y;

      const popupParams: PopupParams = {
         type: 'marker',
         annotation,
         left: viewportPt.x,
         top: top,
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   const showAnnotationPopupForLine = (annotation: Annotation) => {
      const params = annotation.params as LineParams;
      const dx = params.x2 - params.x1;
      const dy = params.y2 - params.y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      const midViewportPt = getViewportPoint({
         x: (params.x1 + params.x2) / 2,
         y: (params.y1 + params.y2) / 2,
      });

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : midViewportPt.y;

      const popupParams: PopupParams = {
         type: 'line',
         annotation,
         left: midViewportPt.x,
         top: top,
         properties: { length },
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   const showAnnotationPopupForCircle = (annotation: Annotation) => {
      const params = annotation.params as CircleParams;
      const centerViewportPt = getViewportPoint({ x: params.cx, y: params.cy });

      const area = Math.PI * params.r * params.r;

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerViewportPt.y;

      const popupParams: PopupParams = {
         type: 'circle',
         annotation,
         left: centerViewportPt.x,
         top: top,
         properties: { area },
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   const showAnnotationPopupForEllipse = (annotation: Annotation) => {
      const params = annotation.params as EllipseParams;
      const centerViewportPt = getViewportPoint({ x: params.cx, y: params.cy });

      const area = Math.PI * params.rx * params.ry;

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerViewportPt.y;

      const popupParams: PopupParams = {
         type: 'ellipse',
         annotation,
         left: centerViewportPt.x,
         top: top,
         properties: {
            area,
            horizontalDiameter: params.rx * 2,
            verticalDiameter: params.ry * 2,
         },
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   const showAnnotationPopupForRect = (annotation: Annotation) => {
      const params = annotation.params as RectParams;
      const centerViewportPt = getViewportPoint({
         x: params.x + params.width / 2,
         y: params.y + params.height / 2,
      });

      const area = params.width * params.height;

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerViewportPt.y;

      const popupParams: PopupParams = {
         type: 'rect',
         annotation,
         left: centerViewportPt.x,
         top: top,
         properties: { area },
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   const showAnnotationPopupForSquare = (annotation: Annotation) => {
      const params = annotation.params as SquareParams;
      const centerViewportPt = getViewportPoint({
         x: params.x + params.side / 2,
         y: params.y + params.side / 2,
      });

      const area = params.side * params.side;

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerViewportPt.y;

      const popupParams: PopupParams = {
         type: 'square',
         annotation,
         left: centerViewportPt.x,
         top: top,
         properties: { area },
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   const showAnnotationPopupForPolygon = (annotation: Annotation) => {
      const params = annotation.params as PolygonParams;
      const centerX =
         params.points.reduce((sum, p) => sum + p.x, 0) / params.points.length;
      const centerY =
         params.points.reduce((sum, p) => sum + p.y, 0) / params.points.length;

      const centerViewportPt = getViewportPoint({ x: centerX, y: centerY });

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerViewportPt.y;

      let horizontalDiameter = 0;
      let verticalDiameter = 0;
      if (params.points.length > 0) {
         const xs = params.points.map((p) => p.x);
         const ys = params.points.map((p) => p.y);
         horizontalDiameter = Math.max(...xs) - Math.min(...xs);
         verticalDiameter = Math.max(...ys) - Math.min(...ys);
      }

      const popupParams: PopupParams = {
         type: 'polygon',
         annotation,
         left: centerViewportPt.x,
         top: top,
         properties: { horizontalDiameter, verticalDiameter },
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   const showAnnotationPopupForFreehand = (annotation: Annotation) => {
      const params = annotation.params as FreehandParams;
      const centerX =
         params.points.reduce((sum, p) => sum + p.x, 0) / params.points.length;
      const centerY =
         params.points.reduce((sum, p) => sum + p.y, 0) / params.points.length;

      const centerViewportPt = getViewportPoint({ x: centerX, y: centerY });

      const boundingBox = getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerViewportPt.y;

      let horizontalDiameter = 0;
      let verticalDiameter = 0;
      if (params.points.length > 0) {
         const xs = params.points.map((p) => p.x);
         const ys = params.points.map((p) => p.y);
         horizontalDiameter = Math.max(...xs) - Math.min(...xs);
         verticalDiameter = Math.max(...ys) - Math.min(...ys);
      }

      const popupParams: PopupParams = {
         type: 'freehand',
         annotation,
         left: centerViewportPt.x,
         top: top,
         properties: { horizontalDiameter, verticalDiameter },
      };

      if (options.value.onShowAnnotationPopup) {
         options.value.onShowAnnotationPopup(popupParams);
      }
   };

   // ============ 导出 ============

   return {
      init,
      destroy,
      setAnnotations,
      addAnnotation,
      deleteAnnotation,
      startMoveAnnotation,
      saveMoveAnnotation,
      cancelMoveAnnotation,
      setCurrentColor,
      setDrawType,
      cancelDraw,
      showPopupForAnnotation,
      getAnnotationCenter,
      disableEvents,
      enableEvents,
      setAllowMulti,
      clearSelection,
      setCursor,
      setViewPortDisable,
      setViewPortEnable,
      render,
   };
}
