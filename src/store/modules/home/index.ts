import { defineStore } from 'pinia';
import pinia from '@/store';

export const useHomeStore = defineStore(
   // 唯一ID
   'Home',
   {
      state: () => ({}),
      getters: {},
      actions: {},
   }
);

export function useHomeStoreHook() {
   return useHomeStore(pinia);
}
