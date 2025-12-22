<script lang="ts">
  import { T } from '../contexts/translation';
  import { IconButton, IconCloseButton, Image, NextStepButton, Paragraph, Title, QRcode } from '../atoms';
  import { configuration } from '../contexts/configuration';
  import { Elements } from '../contexts/configuration/types';
  import { goToPrevStep } from '../contexts/navigation';
  import { appState, currentStepId } from '../contexts/app-state';
  import { ActionNames, sendButtonClickEvent, VerificationStatuses } from '../utils/event-service';
  import { getLayoutStyles, getStepConfiguration } from '../ui-packs';
  import { getFlowConfig } from '../contexts/flows/hooks';
  import { preloadNextStepByCurrent } from '../services/preload-service';

  export let stepId;

  const step = getStepConfiguration($configuration, stepId);
  const flow = getFlowConfig($configuration);
  const style = getLayoutStyles($configuration, step);

  const stepNamespace = step.namespace!;

  // Get QR code image URL from step configuration
  const qrCodeImageUrl = step.qrCodeUrl || '';

  preloadNextStepByCurrent($configuration, configuration, stepId);
</script>

<div class="container" {style}>
  <div class="content">
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
      {#if element.type === Elements.Image}
        <Image configuration={element.props} />
      {/if}
      {#if element.type === Elements.Title}
        <Title configuration={element.props}>
          <T key="title" namespace={stepNamespace} />
        </Title>
      {/if}
      {#if element.type === Elements.Paragraph}
        <Paragraph configuration={element.props}>
          <T key={element.props.context || 'description'} namespace={stepNamespace} />
        </Paragraph>
      {/if}
      {#if element.type === Elements.QRcode}
        <div class="qrcode-wrapper">
          <QRcode configuration={element.props} url={qrCodeImageUrl} />
        </div>
      {/if}
    {/each}
  </div>
  
  <div class="button-wrapper">
    {#each step.elements as element}
      {#if element.type === Elements.Button}
        <NextStepButton configuration={element.props}>
          <T key="button" namespace={stepNamespace} />
        </NextStepButton>
      {/if}
    {/each}
    <div class="camera-note">
      <T key="camera-note" namespace={stepNamespace} />
    </div>
  </div>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--padding);
    position: var(--position);
    background: var(--background);
    line-height: var(--line-height);
    text-align: center;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .qrcode-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    margin: 2rem 0;
  }

  .button-wrapper {
    margin-top: auto;
    padding-bottom: 2rem;
  }

  .camera-note {
    font-size: 12px;
    color: #666;
    margin-top: 8px;
    text-align: center;
  }
</style> 