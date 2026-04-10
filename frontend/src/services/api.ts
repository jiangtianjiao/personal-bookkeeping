import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

let isLoggingOut = false;

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response) {
          switch (error.response.status) {
            case 401:
              if (!isLoggingOut) {
                isLoggingOut = true;
                useAuthStore.getState().logout();
                isLoggingOut = false;
              }
              break;
            case 403:
              console.error('Access forbidden');
              break;
            case 404:
              console.error('Resource not found');
              break;
            case 500:
              console.error('Server error');
              break;
          }
        } else if (error.request) {
          console.error('Network error');
        } else {
          console.error('Request error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  private unwrap<T>(responseData: any): T {
    if (responseData && typeof responseData === 'object' && 'success' in responseData) {
      if ('pagination' in responseData) {
        // Paginated response: preserve { data, pagination } structure
        const { success: _, ...rest } = responseData;
        return rest as T;
      }
      if ('data' in responseData) {
        return responseData.data as T;
      }
    }
    return responseData as T;
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config);
    return this.unwrap<T>(response.data);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(url, data, config);
    return this.unwrap<T>(response.data);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(url, data, config);
    return this.unwrap<T>(response.data);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config);
    return this.unwrap<T>(response.data);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch(url, data, config);
    return this.unwrap<T>(response.data);
  }
}

export const apiService = new ApiService();
export default apiService;