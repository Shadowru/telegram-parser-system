// dashboard/src/services/api.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/api/auth/login', { email, password });
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/api/auth/logout');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  // Channels
  async getChannels(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
    const response = await this.client.get('/api/channels', { params });
    return response.data;
  }

  async getChannel(id: number) {
    const response = await this.client.get(`/api/channels/${id}`);
    return response.data;
  }

  async createChannel(data: { username: string; parse_frequency?: number }) {
    const response = await this.client.post('/api/channels', data);
    return response.data;
  }

  async updateChannel(id: number, data: any) {
    const response = await this.client.put(`/api/channels/${id}`, data);
    return response.data;
  }

  async deleteChannel(id: number) {
    const response = await this.client.delete(`/api/channels/${id}`);
    return response.data;
  }

  async triggerParse(id: number) {
    const response = await this.client.post(`/api/channels/${id}/parse`);
    return response.data;
  }

  async getChannelMessages(id: number, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/api/channels/${id}/messages`, { params });
    return response.data;
  }

  async getChannelStats(id: number) {
    const response = await this.client.get(`/api/channels/${id}/stats`);
    return response.data;
  }

  // Jobs
  async getJobs(params?: { status?: string; channel_id?: number; limit?: number; offset?: number }) {
    const response = await this.client.get('/api/jobs', { params });
    return response.data;
  }

  async getJob(id: string) {
    const response = await this.client.get(`/api/jobs/${id}`);
    return response.data;
  }

  async cancelJob(id: string) {
    const response = await this.client.post(`/api/jobs/${id}/cancel`);
    return response.data;
  }

  // Workers
  async getWorkers(params?: { status?: string }) {
    const response = await this.client.get('/api/workers', { params });
    return response.data;
  }

  async getWorker(id: string) {
    const response = await this.client.get(`/api/workers/${id}`);
    return response.data;
  }

  // Analytics
  async getSystemStats() {
    const response = await this.client.get('/api/analytics/system');
    return response.data;
  }

  async getChannelAnalytics(id: number, params?: { period?: string }) {
    const response = await this.client.get(`/api/analytics/channels/${id}`, { params });
    return response.data;
  }

  async getTopChannels(params?: { metric?: string; limit?: number }) {
    const response = await this.client.get('/api/analytics/top-channels', { params });
    return response.data;
  }
}

export const apiService = new ApiService();