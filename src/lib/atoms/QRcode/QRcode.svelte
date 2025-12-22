<script lang="ts">
  import { onMount } from 'svelte';
  import QRCodeLib from 'qrcode';
  import type { IElementProps } from '../../contexts/configuration/types';

  export let configuration: IElementProps;
  export let url: string;

  let canvas: HTMLCanvasElement;
  let isLoading = true;
  let hasError = false;

  const width = parseInt(configuration.style?.width as string) || 200;
  const height = parseInt(configuration.style?.height as string) || 200;

  onMount(() => {
    if (url && canvas) {
      generateQRCode();
    }
  });

  $: if (url && canvas) {
    generateQRCode();
  }

  async function generateQRCode() {
    if (!url || !canvas) return;
    
    isLoading = true;
    hasError = false;
    
    try {
      await QRCodeLib.toCanvas(canvas, url, {
        width: width,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      isLoading = false;
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      hasError = true;
      isLoading = false;
    }
  }
</script>

<div class="qrcode-container">
  {#if hasError}
    <div class="error" style="width: {width}px; height: {height}px;">
      Failed to generate QR code
    </div>
  {:else if !url}
    <div class="error" style="width: {width}px; height: {height}px;">
      No URL provided
    </div>
  {:else}
    <canvas 
      bind:this={canvas}
      class:loading={isLoading}
      style="width: {width}px; height: {height}px;"
    />
    {#if isLoading}
      <div class="loading-overlay" style="width: {width}px; height: {height}px;">
        Generating QR code...
      </div>
    {/if}
  {/if}
</div>

<style>
  .qrcode-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    position: relative;
  }

  canvas {
    border-radius: 8px;
  }

  canvas.loading {
    opacity: 0;
  }

  .loading-overlay {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 2px dashed #ccc;
    border-radius: 8px;
    color: #666;
    font-size: 14px;
  }

  .error {
    display: flex;
    justify-content: center;
    align-items: center;
    border: 2px dashed #ff6b6b;
    border-radius: 8px;
    color: #ff6b6b;
    font-size: 14px;
    text-align: center;
  }
</style>
