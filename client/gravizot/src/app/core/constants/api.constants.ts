import { environment } from '../../../environments/environment';

// Adjust this for your environment (dev/prod). Keep same as server's ALLOWED_ORIGINS.
export const API_BASE_URL = environment.API_BASE;

export const API_ENDPOINTS = {
  CLIENT_VECTOR_STORE_FILES: (vsId: string) => `/api/stores/${vsId}/files`,
  CREATE_VECTOR_STORE: '/api/stores',
  DELETE_CLIENT_VECTOR_STORE_FILE: (client: string, fileId: string) => `/api/stores/${client}/files/${fileId}`,
  DELETE_CLIENT_VECTOR_STORE: (client: string) => `/api/stores/client/${client}`,
  DELETE_VECTOR_STORE: (vsId: string) => `/api/stores/vector/${vsId}`,
  DELETE_ALL_VECTOR_STORES_BY_NAME: (name: string) => `/api/cleanup/delete-all-by-name/${name}`,
  INGEST_UPLOAD_FILES: '/api/ingest/upload',
  SEND_CHAT: '/api/chat',
  STORE_USAGE_SNAPSHOT: (client: string) => `/api/usage?client=${client}`,
  STORE_USAGE_SNAPSHOT_STREAM: (client: string) => `/api/usage/stream?client=${client}`,
  VECTOR_STORES: '/api/stores',
} as const;

export const API = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    SIGNUP: `${API_BASE_URL}/auth/signup`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    ME: `${API_BASE_URL}/auth/me`,
    REFRESH: `${API_BASE_URL}/auth/refresh`,
    CSRF: `${API_BASE_URL}/auth/csrf`,
  },
  USER: {
    ME: `${API_BASE_URL}/users/me`
  },
  MISC: {
    GET_CSRF: `${API_BASE_URL}/contact/csrf`,
    CONTACT: `${API_BASE_URL}/contact`
  }
};
