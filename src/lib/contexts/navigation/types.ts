import { TSteps } from '../configuration/types';
import type { SvelteComponent } from 'svelte';

export interface IStep {
  name: TSteps;
  component: typeof SvelteComponent;
  type?: string;
}
