<script setup lang="ts">
definePage({
  meta: {
    contentMode: 'full',
  },
})
</script>

<template>
  <div class="min-h-0 flex-1">
    <iframe
      class="size-full border-0"
      loading="lazy"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      src="https://www.google.com/maps/embed/v1/place?key=AIzaSyAXdm_DGhnPBVBGZTcLEqMc_cdzTtoBHHs&q=Shanghai"
    >
    </iframe>
  </div>
</template>
