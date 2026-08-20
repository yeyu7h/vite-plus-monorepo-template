<script setup lang="ts"></script>

<template>
  <UDashboardNavbar :toggle="false" :ui="{ root: 'bg-[#FCFCFC] dark:bg-[#1A1A1A]' }">
    <template v-if="$slots.toggle" #toggle="slotProps">
      <slot name="toggle" v-bind="slotProps" />
    </template>

    <template v-if="$slots.left" #left="slotProps">
      <slot name="left" v-bind="slotProps" />
    </template>

    <template v-if="$slots.right" #right="slotProps">
      <slot name="right" v-bind="slotProps" />
    </template>
  </UDashboardNavbar>
</template>
