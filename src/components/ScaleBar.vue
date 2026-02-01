<template>
   <div class="scale-bar-wrapper absolute bottom-4 left-4 z-[10000]">
      <div
         class="inline-flex items-center justify-center rounded-full bg-black bg-opacity-40"
      >
         <canvas
            ref="scaleBarCanvasRef"
            :width="canvasWidth"
            :height="canvasHeight"
            class="z-[10001] pointer-events-none bg-transparent"
         />
      </div>
   </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject, watch, nextTick } from 'vue';

// Define props
interface Props {
   rate?: string; // ratio, default '20'
   calibration?: string; // conversion value from px to actual distance, default '0.44'
   tileSourceParams?: Record<string, any>; // tile source params
   viewer?: () => any; // OpenSeadragon viewer instance as function
}

const props = withDefaults(defineProps<Props>(), {
   rate: '20',
   calibration: '0.44',
   tileSourceParams: () => ({}),
   viewer: undefined,
});

// Reactive data
const basen = ref<number>(5); // Scale bar width calculation base
const ef = ref<number>(10); // Scale bar width calculation base
const ak = ref<number>(1); // Scale bar unit size scaling
const scale = ref<number>(1.0); // Current zoom level
const canvasWidth = ref<number>(180);
const canvasHeight = ref<number>(60);

// Refs
const scaleBarCanvasRef = ref<HTMLCanvasElement | null>(null);

// Event handler reference
let _osdScaleBarHandler: (() => void) | null = null;

// Get base value
const getBase = (v: number): number => {
   if (v >= 150 && v <= 300) {
      return ak.value;
   } else {
      const y = Math.floor(Math.log(v / 150) / Math.log(2));
      ak.value = Math.pow(2, y);
      return ak.value;
   }
};

// Get ruler parameters
const getRuler = (): { width: number; num: number; numText: string } => {
   const k = parseFloat(props.rate) * scale.value;
   const x = Math.floor(Math.log(k) / Math.log(2));
   const l = parseFloat(props.calibration);
   let basen2: number;
   let basen1: number;
   let rulern = 'mm';

   const powerX = Math.pow(2, x);
   ef.value = getBase(
      ((basen.value / parseFloat(props.calibration)) * 1000) /
         parseFloat(props.rate)
   );

   if (basen.value / powerX < 1) {
      basen2 = basen.value / powerX / ef.value;
      basen1 = parseFloat((basen2 * 200).toFixed(2));
      rulern = 'μm';
   } else {
      basen2 = basen.value / powerX / ef.value;
      basen1 = parseFloat((basen2 / 5).toFixed(2));
   }

   const width =
      parseFloat(
         ((((basen2 * 1000) / l) * k) / parseFloat(props.rate) / 5).toFixed(0)
      ) - 4;

   return {
      width: width,
      num: basen1,
      numText: rulern,
   };
};

// Draw scale bar
const drawScaleBar = () => {
   if (!scaleBarCanvasRef.value) return;

   const leftMargin = 15; // Left "0" distance from canvas left
   const rightMargin = 40; // Right end distance from canvas right
   const barHeight = 10; // Vertical line height

   const dicparms = getRuler();
   canvasWidth.value = Math.ceil(dicparms.width + leftMargin + rightMargin);

   nextTick(() => {
      if (!scaleBarCanvasRef.value) return;

      const ctx = scaleBarCanvasRef.value.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

      const x0 = leftMargin;
      const y0 = canvasHeight.value - barHeight - 30; // Horizontal line above

      // Horizontal line (above)
      ctx.save();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + dicparms.width, y0);
      ctx.stroke();

      // Two vertical lines (extending downward from both ends of the horizontal line)
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0); // Left end
      ctx.lineTo(x0, y0 + barHeight);
      ctx.moveTo(x0 + dicparms.width, y0); // Right end
      ctx.lineTo(x0 + dicparms.width, y0 + barHeight);
      ctx.stroke();

      // Left text "0"
      ctx.font = '14px Arial';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      ctx.fillText('0', x0, y0 + barHeight + 15);

      // Right text
      ctx.font = '14px Arial';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      ctx.fillText(
         dicparms.num.toFixed(2) + dicparms.numText,
         x0 + dicparms.width,
         y0 + barHeight + 15
      );
      ctx.restore();
   });
};

// Re-register event listeners
// const reRegisterHandler = () => {
//     // First remove old listeners (if exist)
//     if (props.viewer && _osdScaleBarHandler) {
//         const viewerInstance = props.viewer();
//         if (viewerInstance) {
//             viewerInstance.removeHandler('animation', _osdScaleBarHandler);
//         }
//     }

//     // Re-register listeners
//     if (props.viewer) {
//         const viewerInstance = props.viewer();
//         if (viewerInstance) {
//             _osdScaleBarHandler = () => {
//                 const containerSize = viewerInstance.viewport.getContainerSize();
//                 const zoom = viewerInstance.viewport.getZoom(true);
//                 scale.value =
//                     (containerSize.x * zoom) / props.tileSourceParams.width;
//                 drawScaleBar();
//             };
//             viewerInstance.addHandler('animation', _osdScaleBarHandler);

//             // Immediately update scale bar once
//             const containerSize = viewerInstance.viewport.getContainerSize();
//             const zoom = viewerInstance.viewport.getZoom(true);
//             scale.value = (containerSize.x * zoom) / props.tileSourceParams.width;
//             drawScaleBar();
//             console.log('Scale bar listener has been re-registered');
//         }
//     }
// };

// Watch props changes
watch(
   () => [props.rate, props.calibration, props.tileSourceParams],
   () => {
      if (props.viewer) {
         const viewerInstance = props.viewer();
         if (viewerInstance) {
            const containerSize = viewerInstance.viewport.getContainerSize();
            const zoom = viewerInstance.viewport.getZoom(true);
            scale.value =
               (containerSize.x * zoom) / props.tileSourceParams.width;
            drawScaleBar();
         }
      }
   },
   { deep: true }
);

onMounted(() => {
   console.log('Scale bar');
   console.log(props.rate, props.calibration);

   // Listen to OpenSeadragon zoom events
   if (props.viewer) {
      const viewerInstance = props.viewer();
      if (viewerInstance) {
         _osdScaleBarHandler = () => {
            const containerSize = viewerInstance.viewport.getContainerSize();
            const zoom = viewerInstance.viewport.getZoom(true);
            scale.value =
               (containerSize.x * zoom) / props.tileSourceParams.width; // Get current zoom level
            drawScaleBar();
         };
         viewerInstance.addHandler('animation', _osdScaleBarHandler);

         // Initialize
         console.log(
            'Initialize',
            viewerInstance.viewport.getContainerSize().x
         );
         console.log(viewerInstance.viewport.getZoom(true));
         console.log(props.tileSourceParams.width);
         const containerSize = viewerInstance.viewport.getContainerSize();
         const zoom = viewerInstance.viewport.getZoom(true);
         scale.value = (containerSize.x * zoom) / props.tileSourceParams.width;
         drawScaleBar();
      }
   }
});

onUnmounted(() => {
   // Remove event listeners
   if (props.viewer && _osdScaleBarHandler) {
      const viewerInstance = props.viewer();
      if (viewerInstance) {
         viewerInstance.removeHandler('animation', _osdScaleBarHandler);
      }
   }
});
</script>
