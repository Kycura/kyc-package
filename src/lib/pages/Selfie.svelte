<script lang="ts">
  import CameraPhoto, { CaptureConfigOption, FACING_MODES } from 'jslib-html5-camera-photo';
  import { T } from '../contexts/translation';
  import { configuration } from '../contexts/configuration';
  import { onDestroy, onMount } from 'svelte';
  import {
    IconButton,
    IconCloseButton,
    Loader,
    Overlay,
    Paragraph,
    VideoContainer,
  } from '../atoms';
  import { Elements } from '../contexts/configuration/types';
  import { goToNextStep, goToPrevStep } from '../contexts/navigation';
  import { currentStepId, DocumentType } from '../contexts/app-state';
  import Title from '../atoms/Title/Title.svelte';
  import { appState, selfieUri } from '../contexts/app-state/stores';
  import { isMobile } from '../utils/is-mobile';
  import { createToggle } from '../hooks/createToggle/createToggle';
  import { preloadNextStepByCurrent } from '../services/preload-service';
  import { ActionNames, sendButtonClickEvent, VerificationStatuses } from '../utils/event-service';
  import { getLayoutStyles, getStepConfiguration } from '../ui-packs';
  import {
    loadFaceDetectionModels,
    createFaceDetectionLoop,
    type FaceDetectionResult,
  } from '../services/face-detection';

  let video: HTMLVideoElement;
  let cameraPhoto: CameraPhoto | undefined = undefined;

  export let stepId;

  const step = getStepConfiguration($configuration, stepId);
  const stepNamespace = step.namespace!;
  const style = getLayoutStyles($configuration, step);

  const [isDisabled, , toggleOnIsDisabled, toggleOffIsDisabled] = createToggle(true);

  const facingMode = isMobile() ? FACING_MODES.USER : FACING_MODES.ENVIRONMENT;
  let stream: MediaStream;

  // Face detection state
  let faceDetected = false;
  let faceCentered = false;
  let faceFrontal = false;
  let faceProperSize = false;
  let stableFrames = 0;
  let countdown = 0;
  let stopDetectionLoop: (() => void) | null = null;
  let modelsReady = false;
  let isCapturing = false;

  // Auto-capture settings
  const DETECTION_INTERVAL_MS = 250;
  const COUNTDOWN_SECONDS = 5;
  const FRAMES_PER_SECOND = 1000 / DETECTION_INTERVAL_MS; // 4 frames per second
  const REQUIRED_STABLE_FRAMES = COUNTDOWN_SECONDS * FRAMES_PER_SECOND; // 20 frames = 5 seconds

  // All conditions must be met for a valid selfie
  $: faceReady = faceDetected && faceCentered && faceFrontal && faceProperSize;

  const handleFaceDetectionResult = (result: FaceDetectionResult) => {
    if (isCapturing) return;

    faceDetected = result.detected;
    faceCentered = result.centered;
    faceFrontal = result.frontal;
    faceProperSize = result.properSize;

    if (faceReady) {
      stableFrames++;

      // Calculate countdown in actual seconds remaining
      const framesRemaining = REQUIRED_STABLE_FRAMES - stableFrames;
      const secondsRemaining = Math.ceil(framesRemaining / FRAMES_PER_SECOND);
      countdown = secondsRemaining;

      // Auto-capture when stable for long enough
      if (stableFrames >= REQUIRED_STABLE_FRAMES) {
        countdown = 0;
        handleTakePhoto();
      }
    } else {
      stableFrames = 0;
      countdown = 0;
    }
  };

  const initFaceDetection = async () => {
    const loaded = await loadFaceDetectionModels();
    modelsReady = loaded;

    if (loaded && video) {
      stopDetectionLoop = createFaceDetectionLoop(video, handleFaceDetectionResult, 250);
    }
  };

  onMount(() => {
    if (!video) return;
    cameraPhoto = new CameraPhoto(video);
    cameraPhoto
      .startCamera(facingMode, {
        width: 1920,
        height: 1080,
      })
      .then(cameraStream => {
        console.log('stream', cameraStream);
        stream = cameraStream;
        toggleOffIsDisabled();

        // Initialize face detection after camera is ready
        initFaceDetection();
      })
      .catch(error => {
        console.log('error', error);
      });
  });

  onDestroy(() => {
    cameraPhoto?.stopCamera();
    if (stopDetectionLoop) {
      stopDetectionLoop();
    }
  });

  const handleTakePhoto = () => {
    if (!cameraPhoto || $isDisabled || isCapturing) return;

    isCapturing = true;

    // Stop face detection loop
    if (stopDetectionLoop) {
      stopDetectionLoop();
      stopDetectionLoop = null;
    }

    $selfieUri = cameraPhoto.getDataUri(
      $configuration.settings?.selfieCameraSettings as CaptureConfigOption,
    );

    goToNextStep(currentStepId, $configuration, $currentStepId);
    toggleOnIsDisabled();
  };

  // Get status message for the user
  $: statusMessage = (() => {
    if (!modelsReady) return '';
    if (!faceDetected) return 'Position your face in the circle';
    if (!faceFrontal) return 'Look straight at the camera';
    if (!faceProperSize) return 'Move closer or further';
    if (!faceCentered) return 'Center your face in the circle';
    // Show countdown when < 5 seconds remaining (after initial "Hold still...")
    if (countdown > 0 && countdown < COUNTDOWN_SECONDS) return countdown.toString();
    return 'Hold still...';
  })();

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
    {#if element.type === Elements.IconCloseButton}
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
    {#if element.type === Elements.VideoContainer}
      <VideoContainer configuration={element.props} isSelfie>
        <!-- svelte-ignore a11y-media-has-caption -->
        <video bind:this={video} autoplay playsinline />
      </VideoContainer>
    {/if}
    {#if element.type === Elements.Loader && stream === undefined}
      <Loader />
    {/if}
  {/each}
  <div class="header">
    {#each step.elements as element}
      {#if element.type === Elements.Title}
        <Title configuration={element.props}>
          <T key={'title'} namespace={stepNamespace} />
        </Title>
      {/if}
      {#if element.type === Elements.Paragraph}
        <Paragraph configuration={element.props}>
          <T key={'description'} namespace={stepNamespace} />
        </Paragraph>
      {/if}
    {/each}
  </div>
  <Overlay type={DocumentType.SELFIE} detected={faceReady} />

  <!-- Face detection status indicator -->
  {#if modelsReady && stream !== undefined}
    <div
      class="face-status"
      class:detected={faceDetected}
      class:frontal={faceFrontal}
      class:properSize={faceProperSize}
      class:centered={faceCentered}
      class:ready={faceReady}
      class:countdown={countdown > 0 && countdown < COUNTDOWN_SECONDS}
    >
      {statusMessage}
    </div>
  {/if}

</div>

<style>
  .container {
    height: 100%;
    position: var(--position);
    background: var(--background);
    padding: var(--padding);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* Face detection status indicator */
  .face-status {
    z-index: 10;
    padding: 10px 20px;
    border-radius: 24px;
    background: rgba(255, 100, 100, 0.85);
    color: white;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
    margin-top: 12px;
    backdrop-filter: blur(4px);
  }

  /* Face detected but not frontal */
  .face-status.detected {
    background: rgba(255, 150, 80, 0.85);
  }

  /* Face detected and frontal */
  .face-status.detected.frontal {
    background: rgba(255, 180, 80, 0.85);
  }

  /* Face detected, frontal, and proper size */
  .face-status.detected.frontal.properSize {
    background: rgba(250, 200, 80, 0.85);
  }

  /* All conditions met - ready for capture */
  .face-status.ready {
    background: rgba(74, 222, 128, 0.85);
  }

  .face-status.countdown {
    font-size: 32px;
    font-weight: 700;
    padding: 16px 32px;
    background: rgba(74, 222, 128, 0.95);
    animation: pulse 0.5s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.1);
    }
  }
</style>
