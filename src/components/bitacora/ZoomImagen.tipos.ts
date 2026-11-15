export interface ZoomImagenProps {
  uri: string;
  /** Se llama con la escala actual (1 = sin zoom). */
  onZoom?: (escala: number) => void;
}

export interface ZoomImagenRef {
  acercar: () => void;
  alejar: () => void;
  restablecer: () => void;
}
