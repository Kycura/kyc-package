<script lang="ts">
  import { T } from '../contexts/translation';
  import { IconButton, IconCloseButton, Image, Paragraph, Photo, Title } from '../atoms';
  import { configuration } from '../contexts/configuration';
  import { Elements } from '../contexts/configuration/types';
  import { goToPrevStep } from '../contexts/navigation';
  import {
    appState,
    currentStepId,
    documents,
    getDocImage,
    IDocumentInfo,
    selectedDocumentInfo,
  } from '../contexts/app-state';
  import { NavigationButtons } from '../molecules';
  import { getLayoutStyles, getStepConfiguration } from '../ui-packs';
  import { preloadNextStepByCurrent } from '../services/preload-service';
  import { ActionNames, sendButtonClickEvent, VerificationStatuses } from '../utils/event-service';
  import { getFlowConfig } from '../contexts/flows/hooks';
  import { validateDocumentImage, type DocumentDetectionResult } from '../services/document-detection';

  export let stepId;

  const step = getStepConfiguration($configuration, stepId);
  const flow = getFlowConfig($configuration);
  const style = getLayoutStyles($configuration, step);

  const stepNamespace = step.namespace!;

  let image: string;
  let documentInfo: IDocumentInfo | undefined = undefined;

  // Document validation state
  let isValidating = false;
  let validationResult: DocumentDetectionResult | null = null;

  $: {
    documentInfo = step.documentInfo || $selectedDocumentInfo;
    if ($documents.length === 0 || !documentInfo) {
      goToPrevStep(currentStepId, $configuration, $currentStepId);
    }
    if (documentInfo) {
      image = getDocImage(documentInfo.type, $documents, 'back');
    }
  }

  // Validate the captured image for document presence
  $: if (image && !validationResult && !isValidating) {
    isValidating = true;
    validateDocumentImage(image).then(result => {
      validationResult = result;
      isValidating = false;
    });
  }

  preloadNextStepByCurrent($configuration, configuration, $currentStepId);
</script>

<div class="container" {style}>
  {#each step.elements as element}
    {#if element.type === Elements.IconButton}
      <IconButton
        configuration={element.props}
        on:click={() => goToPrevStep(currentStepId, $configuration, $currentStepId)}
      />
    {/if}
    {#if element.type === Elements.IconCloseButton && flow.showCloseButton}
      <IconCloseButton
        configuration={element.props}
        on:click={() => {
          sendButtonClickEvent(
            ActionNames.CLOSE,
            { status: VerificationStatuses.DATA_COLLECTION },
            $appState,
            true,
          );
        }}
      />
    {/if}
    {#if element.type === Elements.Title}
      <Title configuration={element.props}>
        <T key="title" namespace={stepNamespace} />
      </Title>
    {/if}
    {#if element.type === Elements.Paragraph}
      <Paragraph configuration={element.props}>
        <T key="description" namespace={stepNamespace} />
      </Paragraph>
    {/if}
    {#if element.type === Elements.Photo}
      <Photo configuration={element.props} src={image} />
    {/if}
    {#if element.type === Elements.Image}
      <Image configuration={element.props} />
    {/if}
  {/each}

  <!-- Document validation feedback -->
  {#if isValidating}
    <div class="validation-message validating">
      <span class="validation-icon">⏳</span>
      <span>Checking document...</span>
    </div>
  {:else if validationResult}
    {#if validationResult.detected && validationResult.confidence}
      <div class="validation-message success">
        <span class="validation-icon">✓</span>
        <span>Document detected successfully</span>
      </div>
    {:else if validationResult.detected}
      <div class="validation-message warning">
        <span class="validation-icon">⚠</span>
        <span>Document may be too small or unclear. Consider retaking.</span>
      </div>
    {:else}
      <div class="validation-message error">
        <span class="validation-icon">✕</span>
        <span>No document detected. Please retake the photo.</span>
      </div>
    {/if}
  {/if}

  <NavigationButtons />
</div>

<style>
  .container {
    padding: var(--padding);
    position: var(--position);
    background: var(--background);
    text-align: center;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .validation-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    margin: 16px auto;
    max-width: 320px;
    transition: all 0.3s ease;
  }

  .validation-message.validating {
    background: rgba(100, 100, 100, 0.1);
    color: #666;
  }

  .validation-message.success {
    background: rgba(72, 187, 120, 0.15);
    color: #2f855a;
  }

  .validation-message.warning {
    background: rgba(237, 137, 54, 0.15);
    color: #c05621;
  }

  .validation-message.error {
    background: rgba(245, 101, 101, 0.15);
    color: #c53030;
  }

  .validation-icon {
    font-size: 16px;
    font-weight: bold;
  }
</style>
