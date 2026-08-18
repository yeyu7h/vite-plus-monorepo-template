<script setup lang="ts">
import { Page } from '@monorepo-admin-core/common-ui'
</script>

<template>
  <Page fill-height>
    <iframe
      class="min-h-0 flex-1 border-0"
      loading="lazy"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      src="https://www.google.com/maps/embed/v1/place?key=AIzaSyAXdm_DGhnPBVBGZTcLEqMc_cdzTtoBHHs&q=Shanghai"
    >
    </iframe>
  </Page>
</template>
