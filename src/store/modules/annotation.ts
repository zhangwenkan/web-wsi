import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
   Annotation,
   AnnotationType,
   ColorOption,
} from '@/types/annotation';
import { DefaultColors, DefaultShapes } from '@/types/annotation';

export const useAnnotationStore = defineStore('annotation', () => {
   // 状态
   const annotations = ref<Annotation[]>([]);
   const currentType = ref<AnnotationType | null>(null);
   const currentColor = ref<string>('#ff0000');
   const selectedIndex = ref<number | null>(null);
   const isMultiMode = ref<boolean>(false);
   const squareSize = ref<number>(256);

   // 计算属性
   const annotationsCount = computed(() => annotations.value.length);

   const selectedAnnotation = computed(() => {
      if (selectedIndex.value !== null) {
         return annotations.value[selectedIndex.value];
      }
      return null;
   });

   // Actions
   /**
    * 设置标注列表
    */
   const setAnnotations = (newAnnotations: Annotation[]) => {
      // 使用slice创建新数组的浅拷贝，确保Vue能检测到引用变化
      annotations.value = newAnnotations.slice();
   };

   /**
    * 添加标注
    */
   const addAnnotation = (annotation: Annotation) => {
      annotations.value.push(annotation);
   };

   /**
    * 更新标注
    */
   const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
      const index = annotations.value.findIndex((a) => a.id === id);
      if (index !== -1) {
         annotations.value[index] = { ...annotations.value[index], ...updates };
      }
   };

   /**
    * 删除标注
    */
   const deleteAnnotation = (id: string) => {
      const index = annotations.value.findIndex((a) => a.id === id);
      if (index !== -1) {
         annotations.value.splice(index, 1);
         // 如果删除的是当前选中的，重置选中状态
         if (selectedIndex.value === index) {
            selectedIndex.value = null;
         } else if (
            selectedIndex.value !== null &&
            selectedIndex.value > index
         ) {
            selectedIndex.value--;
         }
      }
   };

   /**
    * 清空所有标注
    */
   const clearAnnotations = () => {
      annotations.value = [];
      selectedIndex.value = null;
      currentType.value = null;
   };

   /**
    * 设置当前绘制类型
    */
   const setCurrentType = (type: AnnotationType | null) => {
      currentType.value = type;
   };

   /**
    * 设置当前颜色
    */
   const setCurrentColor = (color: string) => {
      currentColor.value = color;
   };

   /**
    * 设置选中索引
    */
   const setSelectedIndex = (index: number | null) => {
      selectedIndex.value = index;
   };

   /**
    * 切换多次标注模式
    */
   const toggleMultiMode = () => {
      isMultiMode.value = !isMultiMode.value;
      return isMultiMode.value;
   };

   /**
    * 设置多次标注模式
    */
   const setMultiMode = (value: boolean) => {
      isMultiMode.value = value;
   };

   /**
    * 设置正方形大小
    */
   const setSquareSize = (size: number) => {
      squareSize.value = size;
   };

   /**
    * 根据ID查找标注
    */
   const getAnnotationById = (id: string) => {
      return annotations.value.find((a) => a.id === id);
   };

   /**
    * 清空绘制状态（当取消绘制时）
    */
   const clearDrawState = () => {
      if (!isMultiMode.value) {
         currentType.value = null;
      }
   };

   return {
      // 状态
      annotations,
      currentType,
      currentColor,
      selectedIndex,
      isMultiMode,
      squareSize,
      DefaultColors,
      DefaultShapes,

      // 计算属性
      annotationsCount,
      selectedAnnotation,

      // Actions
      setAnnotations,
      addAnnotation,
      updateAnnotation,
      deleteAnnotation,
      clearAnnotations,
      setCurrentType,
      setCurrentColor,
      setSelectedIndex,
      toggleMultiMode,
      setMultiMode,
      setSquareSize,
      getAnnotationById,
      clearDrawState,
   };
});
