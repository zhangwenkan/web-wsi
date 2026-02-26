import OpenSeadragon from 'openseadragon';
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
 * Canvas 标注编辑器类
 * 使用 HTML5 Canvas 替代 SVG 实现标注功能，提升渲染性能
 */
export class CanvasAnnotationEditor {
   // Canvas 覆盖层
   private canvas: HTMLCanvasElement | null = null;
   private ctx: CanvasRenderingContext2D | null = null;

   // OpenSeadragon viewer 实例
   private viewer: any;

   // Viewer 容器
   private viewerContainer!: HTMLElement;

   // 标注列表
   private annotations: Annotation[] = [];

   // 配置选项
   private options!: AnnotationEditorOptions;

   // 当前颜色
   private currentColor = '#ff0000';

   // 当前绘制类型
   private currentType: AnnotationType | null = null;

   // 是否正在绘制
   private drawing = false;

   // 下一个ID
   private nextId = 1;

   // 正方形尺寸
   private squareSize = 256;

   // 是否允许多次标注
   private allowMulti = true;

   // 绘制临时变量
   private markerPosition: { x: number; y: number } | null = null;
   private lineStart: { x: number; y: number } | null = null;
   private lineEnd: { x: number; y: number } | null = null;
   private circleCenter: { x: number; y: number } | null = null;
   private circleRadius: number | null = null;
   private ellipseCenter: { x: number; y: number } | null = null;
   private ellipseRadiusX: number | null = null;
   private ellipseRadiusY: number | null = null;
   private rectStart: { x: number; y: number } | null = null;
   private rectWidth: number | null = null;
   private rectHeight: number | null = null;
   private squareStart: { x: number; y: number } | null = null;
   private polygonPoints: Array<{ x: number; y: number }> = [];
   private freehandPoints: Array<{ x: number; y: number }> = [];

   // 多边形预览鼠标位置
   private polygonPreviewPoint: { x: number; y: number } | null = null;

   // 当前选中的标注ID
   private selectedAnnotationId: string | null = null;

   // 移动标注相关
   private movingAnnotationId: string | null = null;
   private isDragging = false;
   private movingAnnotationOffset: { x: number; y: number } | null = null;
   private originalAnnotationData: any = null;

   // 事件处理器绑定
   private handleMouseDownBound: any = null;
   private handleMouseMoveBound: any = null;
   private handleMouseUpBound: any = null;
   private handleDoubleClickBound: any = null;
   private handleKeyDownBound: any = null;
   private handleWheelBound: any = null;
   private renderHandler: any = null;

   // 渲染请求标志（用于节流）
   private renderRequested = false;

   constructor() {
      // 空构造函数，通过 init 方法初始化
   }

   /**
    * 初始化标注编辑器
    * @param canvasOverlay - Canvas 覆盖层元素
    * @param viewer - OpenSeadragon viewer 实例
    * @param viewerContainer - viewer 容器元素
    * @param options - 配置选项
    */
   init(
      canvasOverlay: HTMLCanvasElement,
      viewer: any,
      viewerContainer: HTMLElement,
      options: AnnotationEditorOptions = {}
   ) {
      this.canvas = canvasOverlay;
      this.ctx = this.canvas.getContext('2d');
      this.viewer = viewer;
      this.viewerContainer = viewerContainer;

      // 初始化选项
      this.options = options;
      this.allowMulti =
         options.allowMulti !== undefined ? options.allowMulti : true;
      this.currentColor = '#ff0000';
      this.currentType = null;
      this.drawing = false;

      // 创建事件处理器绑定
      this.renderHandler = () => this.requestRender();
      this.handleMouseDownBound = this.handleMouseDown.bind(this);
      this.handleMouseMoveBound = this.handleMouseMove.bind(this);
      this.handleMouseUpBound = this.handleMouseUp.bind(this);
      this.handleDoubleClickBound = this.handleDoubleClick.bind(this);
      this.handleKeyDownBound = this.handleKeyDown.bind(this);
      this.handleWheelBound = this.handleWheel.bind(this);

      // 绑定 OpenSeadragon 事件
      this.viewer.addHandler('animation', this.renderHandler);
      this.viewer.addHandler('resize', this.renderHandler);
      this.viewer.addHandler('update-viewport', this.renderHandler);

      // 绑定 Canvas 事件
      this.canvas.addEventListener('mousedown', this.handleMouseDownBound);
      this.canvas.addEventListener('mousemove', this.handleMouseMoveBound);
      this.canvas.addEventListener('mouseup', this.handleMouseUpBound);
      this.canvas.addEventListener('dblclick', this.handleDoubleClickBound);
      this.canvas.addEventListener('wheel', this.handleWheelBound, {
         passive: false,
      });

      // 绑定键盘事件（用于 ESC 取消绘制）
      document.addEventListener('keydown', this.handleKeyDownBound);

      // 初始化 Canvas 大小
      this.resizeCanvas();

      // 初始化 pointerEvents 为 auto，允许点击标注
      // 在事件处理中，如果没有点击到标注，会将事件转发给 OpenSeadragon
      this.canvas.style.pointerEvents = 'auto';

      // 初始渲染
      this.render();
   }

   /**
    * 销毁标注编辑器，清理资源
    */
   destroy() {
      // 移除事件监听器
      if (this.viewer) {
         this.viewer.removeHandler('animation', this.renderHandler);
         this.viewer.removeHandler('resize', this.renderHandler);
         this.viewer.removeHandler('update-viewport', this.renderHandler);
      }

      // 解绑 Canvas 事件
      if (this.canvas) {
         this.canvas.removeEventListener(
            'mousedown',
            this.handleMouseDownBound
         );
         this.canvas.removeEventListener(
            'mousemove',
            this.handleMouseMoveBound
         );
         this.canvas.removeEventListener('mouseup', this.handleMouseUpBound);
         this.canvas.removeEventListener(
            'dblclick',
            this.handleDoubleClickBound
         );
         this.canvas.removeEventListener('wheel', this.handleWheelBound);
      }

      // 解绑键盘事件
      document.removeEventListener('keydown', this.handleKeyDownBound);

      // 清理引用
      this.canvas = null;
      this.ctx = null;
      this.viewer = null;
      this.annotations = [];
   }

   /**
    * 调整 Canvas 大小
    */
   private resizeCanvas() {
      if (!this.canvas || !this.viewerContainer) return;

      const rect = this.viewerContainer.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;

      // 重新渲染
      this.render();
   }

   /**
    * 设置标注列表
    */
   setAnnotations(annotations: Annotation[]) {
      this.annotations = annotations;
      this.selectedAnnotationId = null;
      this.render();
   }

