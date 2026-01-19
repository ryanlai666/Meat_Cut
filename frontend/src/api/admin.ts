import apiClient from './client';

export interface AdminMeatCut {
  id: number;
  name: string;
  chineseName: string;
  part: string;
  lean: boolean;
  priceRange: {
    min: number;
    max: number;
    mean: number;
    display: string;
  };
  cookingMethods: string[];
  recommendedDishes: string[];
  textureNotes: string;
  imageReference: string;
  googleDriveImageId?: string | null;
  googleDriveImageUrl?: string | null;
  imageUrl: string | null;
  slug: string;
}

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  message?: string;
  error?: {
    message: string;
  };
}

// Admin API functions
export const adminApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post('/admin/login', { username, password });
    return response.data;
  },

  getMeatCuts: async (page = 1, limit = 1000): Promise<{ meatCuts: AdminMeatCut[]; total: number }> => {
    const response = await apiClient.get('/admin/meat-cuts', {
      params: { page, limit }
    });
    return response.data;
  },

  getMeatCut: async (id: number): Promise<AdminMeatCut> => {
    const response = await apiClient.get(`/admin/meat-cuts/${id}`);
    return response.data;
  },

  createMeatCut: async (data: FormData): Promise<AdminMeatCut> => {
    const response = await apiClient.post('/admin/meat-cuts', data, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      transformRequest: [(data) => data] // Don't transform FormData
    });
    return response.data;
  },

  updateMeatCut: async (id: number, data: FormData): Promise<AdminMeatCut> => {
    const response = await apiClient.put(`/admin/meat-cuts/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      transformRequest: [(data) => data] // Don't transform FormData
    });
    return response.data;
  },

  deleteMeatCuts: async (ids: number[]): Promise<{ success: boolean; deleted: number; deletedIds: number[]; errors: any[] }> => {
    const response = await apiClient.post('/admin/meat-cuts/bulk-delete', { ids });
    return response.data;
  },

  getDriveImages: async (): Promise<DriveImage[]> => {
    const response = await apiClient.get('/admin/drive/images');
    return response.data.images || [];
  },

  getTags: async (): Promise<{ parts: string[]; cookingMethods: string[] }> => {
    const response = await apiClient.get('/admin/tags');
    return response.data;
  },

  syncCSVToDrive: async (): Promise<{ success: boolean; message: string; file: any }> => {
    const response = await apiClient.post('/admin/sync/csv-to-drive');
    return response.data;
  },

  getDriveCSVFiles: async (): Promise<{ success: boolean; files: any[] }> => {
    const response = await apiClient.get('/admin/drive/csv');
    return response.data;
  },

  downloadDriveCSV: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/admin/drive/csv/${id}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  deleteDriveCSV: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/drive/csv/${id}`);
    return response.data;
  },

  uploadImageToDrive: async (file: File, fileName?: string): Promise<{ success: boolean; file: any }> => {
    const formData = new FormData();
    formData.append('imageFile', file);
    if (fileName) {
      formData.append('fileName', fileName);
    }
    const response = await apiClient.post('/admin/drive/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      transformRequest: [(data) => data]
    });
    return response.data;
  },

  getSyncStatus: async (): Promise<{
    success: boolean;
    status: {
      database: any;
      googleDrive: any;
      syncStatus: any;
    };
  }> => {
    const response = await apiClient.get('/admin/sync/status');
    return response.data;
  },

  exportCSV: async (): Promise<Blob> => {
    const response = await apiClient.get('/admin/export/csv', {
      responseType: 'blob'
    });
    return response.data;
  }
};

// Set auth token for API client
export const setAuthToken = (token: string | null) => {
  if (token) {
    // Use the token as API key for authentication
    apiClient.defaults.headers.common['X-API-Key'] = token;
    localStorage.setItem('admin_token', token);
  } else {
    delete apiClient.defaults.headers.common['X-API-Key'];
    localStorage.removeItem('admin_token');
  }
};

// Get auth token from localStorage
export const getAuthToken = (): string | null => {
  return localStorage.getItem('admin_token');
};

// Initialize auth token on load
const savedToken = getAuthToken();
if (savedToken) {
  setAuthToken(savedToken);
}
