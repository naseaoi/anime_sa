/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBDAV_URL: string
  readonly VITE_WEBDAV_USERNAME: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