   /**
    * 清除选中状态
    */
   clearSelection() {
      this.selectedAnnotationId = null;
      this.render();
   }

   /**
    * 添加标注
    */
   addAnnotation(annotation: Annotation) {
      this.annotations.push(annotation);
      this.render();

      // 触发编辑回调
      if (this.options.onEdit) {
         this.options.onEdit(this.annotations);
      }
   }

   /**
    * 更新标注
    */
   updateAnnotation(annotation: Annotation) {
      const index = this.annotations.findIndex((a) => a.id === annotation.id);
      if (index !== -1) {
         this.annotations[index] = annotation;
         this.render();

         // 触发编辑回调
         if (this.options.onEdit) {
            this.options.onEdit(this.annotations);
         }
      }
   }

   /**
    * 删除标注
    */
   deleteAnnotation(id: string) {
      const index = this.annotations.findIndex((a) => a.id === id);
      if (index !== -1) {
         this.annotations.splice(index, 1);

         // 如果删除的是当前选中的标注，重置选中状态
         if (this.selectedAnnotationId === id) {
            this.selectedAnnotationId = null;
         }

         this.render();

         // 触发编辑回调
         if (this.options.onEdit) {
            this.options.onEdit(this.annotations);
         }
      }
   }

   /**
    * 开始移动标注
    */
   startMoveAnnotation(id: string) {
      const annotation = this.annotations.find((a) => a.id === id);
      if (annotation) {
         this.movingAnnotationId = id;
         // 保存原始数据用于取消时恢复
         this.originalAnnotationData = JSON.parse(JSON.stringify(annotation));
         this.setCursor('move');
         this.render();
      }
   }

   /**
    * 移动标注（更新位置）
    */
   private moveAnnotation(annotation: Annotation, dx: number, dy: number) {
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

      // 更新偏移量
      if (this.movingAnnotationOffset) {
         this.movingAnnotationOffset.x += dx;
         this.movingAnnotationOffset.y += dy;
      }
   }

   /**
    * 保存移动标注
    */
   saveMoveAnnotation() {
      if (this.movingAnnotationId) {
         this.movingAnnotationId = null;
         this.originalAnnotationData = null;
         this.setCursor('default');
         this.render();

         // 触发编辑回调
         if (this.options.onEdit) {
            this.options.onEdit(this.annotations);
         }
      }
   }

   /**
    * 取消移动标注
    */
   cancelMoveAnnotation() {
      if (this.movingAnnotationId && this.originalAnnotationData) {
         const index = this.annotations.findIndex(
            (a) => a.id === this.movingAnnotationId
         );
         if (index !== -1) {
            // 恢复原始数据
            this.annotations[index] = this.originalAnnotationData;
         }

         this.movingAnnotationId = null;
         this.originalAnnotationData = null;
         this.setCursor('default');
         this.render();
      }
   }

   /**
    * 设置当前颜色
    */
   setCurrentColor(color: string) {
      this.currentColor = color;
   }

   /**
    * 设置绘制类型
    */
   setDrawType(type: AnnotationType, size = 256) {
      this.currentType = type;
      this.setCursor('crosshair');

      // 重置所有绘制状态
      this.drawing = false;

      // 启用 Canvas 事件
      if (this.canvas) {
         this.canvas.style.pointerEvents = 'auto';
      }

      // 根据类型初始化绘制状态
      if (type === 'marker') {
         this.markerPosition = null;
      } else if (type === 'line') {
         this.lineStart = null;
         this.lineEnd = null;
      } else if (type === 'circle') {
         this.circleCenter = null;
         this.circleRadius = null;
      } else if (type === 'ellipse') {
         this.ellipseCenter = null;
         this.ellipseRadiusX = null;
         this.ellipseRadiusY = null;
      } else if (type === 'rect') {
         this.rectStart = null;
         this.rectWidth = null;
         this.rectHeight = null;
      } else if (type === 'square') {
         this.squareSize = size;
         this.squareStart = null;
      } else if (type === 'polygon') {
         this.polygonPoints = [];
         this.polygonPreviewPoint = null;
      } else if (type === 'freehand') {
         this.freehandPoints = [];
      }
   }

   /**
    * 显示指定标注的 popup
    * @param annotationId 标注 ID
    */
   public showPopupForAnnotation(annotationId: string): void {
      const annotation = this.annotations.find((a) => a.id === annotationId);
      if (!annotation) return;

      // 更新选中的标注ID
      this.selectedAnnotationId = annotationId;

      // 重新渲染以显示选中状态
      this.render();

      switch (annotation.type) {
         case 'marker':
            this.showAnnotationPopupForMarker(annotation);
            break;
         case 'line':
            this.showAnnotationPopupForLine(annotation);
            break;
         case 'circle':
            this.showAnnotationPopupForCircle(annotation);
            break;
         case 'ellipse':
            this.showAnnotationPopupForEllipse(annotation);
            break;
         case 'rect':
            this.showAnnotationPopupForRect(annotation);
            break;
         case 'square':
            this.showAnnotationPopupForSquare(annotation);
            break;
         case 'polygon':
            this.showAnnotationPopupForPolygon(annotation);
            break;
         case 'freehand':
            this.showAnnotationPopupForFreehand(annotation);
            break;
      }
   }

   /**
    * 取消绘制
    */
   cancelDraw() {
      this.currentType = null;
      this.drawing = false;
      this.setViewPortEnable();
      this.setCursor('default');

      // 保持 pointerEvents 为 auto，允许点击标注
      // 在事件处理中，如果没有点击到标注，会将事件转发给 OpenSeadragon
      if (this.canvas) {
         this.canvas.style.pointerEvents = 'auto';
      }

      // 清理临时变量
      this.markerPosition = null;
      this.lineStart = null;
      this.lineEnd = null;
      this.circleCenter = null;
      this.circleRadius = null;
      this.ellipseCenter = null;
      this.ellipseRadiusX = null;
      this.ellipseRadiusY = null;
      this.rectStart = null;
      this.rectWidth = null;
      this.rectHeight = null;
      this.squareStart = null;
      this.polygonPoints = [];
      this.polygonPreviewPoint = null;
      this.freehandPoints = [];
   }

   /**
    * 禁用标注事件（用于测量模式等其他模式）
    */
   disableEvents() {
      // 解绑 Canvas 事件
      if (this.canvas) {
         this.canvas.removeEventListener(
            'mousedown',
            this.handleMouseDownBound
         );
         this.canvas.removeEventListener(
            'mousemove',
            this.handleMouseMoveBound
         );
         this.canvas.removeEventListener('mouseup', this.handleMouseUpBound);
         // 禁用 Canvas 的 pointer events，让鼠标事件穿透到下层
         this.canvas.style.pointerEvents = 'none';
      }
   }

