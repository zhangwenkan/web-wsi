import OpenSeadragon from 'openseadragon';
import type {
   Annotation,
   AnnotationEditorOptions,
   AnnotationParams,
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
 * 标注编辑器类
 * 负责在 OpenSeadragon viewer 上绘制、编辑和管理标注
 */
export class AnnotationEditor {
   // SVG 覆盖层
   private svgOverlay: SVGSVGElement | null = null;

   // OpenSeadragon viewer 实例
   private viewer: any;

   // Viewer 容器
   private viewerContainer: HTMLElement;

   // 标注列表
   private annotations: Annotation[] = [];

   // 配置选项
   private options: AnnotationEditorOptions;

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

   // 绘制状态标记
   private drawingMarker = false;
   private drawingLine = false;
   private drawingCircle = false;
   private drawingEllipse = false;
   private drawingRect = false;
   private drawingSquare = false;
   private drawingPolygon = false;
   private drawingFreehand = false;

   // 编辑状态标记
   private editingMarkerId: string | null = null;
   private editingLineId: string | null = null;
   private editingCircleId: string | null = null;
   private editingEllipseId: string | null = null;
   private editingRectId: string | null = null;
   private editingSquareId: string | null = null;
   private editingPolygonId: string | null = null;
   private editingFreehandId: string | null = null;

   // 拖拽状态
   private isDraggingShape = false;
   private dragStartPoint: { x: number; y: number } | null = null;
   private draggingShapeId: string | null = null;
   private draggingShapeType: AnnotationType | null = null;
   private originalGeometry: any = null;

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

   // 当前选中的标注ID
   private selectedAnnotationId: string | null = null;

   // 事件处理器绑定
   private handleMouseDownBound: any = null;
   private handleMouseMoveBound: any = null;
   private handleMouseUpBound: any = null;
   private renderHandler: any = null;

   constructor() {
      // 空构造函数，通过 init 方法初始化
   }

   /**
    * 初始化标注编辑器
    * @param svgOverlay - SVG 覆盖层元素
    * @param viewer - OpenSeadragon viewer 实例
    * @param viewerContainer - viewer 容器元素
    * @param options - 配置选项
    */
   init(
      svgOverlay: SVGSVGElement,
      viewer: any,
      viewerContainer: HTMLElement,
      options: AnnotationEditorOptions = {}
   ) {
      this.svgOverlay = svgOverlay;
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
      this.renderHandler = () => this.render();
      this.handleMouseDownBound = this.handleMouseDown.bind(this);
      this.handleMouseMoveBound = this.handleMouseMove.bind(this);
      this.handleMouseUpBound = this.handleMouseUp.bind(this);

      // 绑定 OpenSeadragon 事件
      this.viewer.addHandler('animation', this.renderHandler);
      this.viewer.addHandler('resize', this.renderHandler);
      this.viewer.addHandler('update-viewport', this.renderHandler);
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

      // 解绑 SVG 事件
      if (this.svgOverlay) {
         if (this.handleMouseDownBound) {
            this.svgOverlay.removeEventListener(
               'mousedown',
               this.handleMouseDownBound
            );
         }
         if (this.handleMouseMoveBound) {
            this.svgOverlay.removeEventListener(
               'mousemove',
               this.handleMouseMoveBound
            );
         }
         if (this.handleMouseUpBound) {
            this.svgOverlay.removeEventListener(
               'mouseup',
               this.handleMouseUpBound
            );
         }

         // 清空 SVG 内容
         this.svgOverlay.innerHTML = '';
      }

      // 清理引用
      this.svgOverlay = null;
      this.viewer = null;
      this.annotations = [];
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

         // 保存当前选中的标注ID
         const currentSelectedId = this.selectedAnnotationId;

         this.render();

         // 如果更新的标注是当前选中的标注，恢复选中状态
         if (currentSelectedId === annotation.id) {
            const element = this.svgOverlay?.querySelector(
               `[data-id="${annotation.id}"]`
            );
            if (element && element.tagName !== 'g') {
               (element as SVGElement).style.fillOpacity = '0.2';
            }
         }

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
      this.drawingMarker = false;
      this.drawingLine = false;
      this.drawingCircle = false;
      this.drawingEllipse = false;
      this.drawingRect = false;
      this.drawingSquare = false;
      this.drawingPolygon = false;
      this.drawingFreehand = false;

      // 解绑事件
      if (this.svgOverlay) {
         if (this.handleMouseDownBound) {
            this.svgOverlay.removeEventListener(
               'mousedown',
               this.handleMouseDownBound
            );
         }
         if (this.handleMouseMoveBound) {
            this.svgOverlay.removeEventListener(
               'mousemove',
               this.handleMouseMoveBound
            );
         }
         if (this.handleMouseUpBound) {
            this.svgOverlay.removeEventListener(
               'mouseup',
               this.handleMouseUpBound
            );
         }
      }

      // 重新绑定事件
      this.handleMouseDownBound = this.handleMouseDown.bind(this);
      this.handleMouseMoveBound = this.handleMouseMove.bind(this);
      this.handleMouseUpBound = this.handleMouseUp.bind(this);

      if (this.svgOverlay) {
         this.svgOverlay.addEventListener(
            'mousedown',
            this.handleMouseDownBound
         );
         this.svgOverlay.addEventListener(
            'mousemove',
            this.handleMouseMoveBound
         );
         this.svgOverlay.addEventListener('mouseup', this.handleMouseUpBound);
      }

      // 启用 SVG 事件
      if (this.svgOverlay) {
         this.svgOverlay.style.pointerEvents = 'auto';
      }

      // 根据类型初始化绘制状态
      if (type === 'marker') {
         this.drawingMarker = true;
         this.markerPosition = null;
      } else if (type === 'line') {
         this.drawingLine = true;
         this.lineStart = null;
         this.lineEnd = null;
      } else if (type === 'circle') {
         this.drawingCircle = true;
         this.circleCenter = null;
         this.circleRadius = null;
      } else if (type === 'ellipse') {
         this.drawingEllipse = true;
         this.ellipseCenter = null;
         this.ellipseRadiusX = null;
         this.ellipseRadiusY = null;
      } else if (type === 'rect') {
         this.drawingRect = true;
         this.rectStart = null;
         this.rectWidth = null;
         this.rectHeight = null;
      } else if (type === 'square') {
         this.squareSize = size;
         this.drawingSquare = true;
         this.squareStart = null;
      } else if (type === 'polygon') {
         this.drawingPolygon = true;
         this.polygonPoints = [];
      } else if (type === 'freehand') {
         this.drawingFreehand = true;
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

      // 如果之前有选中的标注，且不是当前标注，将其透明度恢复为 0
      if (
         this.selectedAnnotationId &&
         this.selectedAnnotationId !== annotationId
      ) {
         const previousElement = this.svgOverlay?.querySelector(
            `[data-id="${this.selectedAnnotationId}"]`
         );
         if (previousElement && previousElement.tagName !== 'g') {
            (previousElement as SVGElement).style.fillOpacity = '0';
         }
      }

      // 将当前选中的标注透明度设置为 0.2
      const currentElement = this.svgOverlay?.querySelector(
         `[data-id="${annotationId}"]`
      );
      if (currentElement && currentElement.tagName !== 'g') {
         (currentElement as SVGElement).style.fillOpacity = '0.2';
      }

      // 更新选中的标注ID
      this.selectedAnnotationId = annotationId;

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
      // 不在这里设置 pointerEvents，因为可能是在其他模式（如测量模式）下调用的
      // pointerEvents 应该由 disableEvents/enableEvents 控制

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
      this.freehandPoints = [];
   }

   /**
    * 禁用标注事件（用于测量模式等其他模式）
    */
   disableEvents() {
      // 解绑 SVG 事件
      if (this.svgOverlay) {
         if (this.handleMouseDownBound) {
            this.svgOverlay.removeEventListener(
               'mousedown',
               this.handleMouseDownBound
            );
         }
         if (this.handleMouseMoveBound) {
            this.svgOverlay.removeEventListener(
               'mousemove',
               this.handleMouseMoveBound
            );
         }
         if (this.handleMouseUpBound) {
            this.svgOverlay.removeEventListener(
               'mouseup',
               this.handleMouseUpBound
            );
         }
         // 禁用 SVG 的 pointer events，让鼠标事件穿透到下层
         this.svgOverlay.style.pointerEvents = 'none';
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

      if (this.svgOverlay) {
         this.svgOverlay.addEventListener(
            'mousedown',
            this.handleMouseDownBound
         );
         this.svgOverlay.addEventListener(
            'mousemove',
            this.handleMouseMoveBound
         );
         this.svgOverlay.addEventListener('mouseup', this.handleMouseUpBound);
         // 恢复 SVG 的 pointer events
         this.svgOverlay.style.pointerEvents = 'auto';
      }
   }

   /**
    * 设置连续标注模式
    */
   setAllowMulti(allow: boolean) {
      this.allowMulti = allow;
      console.log('AnnotationEditor 连续标注模式已设置为:', allow);
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
      if (this.svgOverlay) {
         this.svgOverlay.style.cursor = cursorStyle;
      }
   }

   /**
    * 渲染所有标注
    */
   render() {
      if (!this.svgOverlay) return;

      // 清空现有内容
      this.svgOverlay.innerHTML = '';

      // 渲染所有标注
      this.annotations.forEach((annotation) => {
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
               this.renderEllipse(annotation);
               break;
            case 'rect':
               this.renderRect(annotation);
               break;
            case 'square':
               this.renderSquare(annotation);
               break;
            case 'polygon':
               this.renderPolygon(annotation);
               break;
            case 'freehand':
               this.renderFreehand(annotation);
               break;
         }
      });

      // 恢复选中状态
      if (this.selectedAnnotationId) {
         const element = this.svgOverlay?.querySelector(
            `[data-id="${this.selectedAnnotationId}"]`
         );
         if (element && element.tagName !== 'g') {
            (element as SVGElement).style.fillOpacity = '0.2';
         }
      }
   }

   /**
    * 获取图像坐标点
    */
   private getImagePoint(event: MouseEvent): { x: number; y: number } {
      if (!this.svgOverlay || !this.viewer) return { x: 0, y: 0 };

      const rect = this.svgOverlay.getBoundingClientRect();
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
    * 鼠标按下事件处理
    */
   private handleMouseDown(e: MouseEvent): void {
      if (!this.currentType) {
         this.handleShapeClick(e);
         console.log('没有选择图形类型');
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
      // 使用 closest 查找最近的带有 data-id 的元素
      // 这样无论点击图形的边框还是内部填充区域，都能找到对应的图形
      const target = (e.target as Element).closest('[data-id]') as SVGElement;

      if (!target) return;

      const annotationId = target.getAttribute('data-id');

      if (!annotationId) return;

      // 找到对应的标注
      const annotation = this.annotations.find((a) => a.id === annotationId);
      if (!annotation) return;

      // 显示 popup（包含选中状态管理）
      this.showPopupForAnnotation(annotationId);

      // 通知外部组件
      if (this.options.onAnnotationSelected) {
         this.options.onAnnotationSelected(annotation);
      }
   }

   /**
    * 鼠标移动事件处理
    */
   private handleMouseMove(e: MouseEvent): void {
      if (!this.currentType) return;

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
            this.handleSquareMouseMove(e, pt);
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
      if (!this.currentType) return;

      const pt = this.getImagePoint(e);

      switch (this.currentType) {
         case 'marker':
            this.handleMarkerMouseUp(e, pt);
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

   // ============ Marker标注 ============
   private handleMarkerMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.markerPosition = pt;
      this.finishMarkerDraw();
   }

   private handleMarkerMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
      // Marker标注不需要移动过程
   }

   private handleMarkerMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
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
      this.renderPreviewLine();
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

      // 清理预览元素
      this.removePreviewElement('preview-line');
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

      this.renderPreviewCircle();
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

      // 清理预览元素
      this.removePreviewElement('preview-circle');
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

      this.renderPreviewRect();
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

      // 清理预览元素
      this.removePreviewElement('preview-rect');
   }

   // ============ 椭圆、正方形、多边形、自由绘制等（暂时略过，后续补充） ============
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
      this.renderPreviewEllipse();
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

      this.removePreviewElement('preview-ellipse');
   }

   private handleSquareMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();
      this.drawing = true;
      this.squareStart = pt;
   }

   private handleSquareMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
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

   private handlePolygonMouseDown(e: MouseEvent, pt: { x: number; y: number }) {
      e.stopPropagation();

      // 检测是否点击了第一个点来闭合多边形（需要至少3个点）
      if (this.polygonPoints.length >= 3) {
         const firstPoint = this.polygonPoints[0];
         const firstPointScreen =
            this.viewer.viewport.imageToViewerElementCoordinates(
               new OpenSeadragon.Point(firstPoint.x, firstPoint.y)
            );
         const clickPointScreen =
            this.viewer.viewport.imageToViewerElementCoordinates(
               new OpenSeadragon.Point(pt.x, pt.y)
            );

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
      this.renderPreviewPolygon();
   }

   private handlePolygonMouseMove(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing || this.polygonPoints.length === 0) return;

      // 移除旧预览
      this.removePreviewElement('preview-polygon');

      // 转换已有点到屏幕坐标
      const screenPoints = this.polygonPoints.map((p) =>
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(p.x, p.y)
         )
      );

      // 转换当前点到屏幕坐标
      const currentScreenPt =
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(pt.x, pt.y)
         );

      // 构建路径：已有所有点 + 当前鼠标位置
      const allPoints = [...screenPoints, currentScreenPt];
      const d = allPoints
         .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
         .join(' ');

      // 绘制预览路径
      const path = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'path'
      );
      path.setAttribute('id', 'preview-polygon');
      path.setAttribute('stroke', this.currentColor);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '5,5'); // 虚线表示预览
      path.setAttribute('fill', 'none');
      path.setAttribute('d', d);

      this.svgOverlay.appendChild(path);
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
      this.removePreviewElement('preview-polygon');
   }

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
      this.renderPreviewFreehand();
   }

   private handleFreehandMouseUp(e: MouseEvent, pt: { x: number; y: number }) {
      if (!this.drawing) return;
      this.drawing = false;
      this.finishFreehandDraw();
   }

   private finishFreehandDraw() {
      if (this.freehandPoints.length < 2) return;

      // 生成 SVG path data
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
      this.removePreviewElement('preview-freehand');
   }

   // ============ 预览渲染 ============
   private renderPreviewLine() {
      if (!this.svgOverlay || !this.lineStart || !this.lineEnd) return;

      this.removePreviewElement('preview-line');

      const pt1 = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(this.lineStart.x, this.lineStart.y)
      );
      const pt2 = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(this.lineEnd.x, this.lineEnd.y)
      );

      const line = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'line'
      );
      line.setAttribute('id', 'preview-line');
      line.setAttribute('stroke', this.currentColor);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('x1', String(pt1.x));
      line.setAttribute('y1', String(pt1.y));
      line.setAttribute('x2', String(pt2.x));
      line.setAttribute('y2', String(pt2.y));

      this.svgOverlay.appendChild(line);
   }

   private renderPreviewCircle() {
      if (!this.svgOverlay || !this.circleCenter || this.circleRadius === null)
         return;

      this.removePreviewElement('preview-circle');

      const center = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(this.circleCenter.x, this.circleCenter.y)
      );

      // 计算屏幕上的半径（近似）
      const radiusPoint = {
         x: this.circleCenter.x + this.circleRadius,
         y: this.circleCenter.y,
      };
      const screenRadiusPoint =
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(radiusPoint.x, radiusPoint.y)
         );
      const screenRadius = Math.abs(screenRadiusPoint.x - center.x);

      const circle = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'circle'
      );
      circle.setAttribute('id', 'preview-circle');
      circle.setAttribute('stroke', this.currentColor);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('cx', String(center.x));
      circle.setAttribute('cy', String(center.y));
      circle.setAttribute('r', String(screenRadius));

      this.svgOverlay.appendChild(circle);
   }

   private renderPreviewRect() {
      if (
         !this.svgOverlay ||
         !this.rectStart ||
         this.rectWidth === null ||
         this.rectHeight === null
      )
         return;

      this.removePreviewElement('preview-rect');

      const startScreen = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(this.rectStart.x, this.rectStart.y)
      );
      const endScreen = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(
            this.rectStart.x + this.rectWidth,
            this.rectStart.y + this.rectHeight
         )
      );

      const x = Math.min(startScreen.x, endScreen.x);
      const y = Math.min(startScreen.y, endScreen.y);
      const width = Math.abs(endScreen.x - startScreen.x);
      const height = Math.abs(endScreen.y - startScreen.y);

      const rect = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'rect'
      );
      rect.setAttribute('id', 'preview-rect');
      rect.setAttribute('stroke', this.currentColor);
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));

      this.svgOverlay.appendChild(rect);
   }

   private renderPreviewEllipse() {
      if (
         !this.svgOverlay ||
         !this.ellipseCenter ||
         this.ellipseRadiusX === null ||
         this.ellipseRadiusY === null
      )
         return;

      this.removePreviewElement('preview-ellipse');

      const centerScreen = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(this.ellipseCenter.x, this.ellipseCenter.y)
      );
      const rxScreen = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(
            this.ellipseCenter.x + this.ellipseRadiusX,
            this.ellipseCenter.y
         )
      );
      const ryScreen = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(
            this.ellipseCenter.x,
            this.ellipseCenter.y + this.ellipseRadiusY
         )
      );

      const rx = Math.abs(rxScreen.x - centerScreen.x);
      const ry = Math.abs(ryScreen.y - centerScreen.y);

      const ellipse = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'ellipse'
      );
      ellipse.setAttribute('id', 'preview-ellipse');
      ellipse.setAttribute('stroke', this.currentColor);
      ellipse.setAttribute('stroke-width', '2');
      ellipse.setAttribute('fill', 'none');
      ellipse.setAttribute('cx', String(centerScreen.x));
      ellipse.setAttribute('cy', String(centerScreen.y));
      ellipse.setAttribute('rx', String(rx));
      ellipse.setAttribute('ry', String(ry));

      this.svgOverlay.appendChild(ellipse);
   }

   private renderPreviewPolygon() {
      if (!this.svgOverlay || this.polygonPoints.length === 0) return;

      this.removePreviewElement('preview-polygon');

      // 转换所有点到屏幕坐标
      const screenPoints = this.polygonPoints.map((p) =>
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(p.x, p.y)
         )
      );

      // 如果只有一个点，绘制一个圆点
      if (screenPoints.length === 1) {
         const circle = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
         );
         circle.setAttribute('id', 'preview-polygon');
         circle.setAttribute('cx', String(screenPoints[0].x));
         circle.setAttribute('cy', String(screenPoints[0].y));
         circle.setAttribute('r', '3');
         circle.setAttribute('fill', this.currentColor);
         this.svgOverlay.appendChild(circle);
         return;
      }

      // 如果有多个点，绘制连接线
      const d = screenPoints
         .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
         .join(' ');

      const path = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'path'
      );
      path.setAttribute('id', 'preview-polygon');
      path.setAttribute('stroke', this.currentColor);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('d', d);

      this.svgOverlay.appendChild(path);
   }

   private renderPreviewFreehand() {
      if (!this.svgOverlay || this.freehandPoints.length < 2) return;

      this.removePreviewElement('preview-freehand');

      // 转换所有点到屏幕坐标
      const screenPoints = this.freehandPoints.map((p) =>
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(p.x, p.y)
         )
      );

      const d = screenPoints
         .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
         .join(' ');

      const path = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'path'
      );
      path.setAttribute('id', 'preview-freehand');
      path.setAttribute('stroke', this.currentColor);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('d', d);

      this.svgOverlay.appendChild(path);
   }

   private removePreviewElement(id: string) {
      if (this.svgOverlay) {
         const element = this.svgOverlay.querySelector(`#${id}`);
         if (element) {
            element.remove();
         }
      }
   }

   // ============ 完整图形渲染 ============
   private renderMarker(ann: Annotation) {
      const params = ann.params as MarkerParams;
      const pt = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.x, params.y)
      );

      // 创建marker图标（使用path绘制flag形状）
      const markerSize = 42; // marker的基本尺寸
      const scaleFactor = 0.04; // 缩放因子

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // 创建marker path
      const path = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'path'
      );
      path.setAttribute(
         'd',
         'M533 240c80 0 145 65 145 145S612 530 532 530s-145-65-145-145S453 240 532 240zM850 385c0-175-142-317-317-317S215 210 215 385c0 64 18 123 51 173L266 558l238 380c5 10 16 18 28 18s23-7 28-17l238-380L798 558C831 508 850 449 850 385'
      );
      path.setAttribute('data-id', ann.id);
      path.setAttribute('fill', ann.color);

      // 设置变换：移动到指定位置并缩放
      // 原始形状大小约为 635x318，缩放后约为 25.4x12.7
      const transform = `translate(${pt.x - 21}, ${
         pt.y - 39
      }) scale(${scaleFactor})`;
      path.setAttribute('transform', transform);

      group.appendChild(path);
      this.svgOverlay?.appendChild(group);
   }

   private renderLine(ann: Annotation) {
      const params = ann.params as LineParams;
      const pt1 = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.x1, params.y1)
      );
      const pt2 = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.x2, params.y2)
      );

      const line = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'line'
      );
      line.setAttribute('data-id', ann.id);
      line.setAttribute('stroke', ann.color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('x1', String(pt1.x));
      line.setAttribute('y1', String(pt1.y));
      line.setAttribute('x2', String(pt2.x));
      line.setAttribute('y2', String(pt2.y));

      this.svgOverlay?.appendChild(line);
   }

   private renderCircle(ann: Annotation) {
      const params = ann.params as CircleParams;
      const center = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.cx, params.cy)
      );
      const radiusPoint = {
         x: params.cx + params.r,
         y: params.cy,
      };
      const screenRadiusPoint =
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(radiusPoint.x, radiusPoint.y)
         );
      const screenRadius = Math.abs(screenRadiusPoint.x - center.x);

      const circle = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'circle'
      );
      circle.setAttribute('data-id', ann.id);
      circle.setAttribute('stroke', ann.color);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('fill', '#334c6b');
      circle.style.fillOpacity = '0'; // 透明填充，但可响应点击
      circle.setAttribute('cx', String(center.x));
      circle.setAttribute('cy', String(center.y));
      circle.setAttribute('r', String(screenRadius));

      this.svgOverlay?.appendChild(circle);
   }

   private renderEllipse(ann: Annotation) {
      const params = ann.params as EllipseParams;
      const center = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.cx, params.cy)
      );
      const rxScreen = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.cx + params.rx, params.cy)
      );
      const ryScreen = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.cx, params.cy + params.ry)
      );

      const rx = Math.abs(rxScreen.x - center.x);
      const ry = Math.abs(ryScreen.y - center.y);

      const ellipse = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'ellipse'
      );
      ellipse.setAttribute('data-id', ann.id);
      ellipse.setAttribute('stroke', ann.color);
      ellipse.setAttribute('stroke-width', '2');
      ellipse.setAttribute('fill', '#334c6b');
      ellipse.style.fillOpacity = '0'; // 透明填充，但可响应点击
      ellipse.setAttribute('cx', String(center.x));
      ellipse.setAttribute('cy', String(center.y));
      ellipse.setAttribute('rx', String(rx));
      ellipse.setAttribute('ry', String(ry));

      this.svgOverlay?.appendChild(ellipse);
   }

   private renderRect(ann: Annotation) {
      const params = ann.params as RectParams;
      const start = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.x, params.y)
      );
      const end = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(
            params.x + params.width,
            params.y + params.height
         )
      );

      const rect = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'rect'
      );
      rect.setAttribute('data-id', ann.id);
      rect.setAttribute('stroke', ann.color);
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('fill', '#334c6b');
      rect.style.fillOpacity = '0'; // 透明填充，但可响应点击
      rect.setAttribute('x', String(start.x));
      rect.setAttribute('y', String(start.y));
      rect.setAttribute('width', String(end.x - start.x));
      rect.setAttribute('height', String(end.y - start.y));

      this.svgOverlay?.appendChild(rect);
   }

   private renderSquare(ann: Annotation) {
      const params = ann.params as SquareParams;
      const start = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.x, params.y)
      );
      const end = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.x + params.side, params.y + params.side)
      );

      const rect = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'rect'
      );
      rect.setAttribute('data-id', ann.id);
      rect.setAttribute('stroke', ann.color);
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('fill', '#334c6b');
      rect.style.fillOpacity = '0'; // 透明填充，但可响应点击
      rect.setAttribute('x', String(start.x));
      rect.setAttribute('y', String(start.y));
      rect.setAttribute('width', String(end.x - start.x));
      rect.setAttribute('height', String(end.y - start.y));

      this.svgOverlay?.appendChild(rect);
   }

   private renderPolygon(ann: Annotation) {
      const params = ann.params as PolygonParams;
      const screenPoints = params.points.map((p) =>
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(p.x, p.y)
         )
      );

      const pointsString = screenPoints
         .map((pt) => `${pt.x},${pt.y}`)
         .join(' ');

      const polygon = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'polygon'
      );
      polygon.setAttribute('data-id', ann.id);
      polygon.setAttribute('stroke', ann.color);
      polygon.setAttribute('stroke-width', '2');
      polygon.setAttribute('fill', '#334c6b');
      polygon.style.fillOpacity = '0'; // 透明填充，但可响应点击
      polygon.setAttribute('points', pointsString);

      this.svgOverlay?.appendChild(polygon);
   }

   private renderFreehand(ann: Annotation) {
      const params = ann.params as FreehandParams;
      const screenPoints = params.points.map((p) =>
         this.viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(p.x, p.y)
         )
      );

      const d = screenPoints
         .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
         .join(' ');

      const path = document.createElementNS(
         'http://www.w3.org/2000/svg',
         'path'
      );
      path.setAttribute('data-id', ann.id);
      path.setAttribute('stroke', ann.color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', '#334c6b');
      path.style.fillOpacity = '0'; // 透明填充，但可响应点击
      path.setAttribute('d', d);

      this.svgOverlay?.appendChild(path);
   }

   // ============ 显示标注弹窗 ============
   /**
    * 获取图形元素在视口中的边界框
    * @param elementId 图形元素的 data-id
    */
   private getShapeBoundingBox(elementId: string): DOMRect | null {
      const element = this.svgOverlay?.querySelector(
         `[data-id="${elementId}"]`
      );
      if (!element) return null;
      return element.getBoundingClientRect();
   }

   private showAnnotationPopupForMarker(annotation: Annotation) {
      const params = annotation.params as MarkerParams;
      const screenPt = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.x, params.y)
      );

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

      const midPt = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(
            (params.x1 + params.x2) / 2,
            (params.y1 + params.y2) / 2
         )
      );

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
      const center = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.cx, params.cy)
      );

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
      const center = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(params.cx, params.cy)
      );

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
      const centerPt = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(
            params.x + params.width / 2,
            params.y + params.height / 2
         )
      );

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
      const centerPt = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(
            params.x + params.side / 2,
            params.y + params.side / 2
         )
      );

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

      const centerPt = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(centerX, centerY)
      );

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

      const centerPt = this.viewer.viewport.imageToViewerElementCoordinates(
         new OpenSeadragon.Point(centerX, centerY)
      );

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
