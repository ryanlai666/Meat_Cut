import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Autocomplete,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  IconButton,
  Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import ImageIcon from '@mui/icons-material/Image';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import DownloadIcon from '@mui/icons-material/Download';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { adminApi, AdminMeatCut, DriveImage, setAuthToken, getAuthToken } from '../api/admin';

interface MeatCutFormData {
  name: string;
  chineseName: string;
  part: string;
  lean: boolean;
  priceMin: string;
  priceMax: string;
  textureNotes: string;
  imageReference: string;
  tags: string[];
  imageFile: File | null;
  googleDriveImageId: string | null;
  currentImageUrl: string | null;
}

const initialFormData: MeatCutFormData = {
  name: '',
  chineseName: '',
  part: '',
  lean: false,
  priceMin: '',
  priceMax: '',
  textureNotes: '',
  imageReference: '',
  tags: [],
  imageFile: null,
  googleDriveImageId: null,
  currentImageUrl: null
};

export default function Admin() {
  const navigate = useNavigate();
  const [meatCuts, setMeatCuts] = useState<AdminMeatCut[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedMeatCut, setSelectedMeatCut] = useState<AdminMeatCut | null>(null);
  const [formData, setFormData] = useState<MeatCutFormData>(initialFormData);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [driveImages, setDriveImages] = useState<DriveImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageSelectDialogOpen, setImageSelectDialogOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [driveCSVFiles, setDriveCSVFiles] = useState<any[]>([]);
  const [showCSVFiles, setShowCSVFiles] = useState(false);

  // Check authentication
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [meatCutsData, tagsData, imagesData, statusData] = await Promise.all([
        adminApi.getMeatCuts(),
        adminApi.getTags(),
        adminApi.getDriveImages(),
        adminApi.getSyncStatus().catch(() => null)
      ]);
      setMeatCuts(meatCutsData.meatCuts);
      setAvailableTags([...tagsData.parts, ...tagsData.cookingMethods]);
      setDriveImages(imagesData);
      if (statusData?.status) {
        setSyncStatus(statusData.status);
      }
      await loadDriveCSVFiles();
    } catch (err: any) {
      if (err.response?.status === 401) {
        setAuthToken(null);
        navigate('/admin/login');
      } else {
        setError('Failed to load data: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDriveCSVFiles = async () => {
    try {
      const result = await adminApi.getDriveCSVFiles();
      setDriveCSVFiles(result.files || []);
    } catch (err) {
      console.error('Failed to load Drive CSV files:', err);
    }
  };

  const handleSyncCSVToDrive = async () => {
    try {
      setSyncing(true);
      setError('');
      setSuccess('');
      const result = await adminApi.syncCSVToDrive();
      setSuccess(`CSV synced to Google Drive: ${result.file.name}`);
      await loadDriveCSVFiles();
      await loadData();
    } catch (err: any) {
      setError('Sync failed: ' + (err.response?.data?.error?.message || err.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const blob = await adminApi.exportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meat_cuts_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('CSV downloaded successfully');
    } catch (err: any) {
      setError('Download failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDownloadDriveCSV = async (fileId: string, fileName: string) => {
    try {
      const blob = await adminApi.downloadDriveCSV(fileId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('CSV downloaded successfully');
    } catch (err: any) {
      setError('Download failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteDriveCSV = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this CSV file?')) return;
    
    try {
      await adminApi.deleteDriveCSV(fileId);
      setSuccess('CSV file deleted');
      await loadDriveCSVFiles();
    } catch (err: any) {
      setError('Delete failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSelectMeatCut = async (meatCut: AdminMeatCut) => {
    setSelectedMeatCut(meatCut);
    setFormData({
      name: meatCut.name,
      chineseName: meatCut.chineseName,
      part: meatCut.part,
      lean: meatCut.lean,
      priceMin: meatCut.priceRange.min.toString(),
      priceMax: meatCut.priceRange.max.toString(),
      textureNotes: meatCut.textureNotes || '',
      imageReference: meatCut.imageReference || '',
      tags: [...meatCut.cookingMethods],
      imageFile: null,
      googleDriveImageId: meatCut.googleDriveImageId || null,
      currentImageUrl: meatCut.imageUrl || null
    });
  };

  const handleAddClick = () => {
    setSelectedMeatCut(null);
    setFormData(initialFormData);
  };

  const handleClear = () => {
    setFormData(initialFormData);
    setSelectedMeatCut(null);
  };

  const handleCheckboxChange = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === meatCuts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(meatCuts.map(mc => mc.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      setSaving(true);
      const result = await adminApi.deleteMeatCuts(Array.from(selectedIds));
      if (result.success) {
        setSuccess(`Successfully deleted ${result.deleted} meat cut(s)`);
        setSelectedIds(new Set());
        if (selectedMeatCut && selectedIds.has(selectedMeatCut.id)) {
          setSelectedMeatCut(null);
          setFormData(initialFormData);
        }
        await loadData();
      } else {
        setError('Failed to delete some items');
      }
    } catch (err: any) {
      setError('Failed to delete: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (formData.tags.length === 0) {
      setError('At least one tag is required');
      return;
    }
    if (!formData.imageFile && !formData.googleDriveImageId && !formData.currentImageUrl) {
      setError('Image is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name.trim());
      if (formData.chineseName) {
        formDataToSend.append('chineseName', formData.chineseName.trim());
      }
      formDataToSend.append('part', formData.part || 'Other');
      formDataToSend.append('lean', formData.lean ? 'true' : 'false');
      formDataToSend.append('priceMin', formData.priceMin || '0');
      formDataToSend.append('priceMax', formData.priceMax || '0');
      formDataToSend.append('textureNotes', formData.textureNotes || '');
      formDataToSend.append('imageReference', formData.imageReference || '');
      
      // Add tags as cooking methods (append each tag separately)
      formData.tags.forEach(tag => {
        formDataToSend.append('cookingMethods', tag);
      });

      // Handle image
      if (formData.imageFile) {
        // Append file directly
        formDataToSend.append('imageFile', formData.imageFile);
      } else if (formData.googleDriveImageId) {
        formDataToSend.append('googleDriveImageId', formData.googleDriveImageId);
      } else if (selectedMeatCut && formData.currentImageUrl === selectedMeatCut.imageUrl) {
        // Keeping current image - no need to send anything for image as backend keeps existing if nothing new sent
      }

      if (selectedMeatCut) {
        // Update existing
        await adminApi.updateMeatCut(selectedMeatCut.id, formDataToSend);
        setSuccess('Meat cut updated successfully');
      } else {
        // Create new
        await adminApi.createMeatCut(formDataToSend);
        setSuccess('Meat cut added successfully');
        handleClear();
      }

      await loadData();
    } catch (err: any) {
      setError('Failed to save: ' + (err.response?.data?.error?.message || err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        imageFile: file,
        googleDriveImageId: null,
        currentImageUrl: null
      }));
    }
  };

  const handleImageFromDriveSelect = (imageId: string) => {
    setFormData(prev => ({
      ...prev,
      googleDriveImageId: imageId,
      imageFile: null,
      currentImageUrl: null
    }));
    setImageSelectDialogOpen(false);
  };

  const handleClearImage = () => {
    setFormData(prev => ({
      ...prev,
      imageFile: null,
      googleDriveImageId: null,
      currentImageUrl: null
    }));
  };

  const getImagePreview = () => {
    if (formData.imageFile) {
      return URL.createObjectURL(formData.imageFile);
    }
    
    const backendUrl = 'http://localhost:5000'; // Backend server URL
    
    // Priority: googleDriveImageId > currentImageUrl > imageReference
    if (formData.googleDriveImageId) {
      // Use backend proxy endpoint for Google Drive images
      return `${backendUrl}/api/drive/image/${formData.googleDriveImageId}`;
    }
    
    if (formData.currentImageUrl) {
      // currentImageUrl might be relative or absolute
      if (formData.currentImageUrl.startsWith('http')) {
        return formData.currentImageUrl;
      }
      // If relative, prepend backend URL
      return `${backendUrl}${formData.currentImageUrl}`;
    }
    
    // Fallback to local image if imageReference exists
    if (formData.imageReference) {
      return `/data/beef_cuts_images/${formData.imageReference}.jpg`;
    }
    return null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 2 }}>
      <Container maxWidth="xl">
        {/* Title Image */}
        <Box sx={{ mb: 2 }}>
          <img
            src="/data/admin-page-title.png"
            alt="Admin"
            style={{ maxHeight: '100px', objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </Box>

        {/* Sync Status and CSV Management */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Sync Status and CSV Management
              </Typography>
              {syncStatus && (
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {syncStatus.syncStatus?.imagesSynced ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <ErrorIcon color="warning" />
                    )}
                    <Typography variant="body2">
                      Images: {syncStatus.database?.imagesWithDriveId || 0}/{syncStatus.database?.meatCutsCount || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {syncStatus.googleDrive?.csvCount > 0 ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <ErrorIcon color="warning" />
                    )}
                    <Typography variant="body2">
                      CSV Files: {syncStatus.googleDrive?.csvCount || 0}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Database Meat Cuts Count: {syncStatus.database?.meatCutsCount || 0}
                  </Typography>
                  {syncStatus.syncStatus?.warnings && syncStatus.syncStatus.warnings.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
                      <ErrorIcon fontSize="small" />
                      <Typography variant="caption">
                        {syncStatus.syncStatus.warnings[0]}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CloudSyncIcon />}
                onClick={handleSyncCSVToDrive}
                disabled={syncing}
              >
                {syncing ? 'Syncing...' : 'Sync CSV to Drive'}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadCSV}
              >
                Download CSV
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<FolderIcon />}
                onClick={() => setShowCSVFiles(!showCSVFiles)}
              >
                {showCSVFiles ? 'Hide CSV Files' : 'View CSV Files'}
              </Button>
            </Box>
          </Box>

          {/* CSV Files List */}
          {showCSVFiles && driveCSVFiles.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Google Drive CSV Files:
              </Typography>
              <List dense>
                {driveCSVFiles.map((file) => (
                  <ListItem
                    key={file.id}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleDownloadDriveCSV(file.id, file.name)}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => handleDeleteDriveCSV(file.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemIcon>
                      <FolderIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={`Update time: ${new Date(file.modifiedTime).toLocaleString('en-US')}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Paper>

        <Grid container spacing={2}>
          {/* Left Side - Meat Cuts List */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddClick}
                  size="small"
                >
                  Add
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={selectedIds.size === 0}
                  size="small"
                >
                  Delete Selected ({selectedIds.size})
                </Button>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Button size="small" onClick={handleSelectAll}>
                  {selectedIds.size === meatCuts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </Box>

              <List sx={{ flex: 1, overflow: 'auto' }}>
                {meatCuts.map((meatCut) => (
                  <ListItem key={meatCut.id} disablePadding>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        checked={selectedIds.has(meatCut.id)}
                        onChange={() => handleCheckboxChange(meatCut.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </ListItemIcon>
                    <ListItemButton
                      selected={selectedMeatCut?.id === meatCut.id}
                      onClick={() => handleSelectMeatCut(meatCut)}
                    >
                      <ListItemText
                        primary={meatCut.name}
                        secondary={meatCut.chineseName}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Right Side - Form */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, height: 'calc(100vh - 150px)', overflow: 'auto' }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                  {success}
                </Alert>
              )}

              <Typography variant="h6" gutterBottom>
                {selectedMeatCut ? 'Edit Meat Cut' : 'Add New Meat Cut'}
              </Typography>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                {/* Upload Image */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Meat Image (Required) *
                    </Typography>
                    
                    <Box sx={{ 
                      width: '100%', 
                      height: 250, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: '2px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      bgcolor: 'white'
                    }}>
                      {getImagePreview() ? (
                        <>
                          <img 
                            src={getImagePreview()!} 
                            alt="Meat Preview" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                          />
                          <IconButton 
                            size="small" 
                            sx={{ 
                              position: 'absolute', 
                              top: 8, 
                              right: 8, 
                              bgcolor: 'rgba(255,255,255,0.8)',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
                            }}
                            onClick={handleClearImage}
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <Stack spacing={1} alignItems="center">
                          <ImageIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                          <Typography color="text.secondary">No image selected</Typography>
                        </Stack>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Button variant="outlined" component="label" size="small" startIcon={<AddIcon />}>
                        Upload New File
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handleImageFileChange}
                        />
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ImageIcon />}
                        onClick={() => setImageSelectDialogOpen(true)}
                      >
                        Select from Drive
                      </Button>
                      {(formData.imageFile || formData.googleDriveImageId) && (
                        <Button 
                          size="small" 
                          color="error" 
                          onClick={handleClearImage}
                          startIcon={<ClearIcon />}
                        >
                          Clear Selection
                        </Button>
                      )}
                    </Box>
                    
                    {formData.imageFile && (
                      <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'center' }} color="primary">
                        Selected file: {formData.imageFile.name}
                      </Typography>
                    )}
                    {formData.googleDriveImageId && (
                      <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'center' }} color="primary">
                        Selected from Drive: {driveImages.find(img => img.id === formData.googleDriveImageId)?.name || 'ID: ' + formData.googleDriveImageId}
                      </Typography>
                    )}
                  </Paper>
                </Grid>

                {/* Name */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Name *"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </Grid>

                {/* Chinese Name */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Chinese Name"
                    value={formData.chineseName}
                    onChange={(e) => setFormData(prev => ({ ...prev, chineseName: e.target.value }))}
                  />
                </Grid>

                {/* Part */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Part"
                    value={formData.part}
                    onChange={(e) => setFormData(prev => ({ ...prev, part: e.target.value }))}
                  />
                </Grid>

                {/* Lean */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Lean</InputLabel>
                    <Select
                      value={formData.lean ? 'Yes' : 'No'}
                      label="Lean"
                      onChange={(e) => setFormData(prev => ({ ...prev, lean: e.target.value === 'Yes' }))}
                    >
                      <MenuItem value="Yes">Yes</MenuItem>
                      <MenuItem value="No">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Price Range */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Price Min"
                    type="number"
                    value={formData.priceMin}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceMin: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Price Max"
                    type="number"
                    value={formData.priceMax}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceMax: e.target.value }))}
                  />
                </Grid>

                {/* Tags */}
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    freeSolo
                    options={availableTags}
                    value={formData.tags}
                    onChange={(_, newValue) => {
                      // Remove duplicates
                      const uniqueTags = Array.from(new Set(newValue));
                      setFormData(prev => ({ ...prev, tags: uniqueTags }));
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option}
                          {...getTagProps({ index })}
                          onDelete={() => {
                            setFormData(prev => ({
                              ...prev,
                              tags: prev.tags.filter((_, i) => i !== index)
                            }));
                          }}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select or add tags *"
                        placeholder="Type to add tags"
                        required
                      />
                    )}
                  />
                </Grid>

                {/* Description */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={4}
                    value={formData.textureNotes}
                    onChange={(e) => setFormData(prev => ({ ...prev, textureNotes: e.target.value }))}
                  />
                </Grid>

                {/* Image Reference */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Image Reference"
                    value={formData.imageReference}
                    onChange={(e) => setFormData(prev => ({ ...prev, imageReference: e.target.value }))}
                  />
                </Grid>

                {/* Action Buttons */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {selectedMeatCut ? (
                      <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={20} /> : null}
                      >
                        {saving ? 'Updating...' : 'Update'}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSave}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={20} /> : <AddIcon />}
                      >
                        {saving ? 'Adding...' : 'Add'}
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<ClearIcon />}
                      onClick={handleClear}
                      disabled={saving}
                    >
                      Clear
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Selected Items?</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete {selectedIds.size} meat cut(s)? 
              This will also delete the images from Google Drive. This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteSelected} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Image Selection Dialog */}
        <Dialog 
          open={imageSelectDialogOpen} 
          onClose={() => setImageSelectDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Select Image from Google Drive</DialogTitle>
          <DialogContent>
            <List>
              {driveImages.map((image) => (
                <ListItem key={image.id}>
                  <ListItemButton onClick={() => handleImageFromDriveSelect(image.id)}>
                    <ListItemText
                      primary={image.name}
                      secondary={`Created: ${new Date(image.createdTime).toLocaleDateString()}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImageSelectDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