   /**
    * 启用标注事件
    */
   enableEvents() {
      // 重新绑定事件
      this.handleMouseDownBound = this.handleMouseDown.bind(this);
      this.handleMouseMoveBound = this.handleMouseMove.bind(this);
      this.handleMouseUpBound = this.handleMouseUp.bind(this);

      if (this.canvas) {
         this.canvas.addEventListener('mousedown', this.handleMouseDownBound);
         this.canvas.addEventListener('mousemove', this.handleMouseMoveBound);
         this.canvas.addEventListener('mouseup', this.handleMouseUpBound);
         // 恢复 pointerEvents 为 auto，允许点击标注
         this.canvas.style.pointerEvents = 'auto';
      }
   }

   /**
    * 设置连续标注模式
    */
   setAllowMulti(allow: boolean) {
      this.allowMulti = allow;
   }

   /**
    * 禁用视口导航（绘制时）
    */
   setViewPortDisable() {
      if (this.viewer) {
         this.viewer.panHorizontal = false;
         this.viewer.panVertical = false;
      }
   }

   /**
    * 启用视口导航
    */
   setViewPortEnable() {
      if (this.viewer) {
         this.viewer.panHorizontal = true;
         this.viewer.panVertical = true;
      }
   }

   /**
    * 设置鼠标样式
    */
   setCursor(cursorStyle: string) {
      if (this.canvas) {
         this.canvas.style.cursor = cursorStyle;
      }
   }

   /**
    * 请求渲染（节流）
    */
   private requestRender() {
      if (!this.renderRequested) {
         this.renderRequested = true;
         requestAnimationFrame(() => {
            this.render();
            this.renderRequested = false;
         });
      }
   }

   /**
    * 渲染所有标注
    */
   render() {
      if (!this.canvas || !this.ctx) return;

      const { width, height } = this.canvas;
      this.ctx.clearRect(0, 0, width, height);

      // 渲染所有标注
      this.annotations.forEach((annotation) => {
         const isSelected = annotation.id === this.selectedAnnotationId;
         switch (annotation.type) {
            case 'marker':
               this.renderMarker(annotation);
               break;
            case 'line':
               this.renderLine(annotation);
               break;
            case 'circle':
               this.renderCircle(annotation);
               break;
            case 'ellipse':
               this.renderEllipse(annotation, isSelected);
               break;
            case 'rect':
               this.renderRect(annotation, isSelected);
               break;
            case 'square':
               this.renderSquare(annotation, isSelected);
               break;
            case 'polygon':
               this.renderPolygon(annotation, isSelected);
               break;
            case 'freehand':
               this.renderFreehand(annotation, isSelected);
               break;
         }
      });

      // 渲染预览图形（如果正在绘制）
      if (this.drawing) {
         this.renderPreview();
      }
   }

