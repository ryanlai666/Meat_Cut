import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { MeatCut, FilterState, SortOption } from './types';
import { loadMeatCutData } from './utils/csvParser';
import { filterAndSortMeatCuts, getPriceRangeFromCuts } from './utils/filters';
import MeatCutDetail from './components/MeatCutDetail';
import Sidebar from './components/Sidebar';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';

function HomePage() {
  const [meatCuts, setMeatCuts] = useState<MeatCut[]>([]);
  const [selectedCut, setSelectedCut] = useState<MeatCut | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    priceRange: [0, 100],
    sortBy: 'name' as SortOption,
  });
  const [loading, setLoading] = useState(true);

  // Use all meat cuts from the backend
  const testCuts = useMemo(() => {
    return meatCuts;
  }, [meatCuts]);

  // Get price range for slider
  const priceRange = useMemo(() => {
    if (meatCuts.length === 0) return [0, 100] as [number, number];
    return getPriceRangeFromCuts(meatCuts);
  }, [meatCuts]);

  // Initialize price range when data loads
  useEffect(() => {
    if (testCuts.length > 0 && filters.priceRange[1] === 100) {
      const range = getPriceRangeFromCuts(testCuts);
      setFilters(prev => ({ ...prev, priceRange: range }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testCuts]);

  // Filter and sort cuts
  const filteredCuts = useMemo(() => {
    return filterAndSortMeatCuts(testCuts, filters);
  }, [testCuts, filters]);

  // Set initial selected cut (first in filtered list, sorted by name)
  useEffect(() => {
    if (filteredCuts.length > 0 && !selectedCut) {
      setSelectedCut(filteredCuts[0]);
    } else if (selectedCut && !filteredCuts.find(c => c.id === selectedCut.id)) {
      // If selected cut is no longer in filtered results, select first one
      setSelectedCut(filteredCuts[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCuts]);

  // Load data
  useEffect(() => {
    loadMeatCutData()
      .then((data) => {
        setMeatCuts(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading meat cut data:', error);
        setLoading(false);
      });
  }, []);

  const handleSelectCut = (cut: MeatCut) => {
    setSelectedCut(cut);
  };

  const handlePrevious = () => {
    const currentIndex = filteredCuts.findIndex(c => c.id === selectedCut?.id);
    if (currentIndex > 0) {
      setSelectedCut(filteredCuts[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    const currentIndex = filteredCuts.findIndex(c => c.id === selectedCut?.id);
    if (currentIndex < filteredCuts.length - 1) {
      setSelectedCut(filteredCuts[currentIndex + 1]);
    }
  };

  const handleTagClick = (tag: string) => {
    const currentQuery = filters.searchQuery.trim();
    const keywords = currentQuery.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    
    if (!keywords.includes(tag.toLowerCase())) {
      const newQuery = currentQuery ? `${currentQuery} ${tag}` : tag;
      setFilters(prev => ({ ...prev, searchQuery: newQuery }));
    }
  };

  const canGoPrevious = filteredCuts.findIndex(c => c.id === selectedCut?.id) > 0;
  const canGoNext = filteredCuts.findIndex(c => c.id === selectedCut?.id) < filteredCuts.length - 1;

  if (loading) {
    return (
      <Box sx={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Box>Loading...</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      overflow: 'hidden' 
    }}>
      {/* Main Content Area */}
      <Box sx={{ 
        flex: 1, 
        height: '100%', 
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}>
        <MeatCutDetail
          meatCut={selectedCut}
          onPrevious={handlePrevious}
          onNext={handleNext}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onTagClick={handleTagClick}
        />
      </Box>

      {/* Sidebar */}
      <Sidebar
        titleImage="/data/beef_cuts_title.jpg"
        meatCuts={testCuts}
        filteredCuts={filteredCuts}
        selectedCut={selectedCut}
        onSelectCut={handleSelectCut}
        filters={filters}
        onFiltersChange={setFilters}
        priceRange={priceRange}
      />
    </Box>
  );
}

function MeatCutDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [meatCut, setMeatCut] = useState<MeatCut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load meat cut by slug from API
    setLoading(false);
  }, [slug]);

  if (loading) {
    return <Box>Loading...</Box>;
  }

  return <Box>Meat Cut Detail: {slug}</Box>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/meat/:slug" element={<MeatCutDetailPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default App;
