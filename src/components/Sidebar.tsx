import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  InputAdornment,
  IconButton,
  SelectChangeEvent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { MeatCut, FilterState, SortOption } from '../types';

// Constants
const DEBOUNCE_DELAY_MS = 300;
const SIDEBAR_WIDTH = 400;
const TITLE_IMAGE_MAX_HEIGHT = 150;
const MAX_DISPLAYED_TAGS = 2;

// Styling constants
const sectionBoxStyles = {
  p: 2,
  bgcolor: 'background.paper',
  borderBottom: '1px solid',
  borderColor: 'divider',
} as const;

const sidebarBoxStyles = {
  width: SIDEBAR_WIDTH,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  bgcolor: 'background.default',
  borderLeft: '1px solid',
  borderColor: 'divider',
  overflow: 'hidden',
} as const;

interface SidebarProps {
  titleImage: string;
  meatCuts: MeatCut[];
  filteredCuts: MeatCut[];
  selectedCut: MeatCut | null;
  onSelectCut: (cut: MeatCut) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  priceRange: [number, number];
}

// Sub-components
interface TitleImageProps {
  src: string;
}

function TitleImage({ src }: TitleImageProps) {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
  };

  return (
    <Box
      component="img"
      src={src}
      alt="Beef Cuts"
      sx={{
        width: '100%',
        maxHeight: TITLE_IMAGE_MAX_HEIGHT,
        objectFit: 'cover',
        bgcolor: 'background.paper',
      }}
      onError={handleImageError}
    />
  );
}

interface PriceRangeFilterProps {
  value: [number, number];
  min: number;
  max: number;
  onChange: (range: [number, number]) => void;
}

function PriceRangeFilter({ value, min, max, onChange }: PriceRangeFilterProps) {
  const handleChange = (_event: Event, newValue: number | number[]) => {
    onChange(newValue as [number, number]);
  };

  return (
    <Box sx={sectionBoxStyles}>
      <Typography variant="body2" gutterBottom>
        Price Range: ${value[0]} - ${value[1]}
      </Typography>
      <Slider
        value={value}
        onChange={handleChange}
        valueLabelDisplay="auto"
        min={min}
        max={max}
        step={1}
        sx={{ mt: 1 }}
      />
    </Box>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <Box sx={sectionBoxStyles}>
      <TextField
        fullWidth
        placeholder="search by tags or name..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton edge="end">
                <SearchIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
        inputProps={{
          sx: {
            '&::placeholder': {
              fontWeight: 'bold',
              opacity: 1,
            },
          },
        }}
        size="small"
      />
    </Box>
  );
}

interface SortDropdownProps {
  value: SortOption;
  onChange: (sortBy: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'cut', label: 'Cut' },
  { value: 'cookingMethod', label: 'Cooking Method' },
  { value: 'price', label: 'Price' },
];

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const handleChange = (event: SelectChangeEvent<SortOption>) => {
    onChange(event.target.value as SortOption);
  };

  return (
    <Box sx={sectionBoxStyles}>
      <FormControl fullWidth size="small">
        <InputLabel>order by</InputLabel>
        <Select value={value} label="order by" onChange={handleChange}>
          {SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

interface MeatCutListItemProps {
  cut: MeatCut;
  isSelected: boolean;
  onSelect: (cut: MeatCut) => void;
  onTagClick: (tag: string) => void;
}

function MeatCutListItem({ cut, isSelected, onSelect, onTagClick }: MeatCutListItemProps) {
  const displayTags = [cut.part, ...cut.cookingMethods.slice(0, MAX_DISPLAYED_TAGS)];

  const handleTagClick = useCallback(
    (e: React.MouseEvent, tag: string) => {
      e.stopPropagation();
      onTagClick(tag);
    },
    [onTagClick]
  );

  return (
    <ListItem
      disablePadding
      sx={{
        bgcolor: isSelected ? 'action.selected' : 'transparent',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <ListItemButton onClick={() => onSelect(cut)}>
        <ListItemText
          primary={
            <Box>
              <Typography variant="body1" fontWeight="medium">
                {cut.name}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  mt: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Tags:
                </Typography>
                {displayTags.map((tag, idx) => (
                  <Typography
                    key={`${tag}-${idx}`}
                    variant="caption"
                    sx={{
                      color: 'primary.main',
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                      bgcolor: 'action.hover',
                      px: 0.5,
                      borderRadius: 0.5,
                    }}
                    onClick={(e) => handleTagClick(e, tag)}
                  >
                    {tag}
                  </Typography>
                ))}
              </Box>
              <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                Approx. Price: {cut.priceRange.display}
              </Typography>
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );
}

function EmptyState() {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        No results found
      </Typography>
    </Box>
  );
}

interface MeatCutListProps {
  cuts: MeatCut[];
  selectedCut: MeatCut | null;
  onSelectCut: (cut: MeatCut) => void;
  onTagClick: (tag: string) => void;
}

function MeatCutList({ cuts, selectedCut, onSelectCut, onTagClick }: MeatCutListProps) {
  if (cuts.length === 0) {
    return <EmptyState />;
  }

  return (
    <List sx={{ p: 0 }}>
      {cuts.map((cut) => (
        <MeatCutListItem
          key={cut.id}
          cut={cut}
          isSelected={selectedCut?.id === cut.id}
          onSelect={onSelectCut}
          onTagClick={onTagClick}
        />
      ))}
    </List>
  );
}

// Main component
export default function Sidebar({
  titleImage,
  filteredCuts,
  selectedCut,
  onSelectCut,
  filters,
  onFiltersChange,
  priceRange,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery);

  // Sync internal search query state with external filters prop
  useEffect(() => {
    setSearchQuery(filters.searchQuery);
  }, [filters.searchQuery]);

  // Debounce search query updates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filters.searchQuery) {
        onFiltersChange({ ...filters, searchQuery });
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handlePriceRangeChange = useCallback(
    (range: [number, number]) => {
      onFiltersChange({ ...filters, priceRange: range });
    },
    [filters, onFiltersChange]
  );

  const handleSortChange = useCallback(
    (sortBy: SortOption) => {
      onFiltersChange({ ...filters, sortBy });
    },
    [filters, onFiltersChange]
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      const currentKeywords = searchQuery
        .trim()
        .split(/\s+/)
        .filter((k) => k.length > 0);
      if (!currentKeywords.includes(tag.toLowerCase())) {
        const newQuery = searchQuery.trim() ? `${searchQuery.trim()} ${tag}` : tag;
        setSearchQuery(newQuery);
      }
    },
    [searchQuery]
  );

  return (
    <Box sx={sidebarBoxStyles}>
      <TitleImage src={titleImage} />
      <PriceRangeFilter
        value={filters.priceRange}
        min={priceRange[0]}
        max={priceRange[1]}
        onChange={handlePriceRangeChange}
      />
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <SortDropdown value={filters.sortBy} onChange={handleSortChange} />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <MeatCutList
          cuts={filteredCuts}
          selectedCut={selectedCut}
          onSelectCut={onSelectCut}
          onTagClick={handleTagClick}
        />
      </Box>
    </Box>
  );
}