   /**
    * 渲染预览图形
    */
   private renderPreview() {
      if (!this.ctx) return;

      this.ctx.save();
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]); // 虚线表示预览

      switch (this.currentType) {
         case 'line':
            this.renderPreviewLine();
            break;
         case 'circle':
            this.renderPreviewCircle();
            break;
         case 'ellipse':
            this.renderPreviewEllipse();
            break;
         case 'rect':
            this.renderPreviewRect();
            break;
         case 'polygon':
            this.renderPreviewPolygon();
            break;
         case 'freehand':
            this.renderPreviewFreehand();
            break;
      }

      this.ctx.restore();
   }

   /**
    * 获取图像坐标点
    */
   private getImagePoint(event: MouseEvent): { x: number; y: number } {
      if (!this.canvas || !this.viewer) return { x: 0, y: 0 };

      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const viewportPoint = this.viewer.viewport.pointFromPixel(
         new OpenSeadragon.Point(x, y)
      );
      const imagePoint =
         this.viewer.viewport.viewportToImageCoordinates(viewportPoint);

      return { x: imagePoint.x, y: imagePoint.y };
   }

   /**
    * 获取屏幕坐标点
    */
   private getScreenPoint(imagePoint: { x: number; y: number }): {
      x: number;
      y: number;
   } {
      if (!this.viewer) return { x: 0, y: 0 };

      const screenPoint = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(imagePoint.x, imagePoint.y)
      );
      return { x: screenPoint.x, y: screenPoint.y };
   }

   /**
    * 鼠标按下事件处理
    */
   private handleMouseDown(e: MouseEvent): void {
      // 如果正在移动标注模式
      if (this.movingAnnotationId) {
         const annotation = this.annotations.find(
            (a) => a.id === this.movingAnnotationId
         );
         if (annotation) {
            // 获取鼠标在 Canvas 上的位置
            const rect = this.canvas?.getBoundingClientRect();
            if (!rect) return;

            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            // 检测点击是否在标注内
            if (this.isPointInAnnotation(clickX, clickY, annotation)) {
               // 点击了正在移动的标注，开始拖动
               const pt = this.getImagePoint(e);
               this.movingAnnotationOffset = {
                  x: pt.x,
                  y: pt.y,
               };
               this.isDragging = true;
            }
         }
         return;
      }

      if (!this.currentType) {
         this.handleShapeClick(e);
         return;
      }

      const pt = this.getImagePoint(e);

      switch (this.currentType) {
         case 'marker':
            this.handleMarkerMouseDown(e, pt);
            break;
         case 'line':
            this.handleLineMouseDown(e, pt);
            break;
         case 'circle':
            this.handleCircleMouseDown(e, pt);
            break;
         case 'ellipse':
            this.handleEllipseMouseDown(e, pt);
            break;
         case 'rect':
            this.handleRectMouseDown(e, pt);
            break;
         case 'square':
            this.handleSquareMouseDown(e, pt);
            break;
         case 'polygon':
            this.handlePolygonMouseDown(e, pt);
            break;
         case 'freehand':
            this.handleFreehandMouseDown(e, pt);
            break;
      }
   }

   /**
    * 处理图形点击事件
    */
   private handleShapeClick(e: MouseEvent): void {
      // 碰撞检测，找到被点击的标注
      const rect = this.canvas?.getBoundingClientRect();
      if (!rect) {
         this.forwardEventToOpenSeadragon(e);
         return;
      }

      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 从后往前遍历（后绘制的在上面），找到第一个被点击的标注
      for (let i = this.annotations.length - 1; i >= 0; i--) {
         const annotation = this.annotations[i];
         if (this.isPointInAnnotation(clickX, clickY, annotation)) {
            this.showPopupForAnnotation(annotation.id);
            // 通知外部组件
            if (this.options.onAnnotationSelected) {
               this.options.onAnnotationSelected(annotation);
            }
            return;
         }
      }

      // 没有点击到标注，将事件转发给 OpenSeadragon
      this.forwardEventToOpenSeadragon(e);
   }

   /**
    * 将鼠标事件转发给 OpenSeadragon
    */
   private forwardEventToOpenSeadragon(e: MouseEvent): void {
      if (!this.viewer || !this.viewerContainer) return;

      // 创建新的事件并在 viewerContainer 上触发
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

      this.viewerContainer.dispatchEvent(newEvent);
   }

   /**
    * 检测点是否在标注内
    */
   private isPointInAnnotation(
      x: number,
      y: number,
      annotation: Annotation
   ): boolean {
      const params = annotation.params as any;

      switch (annotation.type) {
         case 'marker':
            return this.isPointInMarker(x, y, params);
         case 'line':
            return this.isPointNearLine(x, y, params);
         case 'circle':
            return this.isPointInCircle(x, y, params);
         case 'ellipse':
            return this.isPointInEllipse(x, y, params);
         case 'rect':
         case 'square':
            return this.isPointInRect(x, y, params);
         case 'polygon':
            return this.isPointInPolygon(x, y, params);
         case 'freehand':
            return this.isPointInFreehand(x, y, params);
         default:
            return false;
      }
   }

   /**
    * 检测点是否在标记附近
    */
   private isPointInMarker(
      x: number,
      y: number,
      params: MarkerParams
   ): boolean {
      const screenPt = this.getScreenPoint(params);
      const markerSize = 21; // 标记半径
      const dx = x - screenPt.x;
      const dy = y - screenPt.y;
      return Math.sqrt(dx * dx + dy * dy) < markerSize;
   }

   /**
    * 检测点是否在线段附近
    */
   private isPointNearLine(x: number, y: number, params: LineParams): boolean {
      const pt1 = this.getScreenPoint({ x: params.x1, y: params.y1 });
      const pt2 = this.getScreenPoint({ x: params.x2, y: params.y2 });

      // 计算点到线段的距离
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

      return distance < 10; // 10像素容差
   }

   /**
    * 检测点是否在圆内
    */
   private isPointInCircle(
      x: number,
      y: number,
      params: CircleParams
   ): boolean {
      // 将圆心从图像空间转换到屏幕空间
      const center = this.getScreenPoint({ x: params.cx, y: params.cy });
      const radiusPt = this.getScreenPoint({
         x: params.cx + params.r,
         y: params.cy,
      });
      const radius = Math.abs(radiusPt.x - center.x);

      const dx = x - center.x;
      const dy = y - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
   }

   /**
    * 检测点是否在椭圆内
    */
   private isPointInEllipse(
      x: number,
      y: number,
      params: EllipseParams
   ): boolean {
      // 将椭圆从图像空间转换到屏幕空间
      const center = this.getScreenPoint({ x: params.cx, y: params.cy });
      const rxScreen = this.getScreenPoint({
         x: params.cx + params.rx,
         y: params.cy,
      });
      const ryScreen = this.getScreenPoint({
         x: params.cx,
         y: params.cy + params.ry,
      });

      const rx = Math.abs(rxScreen.x - center.x);
      const ry = Math.abs(ryScreen.y - center.y);

      const dx = x - center.x;
      const dy = y - center.y;

      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
   }

   /**
    * 检测点是否在矩形内
    */
   private isPointInRect(
      x: number,
      y: number,
      params: RectParams | SquareParams
   ): boolean {
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

      const start = this.getScreenPoint({ x: xVal, y: yVal });
      const end = this.getScreenPoint({
         x: xVal + widthVal,
         y: yVal + heightVal,
      });

      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      return x >= minX && x <= maxX && y >= minY && y <= maxY;
   }

   /**
    * 检测点是否在多边形内（射线法）
    */
   private isPointInPolygon(
      x: number,
      y: number,
      params: PolygonParams
   ): boolean {
      const screenPoints = params.points.map((p) => this.getScreenPoint(p));

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
   }

   /**
    * 检测点是否在自由绘制内
    */
   private isPointInFreehand(
      x: number,
      y: number,
      params: FreehandParams
   ): boolean {
      const screenPoints = params.points.map((p) => this.getScreenPoint(p));

      // 将自由绘制视为封闭多边形
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
   }

   /**
    * 鼠标移动事件处理
    */
   private handleMouseMove(e: MouseEvent): void {
      // 如果正在拖动标注
      if (
         this.isDragging &&
         this.movingAnnotationId &&
         this.movingAnnotationOffset
      ) {
         const annotation = this.annotations.find(
            (a) => a.id === this.movingAnnotationId
         );
         if (annotation) {
            const pt = this.getImagePoint(e);
            const dx = pt.x - this.movingAnnotationOffset.x;
            const dy = pt.y - this.movingAnnotationOffset.y;

            // 更新标注位置
            this.moveAnnotation(annotation, dx, dy);
            this.requestRender();
         }
         return;
      }

      if (!this.currentType) {
         // 没有绘制模式，转发事件给 OpenSeadragon
         this.forwardEventToOpenSeadragon(e);
         return;
      }

      const pt = this.getImagePoint(e);

      switch (this.currentType) {
         case 'line':
            this.handleLineMouseMove(e, pt);
            break;
         case 'circle':
            this.handleCircleMouseMove(e, pt);
            break;
         case 'ellipse':
            this.handleEllipseMouseMove(e, pt);
            break;
         case 'rect':
            this.handleRectMouseMove(e, pt);
            break;
         case 'square':
            this.handleSquareMouseMove();
            break;
         case 'polygon':
            this.handlePolygonMouseMove(e, pt);
            break;
         case 'freehand':
            this.handleFreehandMouseMove(e, pt);
            break;
      }
   }

   /**
    * 鼠标释放事件处理
    */
   private handleMouseUp(e: MouseEvent): void {
      // 如果正在拖动标注
      if (this.isDragging) {
         this.isDragging = false;
         this.movingAnnotationOffset = null;
         // 拖动结束，保存移动状态但不退出移动模式
         this.render();
         return;
      }

      if (!this.currentType) {
         // 没有绘制模式，转发事件给 OpenSeadragon
         this.forwardEventToOpenSeadragon(e);
         return;
      }

      const pt = this.getImagePoint(e);

      switch (this.currentType) {
         case 'marker':
            this.handleMarkerMouseUp();
            break;
         case 'line':
            this.handleLineMouseUp(e, pt);
            break;
         case 'circle':
            this.handleCircleMouseUp(e, pt);
            break;
         case 'ellipse':
            this.handleEllipseMouseUp(e, pt);
            break;
         case 'rect':
            this.handleRectMouseUp(e, pt);
            break;
         case 'square':
            this.handleSquareMouseUp(e, pt);
            break;
         case 'polygon':
            this.handlePolygonMouseUp(e, pt);
            break;
         case 'freehand':
            this.handleFreehandMouseUp(e, pt);
            break;
      }
   }

   /**
    * 双击事件处理
    */
   private handleDoubleClick(e: MouseEvent): void {
      // 双击完成多边形绘制
      if (this.currentType === 'polygon' && this.drawing) {
         e.stopPropagation();
         this.finishPolygonDraw();
      }
   }

   /**
    * 键盘事件处理
    */
   private handleKeyDown(e: KeyboardEvent): void {
      // ESC 键取消绘制
      if (e.key === 'Escape' && this.drawing) {
         this.cancelDraw();
      }
   }

   /**
    * 滚轮事件处理 - 转发给 OpenSeadragon 进行缩放
    */
   private handleWheel(e: WheelEvent): void {
      if (!this.viewer) return;

      e.preventDefault();
      e.stopPropagation();

      // 获取鼠标在 viewer 中的位置
      const rect = this.viewerContainer.getBoundingClientRect();
      const point = new OpenSeadragon.Point(
         e.clientX - rect.left,
         e.clientY - rect.top
      );

      // 计算缩放因子
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const viewportPoint = this.viewer.viewport.pointFromPixel(point);

      // 执行缩放
      this.viewer.viewport.zoomBy(delta, viewportPoint);
   }

   // ============ Marker标注 ============
   private handleMarkerMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.markerPosition = pt;
      this.finishMarkerDraw();
   }

   private handleMarkerMouseMove() {
      // Marker标注不需要移动过程
   }

   private handleMarkerMouseUp() {
      // Marker标注在按下时完成
   }

   private finishMarkerDraw() {
      if (!this.markerPosition) return;

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'marker',
         color: this.currentColor,
         info: '',
         params: {
            x: this.markerPosition.x,
            y: this.markerPosition.y,
         } as MarkerParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.markerPosition = null;
   }

   // ============ 线标注 ============
   private handleLineMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.drawing = true;
      this.lineStart = pt;
      this.lineEnd = pt;
   }

   private handleLineMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.lineEnd = pt;
      this.requestRender();
   }

   private handleLineMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.drawing = false;
      this.finishLineDraw();
   }

   private finishLineDraw() {
      if (!this.lineStart || !this.lineEnd) return;

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'line',
         color: this.currentColor,
         info: '',
         params: {
            x1: this.lineStart.x,
            y1: this.lineStart.y,
            x2: this.lineEnd.x,
            y2: this.lineEnd.y,
         } as LineParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.lineStart = null;
      this.lineEnd = null;
   }

   // ============ 圆标注 ============
   private handleCircleMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.drawing = true;
      this.circleCenter = pt;
      this.circleRadius = 0;
   }

   private handleCircleMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing || !this.circleCenter) return;

      const dx = pt.x - this.circleCenter.x;
      const dy = pt.y - this.circleCenter.y;
      this.circleRadius = Math.sqrt(dx * dx + dy * dy);

      this.requestRender();
   }

   private handleCircleMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.drawing = false;
      this.finishCircleDraw();
   }

   private finishCircleDraw() {
      if (!this.circleCenter || this.circleRadius === null) return;

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'circle',
         color: this.currentColor,
         info: '',
         params: {
            cx: this.circleCenter.x,
            cy: this.circleCenter.y,
            r: this.circleRadius,
         } as CircleParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.circleCenter = null;
      this.circleRadius = null;
   }

   // ============ 矩形标注 ============
   private handleRectMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.drawing = true;
      this.rectStart = pt;
      this.rectWidth = 0;
      this.rectHeight = 0;
   }

   private handleRectMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing || !this.rectStart) return;

      this.rectWidth = Math.abs(pt.x - this.rectStart.x);
      this.rectHeight = Math.abs(pt.y - this.rectStart.y);

      this.requestRender();
   }

   private handleRectMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.drawing = false;
      this.finishRectDraw();
   }

   private finishRectDraw() {
      if (
         !this.rectStart ||
         this.rectWidth === null ||
         this.rectHeight === null
      )
         return;

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'rect',
         color: this.currentColor,
         info: '',
         params: {
            x: Math.min(this.rectStart.x, this.rectStart.x + this.rectWidth),
            y: Math.min(this.rectStart.y, this.rectStart.y + this.rectHeight),
            width: this.rectWidth,
            height: this.rectHeight,
         } as RectParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.rectStart = null;
      this.rectWidth = null;
      this.rectHeight = null;
   }

   // ============ 椭圆标注 ============
   private handleEllipseMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.drawing = true;
      this.ellipseCenter = pt;
   }

   private handleEllipseMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing || !this.ellipseCenter) return;
      const dx = Math.abs(pt.x - this.ellipseCenter.x);
      const dy = Math.abs(pt.y - this.ellipseCenter.y);
      this.ellipseRadiusX = dx;
      this.ellipseRadiusY = dy;
      this.requestRender();
   }

   private handleEllipseMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.drawing = false;
      this.finishEllipseDraw();
   }

   private finishEllipseDraw() {
      if (
         !this.ellipseCenter ||
         this.ellipseRadiusX === null ||
         this.ellipseRadiusY === null
      )
         return;

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'ellipse',
         color: this.currentColor,
         info: '',
         params: {
            cx: this.ellipseCenter.x,
            cy: this.ellipseCenter.y,
            rx: this.ellipseRadiusX,
            ry: this.ellipseRadiusY,
         } as EllipseParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.ellipseCenter = null;
      this.ellipseRadiusX = null;
      this.ellipseRadiusY = null;
   }

   // ============ 正方形标注 ============
   private handleSquareMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.drawing = true;
      this.squareStart = pt;
   }

   private handleSquareMouseMove() {
      // 正方形不需要实时预览
   }

   private handleSquareMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.drawing = false;
      this.finishSquareDraw();
   }

   private finishSquareDraw() {
      if (!this.squareStart) return;

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'square',
         color: this.currentColor,
         info: '',
         params: {
            x: this.squareStart.x,
            y: this.squareStart.y,
            side: this.squareSize,
         } as SquareParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.squareStart = null;
   }

   // ============ 多边形标注 ============
   private handlePolygonMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();

      // 检测是否点击了第一个点来闭合多边形（需要至少3个点）
      if (this.polygonPoints.length >= 3) {
         const firstPoint = this.polygonPoints[0];
         const firstPointScreen = this.getScreenPoint(firstPoint);
         const clickPointScreen = this.getScreenPoint(pt);

         // 计算点击点与第一个点的距离
         const distance = Math.sqrt(
            Math.pow(clickPointScreen.x - firstPointScreen.x, 2) +
               Math.pow(clickPointScreen.y - firstPointScreen.y, 2)
         );

         // 如果距离小于15像素，认为用户是在尝试闭合多边形
         if (distance < 15) {
            this.finishPolygonDraw();
            return;
         }
      }

      // 正常添加点
      if (this.polygonPoints.length === 0) {
         this.drawing = true;
      }
      this.polygonPoints.push(pt);
      this.requestRender();
   }

   private handlePolygonMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing || this.polygonPoints.length === 0) return;
      // 记录当前鼠标位置用于预览
      this.polygonPreviewPoint = pt;
      this.requestRender();
   }

   private handlePolygonMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      // 多边形通过双击完成
   }

   private finishPolygonDraw() {
      if (this.polygonPoints.length < 3) return;

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'polygon',
         color: this.currentColor,
         info: '',
         params: { points: [...this.polygonPoints] } as PolygonParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.polygonPoints = [];
   }

   // ============ 自由绘制标注 ============
   private handleFreehandMouseDown(
      e: MouseEvent,
      pt: { x: number; y: number }
   ) {
      e.stopPropagation();
      this.drawing = true;
      this.freehandPoints = [pt];
   }

   private handleFreehandMouseMove(
      e: MouseEvent,
      pt: { x: number; y: number }
   ) {
      if (!this.drawing) return;
      this.freehandPoints.push(pt);
      this.requestRender();
   }

   private handleFreehandMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.drawing = false;
      this.finishFreehandDraw();
   }

   private finishFreehandDraw() {
      if (this.freehandPoints.length < 2) return;

      // 生成 path data
      const d = this.freehandPoints
         .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
         .join(' ');

      const annotation: Annotation = {
         id: String(this.nextId++),
         type: 'freehand',
         color: this.currentColor,
         info: '',
         params: {
            d,
            points: [...this.freehandPoints],
         } as FreehandParams,
      };

      // 添加标注到数组
      this.addAnnotation(annotation);

      // 如果不是连续标注模式，取消绘制
      if (!this.allowMulti) {
         this.cancelDraw();
      }

      this.freehandPoints = [];
   }

   // ============ 预览渲染 ============
   private renderPreviewLine() {
      if (!this.ctx || !this.lineStart || !this.lineEnd) return;

      const pt1 = this.getScreenPoint(this.lineStart);
      const pt2 = this.getScreenPoint(this.lineEnd);

      this.ctx.beginPath();
      this.ctx.moveTo(pt1.x, pt1.y);
      this.ctx.lineTo(pt2.x, pt2.y);
      this.ctx.stroke();
   }

   private renderPreviewCircle() {
      if (!this.ctx || !this.circleCenter || this.circleRadius === null) return;

      const center = this.getScreenPoint(this.circleCenter);
      const radiusPt = this.getScreenPoint({
         x: this.circleCenter.x + this.circleRadius,
         y: this.circleCenter.y,
      });
      const radius = Math.abs(radiusPt.x - center.x);

      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
   }

   private renderPreviewRect() {
      if (
         !this.ctx ||
         !this.rectStart ||
         this.rectWidth === null ||
         this.rectHeight === null
      )
         return;

      const startScreen = this.getScreenPoint(this.rectStart);
      const endScreen = this.getScreenPoint({
         x: this.rectStart.x + this.rectWidth,
         y: this.rectStart.y + this.rectHeight,
      });

      const x = Math.min(startScreen.x, endScreen.x);
      const y = Math.min(startScreen.y, endScreen.y);
      const width = Math.abs(endScreen.x - startScreen.x);
      const height = Math.abs(endScreen.y - startScreen.y);

      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.stroke();
   }

   private renderPreviewEllipse() {
      if (
         !this.ctx ||
         !this.ellipseCenter ||
         this.ellipseRadiusX === null ||
         this.ellipseRadiusY === null
      )
         return;

      const centerScreen = this.getScreenPoint(this.ellipseCenter);
      const rxScreen = this.getScreenPoint({
         x: this.ellipseCenter.x + this.ellipseRadiusX,
         y: this.ellipseCenter.y,
      });
      const ryScreen = this.getScreenPoint({
         x: this.ellipseCenter.x,
         y: this.ellipseCenter.y + this.ellipseRadiusY,
      });

      const rx = Math.abs(rxScreen.x - centerScreen.x);
      const ry = Math.abs(ryScreen.y - centerScreen.y);

      this.ctx.beginPath();
      this.ctx.ellipse(
         centerScreen.x,
         centerScreen.y,
         rx,
         ry,
         0,
         0,
         Math.PI * 2
      );
      this.ctx.stroke();
   }

   private renderPreviewPolygon() {
      if (!this.ctx || this.polygonPoints.length === 0) return;

      const screenPoints = this.polygonPoints.map((p) =>
         this.getScreenPoint(p)
      );
      const ctx = this.ctx!; // 非空断言，前面已经检查过

      // 绘制所有已有点
      screenPoints.forEach((pt) => {
         ctx.beginPath();
         ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
         ctx.fillStyle = this.currentColor;
         ctx.fill();
      });

      // 绘制已有点之间的实线（需要至少2个点）
      if (screenPoints.length >= 2) {
         ctx.beginPath();
         ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
         for (let i = 1; i < screenPoints.length; i++) {
            ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
         }
         ctx.stroke();
      }

      // 如果有预览点，绘制从最后一个点到鼠标位置的虚线
      if (this.polygonPreviewPoint && screenPoints.length > 0) {
         const previewScreen = this.getScreenPoint(this.polygonPreviewPoint);
         const lastPoint = screenPoints[screenPoints.length - 1];

         ctx.save();
         ctx.setLineDash([5, 5]); // 虚线
         ctx.beginPath();
         ctx.moveTo(lastPoint.x, lastPoint.y);
         ctx.lineTo(previewScreen.x, previewScreen.y);
         ctx.stroke();
         ctx.restore();
      }

      // 如果有至少3个点，绘制从最后一个点回到第一个点的预览线（虚线）
      if (screenPoints.length >= 3 && this.polygonPreviewPoint) {
         ctx.save();
         ctx.setLineDash([5, 5]); // 虚线
         ctx.globalAlpha = 0.3; // 半透明
         ctx.beginPath();
         const lastPoint = screenPoints[screenPoints.length - 1];
         ctx.moveTo(lastPoint.x, lastPoint.y);
         ctx.lineTo(screenPoints[0].x, screenPoints[0].y);
         ctx.stroke();
         ctx.restore();
      }
   }

   private renderPreviewFreehand() {
      if (!this.ctx || this.freehandPoints.length < 2) return;

      const screenPoints = this.freehandPoints.map((p) =>
         this.getScreenPoint(p)
      );

      this.ctx.beginPath();
      this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
         this.ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      this.ctx.stroke();
   }

   // ============ 完整图形渲染 ============
   private renderMarker(ann: Annotation) {
      if (!this.ctx) return;

      const params = ann.params as MarkerParams;
      const screenPt = this.getScreenPoint({ x: params.x, y: params.y });

      const scaleFactor = 0.04;

      this.ctx.save();
      this.ctx.translate(screenPt.x - 21, screenPt.y - 39);
      this.ctx.scale(scaleFactor, scaleFactor);

      // 使用 path 绘制 marker
      const path = new Path2D(
         'M533 240c80 0 145 65 145 145S612 530 532 530s-145-65-145-145S453 240 532 240zM850 385c0-175-142-317-317-317S215 210 215 385c0 64 18 123 51 173L266 558l238 380c5 10 16 18 28 18s23-7 28-17l238-380L798 558C831 508 850 449 850 385'
      );

      this.ctx.fillStyle = ann.color;
      this.ctx.fill(path);

      this.ctx.restore();
   }

   private renderLine(ann: Annotation) {
      if (!this.ctx) return;

      const params = ann.params as LineParams;
      const pt1 = this.getScreenPoint({ x: params.x1, y: params.y1 });
      const pt2 = this.getScreenPoint({ x: params.x2, y: params.y2 });

      this.ctx.beginPath();
      this.ctx.moveTo(pt1.x, pt1.y);
      this.ctx.lineTo(pt2.x, pt2.y);
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
   }

   private renderCircle(ann: Annotation) {
      if (!this.ctx) return;

      const params = ann.params as CircleParams;
      const center = this.getScreenPoint({ x: params.cx, y: params.cy });
      const radiusPt = this.getScreenPoint({
         x: params.cx + params.r,
         y: params.cy,
      });
      const radius = Math.abs(radiusPt.x - center.x);

      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
   }

   private renderEllipse(ann: Annotation, isSelected: boolean) {
      if (!this.ctx) return;

      const params = ann.params as EllipseParams;
      const center = this.getScreenPoint({ x: params.cx, y: params.cy });
      const rxScreen = this.getScreenPoint({
         x: params.cx + params.rx,
         y: params.cy,
      });
      const ryScreen = this.getScreenPoint({
         x: params.cx,
         y: params.cy + params.ry,
      });

      const rx = Math.abs(rxScreen.x - center.x);
      const ry = Math.abs(ryScreen.y - center.y);

      this.ctx.beginPath();
      this.ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // 填充
      this.ctx.fillStyle = '#334c6b';
      this.ctx.globalAlpha = isSelected ? 0.2 : 0;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
   }

   private renderRect(ann: Annotation, isSelected: boolean) {
      if (!this.ctx) return;

      const params = ann.params as RectParams;
      const start = this.getScreenPoint({ x: params.x, y: params.y });
      const end = this.getScreenPoint({
         x: params.x + params.width,
         y: params.y + params.height,
      });

      const x = start.x;
      const y = start.y;
      const width = end.x - start.x;
      const height = end.y - start.y;

      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // 填充
      this.ctx.fillStyle = '#334c6b';
      this.ctx.globalAlpha = isSelected ? 0.2 : 0;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
   }

   private renderSquare(ann: Annotation, isSelected: boolean) {
      if (!this.ctx) return;

      const params = ann.params as SquareParams;
      const start = this.getScreenPoint({ x: params.x, y: params.y });
      const end = this.getScreenPoint({
         x: params.x + params.side,
         y: params.y + params.side,
      });

      const x = start.x;
      const y = start.y;
      const width = end.x - start.x;
      const height = end.y - start.y;

      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // 填充
      this.ctx.fillStyle = '#334c6b';
      this.ctx.globalAlpha = isSelected ? 0.2 : 0;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
   }

   private renderPolygon(ann: Annotation, isSelected: boolean) {
      if (!this.ctx) return;

      const params = ann.params as PolygonParams;
      const screenPoints = params.points.map((p) => this.getScreenPoint(p));

      if (screenPoints.length < 3) return;

      this.ctx.beginPath();
      this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
         this.ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      this.ctx.closePath();

      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // 填充
      this.ctx.fillStyle = '#334c6b';
      this.ctx.globalAlpha = isSelected ? 0.2 : 0;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
   }

   private renderFreehand(ann: Annotation, isSelected: boolean) {
      if (!this.ctx) return;

      const params = ann.params as FreehandParams;
      const screenPoints = params.points.map((p) => this.getScreenPoint(p));

      if (screenPoints.length < 2) return;

      this.ctx.beginPath();
      this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
         this.ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }

      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // 填充（封闭路径）
      this.ctx.fillStyle = '#334c6b';
      this.ctx.globalAlpha = isSelected ? 0.2 : 0;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
   }

   // ============ 显示标注弹窗 ============
   /**
    * 获取图形元素在视口中的边界框
    * @param annotationId 标注 ID
    */
   private getShapeBoundingBox(annotationId: string): DOMRect | null {
      // Canvas 中需要手动计算边界框
      const annotation = this.annotations.find((a) => a.id === annotationId);
      if (!annotation) return null;

      const params = annotation.params as any;
      let minX = Infinity,
         minY = Infinity,
         maxX = -Infinity,
         maxY = -Infinity;

      switch (annotation.type) {
         case 'marker': {
            const screenPt = this.getScreenPoint(params);
            const markerSize = 21;
            minX = screenPt.x - markerSize;
            minY = screenPt.y - markerSize * 2;
            maxX = screenPt.x + markerSize;
            maxY = screenPt.y + markerSize;
            break;
         }
         case 'line': {
            const pt1 = this.getScreenPoint({ x: params.x1, y: params.y1 });
            const pt2 = this.getScreenPoint({ x: params.x2, y: params.y2 });
            minX = Math.min(pt1.x, pt2.x);
            minY = Math.min(pt1.y, pt2.y);
            maxX = Math.max(pt1.x, pt2.x);
            maxY = Math.max(pt1.y, pt2.y);
            break;
         }
         case 'circle': {
            const center = this.getScreenPoint({ x: params.cx, y: params.cy });
            const radiusPt = this.getScreenPoint({
               x: params.cx + params.r,
               y: params.cy,
            });
            const radius = Math.abs(radiusPt.x - center.x);
            minX = center.x - radius;
            minY = center.y - radius;
            maxX = center.x + radius;
            maxY = center.y + radius;
            break;
         }
         case 'ellipse': {
            const center = this.getScreenPoint({ x: params.cx, y: params.cy });
            const rxScreen = this.getScreenPoint({
               x: params.cx + params.rx,
               y: params.cy,
            });
            const ryScreen = this.getScreenPoint({
               x: params.cx,
               y: params.cy + params.ry,
            });
            const rx = Math.abs(rxScreen.x - center.x);
            const ry = Math.abs(ryScreen.y - center.y);
            minX = center.x - rx;
            minY = center.y - ry;
            maxX = center.x + rx;
            maxY = center.y + ry;
            break;
         }
         case 'rect':
         case 'square': {
            const xVal = params.x !== undefined ? params.x : params.x;
            const yVal = params.y !== undefined ? params.y : params.y;
            const widthVal =
               params.width !== undefined ? params.width : params.side;
            const heightVal =
               params.height !== undefined ? params.height : params.side;

            const start = this.getScreenPoint({ x: xVal, y: yVal });
            const end = this.getScreenPoint({
               x: xVal + widthVal,
               y: yVal + heightVal,
            });

            minX = Math.min(start.x, end.x);
            minY = Math.min(start.y, end.y);
            maxX = Math.max(start.x, end.x);
            maxY = Math.max(start.y, end.y);
            break;
         }
         case 'polygon':
         case 'freehand': {
            const points = params.points || [];
            points.forEach((p: { x: number; y: number }) => {
               const screenPt = this.getScreenPoint(p);
               minX = Math.min(minX, screenPt.x);
               minY = Math.min(minY, screenPt.y);
               maxX = Math.max(maxX, screenPt.x);
               maxY = Math.max(maxY, screenPt.y);
            });
            break;
         }
      }

      if (minX === Infinity || minY === Infinity) return null;

      return new DOMRect(minX, minY, maxX - minX, maxY - minY);
   }

   private showAnnotationPopupForMarker(annotation: Annotation) {
      const params = annotation.params as MarkerParams;
      const screenPt = this.getScreenPoint({ x: params.x, y: params.y });

      const popupParams: PopupParams = {
         type: 'marker',
         annotation,
         left: screenPt.x,
         top: screenPt.y,
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }

   private showAnnotationPopupForLine(annotation: Annotation) {
      const params = annotation.params as LineParams;
      const dx = params.x2 - params.x1;
      const dy = params.y2 - params.y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      const midPt = this.getScreenPoint({
         x: (params.x1 + params.x2) / 2,
         y: (params.y1 + params.y2) / 2,
      });

      // 获取线段元素的实际边界框，使弹窗显示在底部
      const boundingBox = this.getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : midPt.y;

      const popupParams: PopupParams = {
         type: 'line',
         annotation,
         left: midPt.x,
         top: top,
         properties: { length },
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }

   private showAnnotationPopupForCircle(annotation: Annotation) {
      const params = annotation.params as CircleParams;
      const center = this.getScreenPoint({ x: params.cx, y: params.cy });

      const area = Math.PI * params.r * params.r;

      // 获取圆形元素的实际边界框，使弹窗显示在底部
      const boundingBox = this.getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : center.y;

      const popupParams: PopupParams = {
         type: 'circle',
         annotation,
         left: center.x,
         top: top,
         properties: { area },
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }

   private showAnnotationPopupForEllipse(annotation: Annotation) {
      const params = annotation.params as EllipseParams;
      const center = this.getScreenPoint({ x: params.cx, y: params.cy });

      const area = Math.PI * params.rx * params.ry;

      // 获取椭圆元素的实际边界框，使弹窗显示在底部
      const boundingBox = this.getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : center.y;

      const popupParams: PopupParams = {
         type: 'ellipse',
         annotation,
         left: center.x,
         top: top,
         properties: {
            area,
            horizontalDiameter: params.rx * 2,
            verticalDiameter: params.ry * 2,
         },
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }

   private showAnnotationPopupForRect(annotation: Annotation) {
      const params = annotation.params as RectParams;
      const centerPt = this.getScreenPoint({
         x: params.x + params.width / 2,
         y: params.y + params.height / 2,
      });

      const area = params.width * params.height;

      // 获取矩形元素的实际边界框，使弹窗显示在底部
      const boundingBox = this.getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerPt.y;

      const popupParams: PopupParams = {
         type: 'rect',
         annotation,
         left: centerPt.x,
         top: top,
         properties: {
            area,
         },
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }

   private showAnnotationPopupForSquare(annotation: Annotation) {
      const params = annotation.params as SquareParams;
      const centerPt = this.getScreenPoint({
         x: params.x + params.side / 2,
         y: params.y + params.side / 2,
      });

      const area = params.side * params.side;

      // 获取正方形元素的实际边界框，使弹窗显示在底部
      const boundingBox = this.getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerPt.y;

      const popupParams: PopupParams = {
         type: 'square',
         annotation,
         left: centerPt.x,
         top: top,
         properties: {
            area,
         },
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }

   private showAnnotationPopupForPolygon(annotation: Annotation) {
      const params = annotation.params as PolygonParams;
      // 计算多边形中心
      const centerX =
         params.points.reduce((sum, p) => sum + p.x, 0) / params.points.length;
      const centerY =
         params.points.reduce((sum, p) => sum + p.y, 0) / params.points.length;

      const centerPt = this.getScreenPoint({ x: centerX, y: centerY });

      // 获取多边形元素的实际边界框，使弹窗显示在底部
      const boundingBox = this.getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerPt.y;

      const popupParams: PopupParams = {
         type: 'polygon',
         annotation,
         left: centerPt.x,
         top: top,
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }

   private showAnnotationPopupForFreehand(annotation: Annotation) {
      const params = annotation.params as FreehandParams;
      // 计算自由绘制的中心
      const centerX =
         params.points.reduce((sum, p) => sum + p.x, 0) / params.points.length;
      const centerY =
         params.points.reduce((sum, p) => sum + p.y, 0) / params.points.length;

      const centerPt = this.getScreenPoint({ x: centerX, y: centerY });

      // 获取自由绘制元素的实际边界框，使弹窗显示在底部
      const boundingBox = this.getShapeBoundingBox(annotation.id);
      const top = boundingBox ? boundingBox.bottom : centerPt.y;

      const popupParams: PopupParams = {
         type: 'freehand',
         annotation,
         left: centerPt.x,
         top: top,
      };

      if (this.options.onShowAnnotationPopup) {
         this.options.onShowAnnotationPopup(popupParams);
      }
   }
}
