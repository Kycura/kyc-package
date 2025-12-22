<script lang="ts">
  import type { IElementProps } from '../../contexts/configuration/types';

  export let configuration: IElementProps;
  export let url: string;

  let imageLoaded = false;
  let imageError = false;

  const handleImageLoad = () => {
    imageLoaded = true;
  };

  const handleImageError = () => {
    imageError = true;
  };
</script>

<div class="qrcode-container" style="display: flex; justify-content: center; align-items: center;">
  {#if url && !imageError}
    <img 
      src={url} 
      alt="QR Code" 
      on:load={handleImageLoad}
      on:error={handleImageError}
      style="
        width: {configuration.style?.width || '200px'};
        height: {configuration.style?.height || '200px'};
        {configuration.style ? Object.entries(configuration.style).map(([key, value]) => `${key}: ${value}`).join('; ') : ''}
      "
    />
  {:else if imageError}
    <div class="error" style="width: {configuration.style?.width || '200px'}; height: {configuration.style?.height || '200px'}; display: flex; justify-content: center; align-items: center;">
      Failed to load QR code
    </div>
  {:else}
    <div class="loading" style="width: {configuration.style?.width || '200px'}; height: {configuration.style?.height || '200px'}; display: flex; justify-content: center; align-items: center;">
      Loading QR code...
    </div>
  {/if}
</div>

<style>
  .qrcode-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
  }

  .loading {
    border: 2px dashed #ccc;
    border-radius: 8px;
    color: #666;
    font-size: 14px;
  }

  .error {
    border: 2px dashed #ff6b6b;
    border-radius: 8px;
    color: #ff6b6b;
    font-size: 14px;
    text-align: center;
  }
</style> 