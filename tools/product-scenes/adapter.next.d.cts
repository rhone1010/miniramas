/// <reference types="node" />
/** Renderer-only contract; not an HTTP, entitlement or approval contract. */
export function describeScene(sceneId: string): { sceneId: string; family: string; width: number; height: number; inputAspect: number; inputKind: 'rolled-full-wrap' | 'scene-composition'; productionGeometry: false };
export function revision(sceneId: string): string;
export function renderScene(input: { sceneId: string; productFamily: string; artworkId: string; artwork: Buffer }): Promise<{ png: Buffer; width: number; height: number; templateRevision: string; visualizationKey: string; metadata: Record<string, unknown> }>;
