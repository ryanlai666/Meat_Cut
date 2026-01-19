import apiClient from '../api/client';
import { MeatCut } from '../types';

export async function loadMeatCutData(): Promise<MeatCut[]> {
  try {
    const response = await apiClient.get('/meat-cuts/search');
    const { results } = response.data;
    
    const backendUrl = 'http://localhost:5000';
    
    return results.map((item: any) => {
      let imagePath = `/data/beef_cuts_images/${item.imageReference}.jpg`;
      
      // Priority: googleDriveImageId > imageUrl > googleDriveImageUrl > local fallback
      if (item.googleDriveImageId) {
        // Use backend proxy endpoint for Google Drive images
        imagePath = `${backendUrl}/api/drive/image/${item.googleDriveImageId}`;
      } else if (item.imageUrl) {
        // Use provided imageUrl (already from backend, might be relative)
        imagePath = item.imageUrl.startsWith('http') 
          ? item.imageUrl 
          : `${backendUrl}${item.imageUrl}`;
      } else if (item.googleDriveImageUrl) {
        // Use direct Google Drive URL if available
        imagePath = item.googleDriveImageUrl;
      }
      
      return {
        ...item,
        imagePath
      };
    });
  } catch (error) {
    console.error('Error loading meat cut data from API:', error);
    throw error;
  }
}
