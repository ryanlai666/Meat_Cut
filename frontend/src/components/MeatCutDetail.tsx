import React from 'react';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import { MeatCut } from '../types';

interface MeatCutDetailProps {
  meatCut: MeatCut | null;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onTagClick?: (tag: string) => void;
}

export default function MeatCutDetail({
  meatCut,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  onTagClick,
}: MeatCutDetailProps) {
  if (!meatCut) {
    return (
      <Box sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Typography variant="h6" color="text.secondary">
          Select a meat cut to view details
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      p: 4,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header Info: Name, Chinese Name, and Description on Upper Left */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1 }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            {meatCut.name}
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 'normal' }}>
            {meatCut.chineseName}
          </Typography>
        </Box>
        <Typography 
          variant="h5" 
          sx={{ 
            color: 'text.primary',
            fontWeight: 'normal',
            maxWidth: '80%',
            mb: 1
          }}
        >
          {meatCut.textureNotes}
        </Typography>

        {/* Clickable Tags */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[meatCut.part, ...meatCut.cookingMethods].map((tag, idx) => (
            <Typography
              key={idx}
              variant="body1"
              sx={{
                color: 'primary.main',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
                bgcolor: 'action.hover',
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}
              onClick={() => onTagClick?.(tag)}
            >
              {tag}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Image Container */}
      <Box sx={{ 
        position: 'relative', 
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0 // Allows flex shrink
      }}>
        {/* Navigation Buttons on the left */}
        <Box sx={{ 
          position: 'absolute', 
          left: 0, 
          top: '50%', 
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          zIndex: 1
        }}>
          <IconButton
            onClick={onPrevious}
            disabled={!canGoPrevious}
            sx={{
              bgcolor: 'transparent',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
              '&.Mui-disabled': { opacity: 0.3 }
            }}
          >
            <KeyboardArrowUp fontSize="large" />
          </IconButton>
          
          <IconButton
            onClick={onNext}
            disabled={!canGoNext}
            sx={{
              bgcolor: 'transparent',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
              '&.Mui-disabled': { opacity: 0.3 }
            }}
          >
            <KeyboardArrowDown fontSize="large" />
          </IconButton>
        </Box>

        <Box
          component="img"
          src={meatCut.imagePath}
          alt={meatCut.name}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.jpg';
          }}
        />
      </Box>

      {/* Conditional Footer Message on Right Bottom */}
      {meatCut.name.includes('*') && (
        <Box sx={{ 
          position: 'absolute', 
          bottom: 24, 
          right: 24,
          zIndex: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'normal', color: 'text.primary' }}>
            *Marinate before cooking for best results
          </Typography>
        </Box>
      )}
    </Box>
  );
}
