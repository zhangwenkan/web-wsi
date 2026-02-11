/**
 * 标注功能类型定义
 */

// 标注类型
export type AnnotationType =
   | 'marker'
   | 'line'
   | 'circle'
   | 'ellipse'
   | 'rect'
   | 'square'
   | 'polygon'
   | 'freehand';

// Marker图形参数
export interface MarkerParams {
   x: number;
   y: number;
}

// 线图形参数
export interface LineParams {
   x1: number;
   y1: number;
   x2: number;
   y2: number;
}

// 圆形参数
export interface CircleParams {
   cx: number;
   cy: number;
   r: number;
}

// 椭圆参数
export interface EllipseParams {
   cx: number;
   cy: number;
   rx: number;
   ry: number;
}

// 矩形参数
export interface RectParams {
   x: number;
   y: number;
   width: number;
   height: number;
}

// 正方形参数
export interface SquareParams {
   x: number;
   y: number;
   side: number;
}

// 多边形参数
export interface PolygonParams {
   points: Array<{ x: number; y: number }>;
}

// 自由绘制参数
export interface FreehandParams {
   d: string; // SVG path data
   points: Array<{ x: number; y: number }>;
}

// 所有图形参数的联合类型
export type AnnotationParams =
   | MarkerParams
   | LineParams
   | CircleParams
   | EllipseParams
   | RectParams
   | SquareParams
   | PolygonParams
   | FreehandParams;

// 标注接口
export interface Annotation {
   id: string;
   type: AnnotationType;
   color: string;
   info: string; // 备注信息
   params: AnnotationParams;
   readOnly?: boolean; // 是否只读（如AI标注）
}

// 标注编辑器选项
export interface AnnotationEditorOptions {
   allowMulti?: boolean; // 是否允许多次标注模式
   onEdit?: (annotations: Annotation[]) => void; // 标注编辑回调
   createAnnotationApi?: (annotation: Annotation) => Promise<any>; // 创建标注API
   updateAnnotationApi?: (annotation: Annotation) => Promise<any>; // 更新标注API
   deleteAnnotationApi?: (id: string) => Promise<any>; // 删除标注API
   onShowAnnotationPopup?: (params: PopupParams) => void; // 显示标注弹窗回调
   onAnnotationSelected?: (annotation: Annotation | null) => void; // 标注选中回调
}

// 弹窗参数
export interface PopupParams {
   type:
      | 'marker'
      | 'line'
      | 'circle'
      | 'ellipse'
      | 'rect'
      | 'square'
      | 'polygon'
      | 'freehand'
      | 'cancel';
   annotation?: Annotation;
   left?: number;
   top?: number;
   properties?: {
      length?: number;
      area?: number;
      horizontalDiameter?: number;
      verticalDiameter?: number;
   };
   onOk?: (annotation: Annotation) => void;
   onCancel?: () => void;
   onDelete?: () => void;
}

// 图形类型字典
export const AnnotationTypeDict: Record<AnnotationType, string> = {
   marker: 'flag',
   line: 'line',
   circle: 'circle',
   ellipse: 'ellipse',
   rect: 'rect',
   square: 'square',
   polygon: 'polygon',
   freehand: 'freehand',
};

// 预设颜色列表
export interface ColorOption {
   color: string;
   name: string;
}

export const DefaultColors: ColorOption[] = [
   { color: '#ff0000', name: 'red' },
   { color: '#00ff00', name: 'lime' },
   { color: '#0000ff', name: 'blue' },
   { color: '#ffff00', name: 'yellow' },
   { color: '#ffa500', name: 'orange' },
   { color: '#00ffff', name: 'aqua' },
];

// 图形形状列表
export interface ShapeOption {
   name: string;
   type: AnnotationType;
   icon?: string;
}

export const DefaultShapes: ShapeOption[] = [
   { name: 'marker', type: 'marker' },
   { name: 'line', type: 'line' },
   { name: 'ellipse', type: 'ellipse' },
   { name: 'rect', type: 'rect' },
   { name: 'polygon', type: 'polygon' },
   { name: 'freehand', type: 'freehand' },
   { name: 'circle', type: 'circle' },
   { name: 'square', type: 'square' },
];
