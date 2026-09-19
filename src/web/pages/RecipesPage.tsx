import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/common/TopBar';
import { RecipeCard } from '../components/common/RecipeCard';
import { EmptyState } from '../components/common/EmptyState';
import { InlineError } from '../components/common/AsyncState';
import { api } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { VietnameseCategory } from '@frigo/recipes';
import { Search, Clock, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const RecipesPage: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<VietnameseCategory | null>(null);
  const [regionFilter, setRegionFilter] = useState<'bac' | 'trung' | 'nam' | null>(null);
  const [noBuyOnly, setNoBuyOnly] = useState(false);
  const [under20MinsOnly, setUnder20MinsOnly] = useState(false);

  const recommendationsQuery = useQuery({
    queryKey: queryKeys.recommendations({
      noBuy: noBuyOnly,
      cuisine: cuisineFilter,
      category: categoryFilter,
      region: regionFilter,
      maxTime: under20MinsOnly ? 20 : undefined,
    }),
    queryFn: () => api.getRecommendations({
      noBuy: noBuyOnly,
      cuisine: cuisineFilter || undefined,
      category: categoryFilter || undefined,
      region: regionFilter || undefined,
      maxTime: under20MinsOnly ? 20 : undefined,
    }),
  });
  const recipes = recommendationsQuery.data ?? [];
  const loading = recommendationsQuery.isPending;

  const filtered = recipes.filter((r) => {
    if (categoryFilter && r.recipe.category !== categoryFilter) {
      return false;
    }
    if (regionFilter && r.recipe.region !== regionFilter && r.recipe.region !== 'toan_quoc') {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.recipe.title.toLowerCase().includes(q) ||
      r.recipe.description.toLowerCase().includes(q) ||
      (r.recipe.tags && r.recipe.tags.some((t) => t.toLowerCase().includes(q))) ||
      r.recipe.ingredients.some((i) => i.name.toLowerCase().includes(q))
    );
  });

  const cuisines = [
    { id: null, label: 'Tất cả ẩm thực' },
    { id: 'vietnamese', label: '🇻🇳 Món Việt' },
    { id: 'korean', label: '🇰🇷 Món Hàn' },
    { id: 'japanese', label: '🇯🇵 Món Nhật' },
    { id: 'chinese', label: '🇨🇳 Trung Hoa' },
    { id: 'thai', label: '🇹🇭 Món Thái' },
    { id: 'italian', label: '🇮🇹 Món Ý' },
  ];

  const vietnameseCategories: Array<{ id: VietnameseCategory | null; label: string; icon: string }> = [
    { id: null, label: 'Tất cả danh mục', icon: '🍽️' },
    { id: 'mon_canh', label: 'Món Canh', icon: '🍲' },
    { id: 'mon_kho', label: 'Món Kho / Rim', icon: '🥘' },
    { id: 'mon_xao', label: 'Món Xào', icon: '🍳' },
    { id: 'mon_chien', label: 'Chiên / Rán', icon: '🍗' },
    { id: 'mon_hap_luoc', label: 'Hấp / Luộc', icon: '🥬' },
    { id: 'mon_cuon_nom', label: 'Cuốn / Nộm', icon: '🌯' },
    { id: 'mon_bun_pho', label: 'Bún / Phở', icon: '🍜' },
    { id: 'mon_chay', label: 'Món Chay', icon: '🥗' },
    { id: 'mon_nhanh_sang', label: 'Ăn Sáng ≤ 20p', icon: '⚡' },
    { id: 'mon_lau_tiec', label: 'Lẩu & Tiệc', icon: '🔥' },
  ];

  const regions: Array<{ id: 'bac' | 'trung' | 'nam' | null; label: string }> = [
    { id: null, label: 'Toàn quốc' },
    { id: 'bac', label: 'Miền Bắc' },
    { id: 'trung', label: 'Miền Trung' },
    { id: 'nam', label: 'Miền Nam' },
  ];

  return (
    <div className="min-h-screen bg-takosan-cream pb-12">
      <TopBar />

      <div className="px-4 pt-3 space-y-3.5 animate-fade-in">
        <div>
          <h2 className="font-heading font-bold text-xl text-slate-900 tracking-tight">
            Gợi ý món ngon
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ngân hàng 60+ công thức món Việt đa danh mục & tối ưu theo tủ lạnh
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm món canh, thịt kho, phở, bún chả, nguyên liệu..."
            className="w-full h-11 pl-10 pr-4 bg-white rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-takosan-green/20 focus:border-takosan-green text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-xs transition-tap"
          />
        </div>

        {/* 10 Vietnamese Culinary Categories */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Danh mục món Việt
            </span>
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter(null)}
                className="text-[11px] font-semibold text-takosan-green hover:text-takosan-green-deep"
              >
                Đặt lại
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-4 px-4">
            {vietnameseCategories.map((cat) => {
              const isActive = categoryFilter === cat.id;
              return (
                <button
                  key={cat.label}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-tap flex items-center gap-1.5 tap-target cursor-pointer border shadow-xs',
                    isActive
                      ? 'bg-takosan-green text-white border-takosan-green font-semibold shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                  )}
                >
                  <span className="text-sm leading-none">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Filters: No-Buy, Time, Cuisine & Region */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4">
          <button
            onClick={() => setNoBuyOnly(!noBuyOnly)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-tap whitespace-nowrap flex items-center gap-1.5 tap-target shadow-xs cursor-pointer',
              noBuyOnly
                ? 'bg-takosan-green text-white border border-takosan-green'
                : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50'
            )}
          >
            <CheckCircle className={clsx('w-3.5 h-3.5', noBuyOnly ? 'text-takosan-mint' : 'text-takosan-green')} />
            <span>Không mua thêm</span>
          </button>

          <button
            onClick={() => setUnder20MinsOnly(!under20MinsOnly)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-tap whitespace-nowrap flex items-center gap-1.5 tap-target shadow-xs cursor-pointer',
              under20MinsOnly
                ? 'bg-takosan-green text-white border border-takosan-green'
                : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50'
            )}
          >
            <Clock className={clsx('w-3.5 h-3.5', under20MinsOnly ? 'text-takosan-mint' : 'text-takosan-green')} />
            <span>&le; 20 phút</span>
          </button>

          {/* Region filter pills */}
          {regions.map((reg) => (
            <button
              key={reg.label}
              onClick={() => setRegionFilter(reg.id)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-tap tap-target cursor-pointer border',
                regionFilter === reg.id
                  ? 'bg-takosan-green text-white border-takosan-green font-semibold shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {reg.label}
            </button>
          ))}

          {/* International Cuisines */}
          {cuisines.map((c) => (
            <button
              key={c.label}
              onClick={() => setCuisineFilter(c.id)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-tap tap-target cursor-pointer border',
                cuisineFilter === c.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs font-semibold'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Active Filters Summary Header */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-slate-700">
            Tìm thấy <span className="text-takosan-green font-bold">{filtered.length}</span> món ngon
          </span>
          {(categoryFilter || regionFilter || cuisineFilter || noBuyOnly || under20MinsOnly || search) && (
            <button
              onClick={() => {
                setCategoryFilter(null);
                setRegionFilter(null);
                setCuisineFilter(null);
                setNoBuyOnly(false);
                setUnder20MinsOnly(false);
                setSearch('');
              }}
              className="text-xs text-takosan-green font-medium hover:underline"
            >
              Xóa tất cả lọc
            </button>
          )}
        </div>

        {/* Recipes Results */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin w-7 h-7 border-2 border-takosan-green border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Đang tìm món...</p>
            </div>
          ) : recommendationsQuery.isError ? (
            <InlineError error={recommendationsQuery.error} onRetry={() => recommendationsQuery.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              type="no-recipes"
              title="Không tìm thấy món phù hợp"
              description="Hãy thử nới lỏng bộ lọc hoặc tìm danh mục khác nhé."
              actionText="Xóa bộ lọc"
              onAction={() => {
                setCategoryFilter(null);
                setRegionFilter(null);
                setNoBuyOnly(false);
                setUnder20MinsOnly(false);
                setCuisineFilter(null);
                setSearch('');
              }}
            />
          ) : (
            filtered.map((item) => (
              <RecipeCard
                key={item.recipe.id}
                matchResult={item}
                onClick={() => navigate(`/recipes/${item.recipe.slug}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
