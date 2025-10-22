/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_MAX_BATCH_SIZE: string;
  readonly VITE_MAX_FILE_SIZE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}