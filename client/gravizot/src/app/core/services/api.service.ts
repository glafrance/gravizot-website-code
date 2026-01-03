import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpService } from './http.service';
import { API_ENDPOINTS, API_BASE_URL } from '../constants/api.constants';
import {
  ChatRequest,
  ChatResponse,
  UploadResponse,
  UsageSnapshot,
  VectorStoreSummary,
  ApiOk,
  UsageSnapshotResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpService);

  /** Upload documents to a vector store (multipart/form-data). */
  ingestUploadFiles(
    vsId: string,
    files: File[]
  ): Observable<UploadResponse> {
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);
    return this.http.postForm<UploadResponse>(API_BASE_URL, `${API_ENDPOINTS.INGEST_UPLOAD_FILES}?vsId=${vsId}`, form);
  }

  /** Send a chat message to the LLM. */
  sendChat(body: ChatRequest): Observable<ChatResponse> {
    return this.http.postJson<ChatResponse>(API_BASE_URL, API_ENDPOINTS.SEND_CHAT, body);
  }

  /** Get all vector stores. */
  getVectorStores(): Observable<VectorStoreSummary> {
    return this.http.get<VectorStoreSummary>(API_BASE_URL, API_ENDPOINTS.VECTOR_STORES);
  }

  /** Create a new vector store. */
  createVectorStore(name: string): Observable<ApiOk> {
    return this.http.postJson<ApiOk>(API_BASE_URL, API_ENDPOINTS.CREATE_VECTOR_STORE, { name });
  }

  /** Get all files uploaded to a specific vector store. */
  getClientVectorStoreFiles(vsId: string): Observable<UploadResponse> {
    return this.http.get<UploadResponse>(API_BASE_URL, API_ENDPOINTS.CLIENT_VECTOR_STORE_FILES(vsId));
  }

  /**
   * Get usage for a specific vector store (expects ?client=...).
   * If your backend expects an id instead of name, pass that here.
   */
  getTokenUsage(client: string): Observable<UsageSnapshotResponse> {
    return this.http.get<UsageSnapshotResponse>(API_BASE_URL, API_ENDPOINTS.STORE_USAGE_SNAPSHOT(client));
  }

  /** Real-time usage stream via SSE (expects ?client=...). */
  getTokenUsageStream(client: string) {
    return this.http.stream<UsageSnapshot>(API_BASE_URL, API_ENDPOINTS.STORE_USAGE_SNAPSHOT_STREAM(client));
  }

  /** Delete a file from a vector store. */
  deleteClientVectorStoreFile(client: string, fileId: string): Observable<ApiOk> {
    return this.http.delete<ApiOk>(API_BASE_URL, API_ENDPOINTS.DELETE_CLIENT_VECTOR_STORE_FILE(client, fileId));
  }

  /** Delete a vector store using the client. */
  deleteClientVectorStore(client: string): Observable<ApiOk> {
    return this.http.delete<ApiOk>(API_BASE_URL, API_ENDPOINTS.DELETE_CLIENT_VECTOR_STORE(client));
  }

  /** Delete a vector store using the vector store id. */
  deleteVectorStore(vsId: string): Observable<ApiOk> {
    return this.http.delete<ApiOk>(API_BASE_URL, API_ENDPOINTS.DELETE_VECTOR_STORE(vsId));
  }

  /** Delete all vector stores by name. */
  deleteAllVectorStoresByName(name: string): Observable<ApiOk> {
    return this.http.delete<ApiOk>(API_BASE_URL, API_ENDPOINTS.DELETE_ALL_VECTOR_STORES_BY_NAME(name));
  }
}
