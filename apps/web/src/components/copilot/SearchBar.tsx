'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, Link as LinkIcon, Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/src/lib/api";
import { Product } from "@/src/types";

interface SearchBarProps {
  onResults: (products: Product[]) => void;
  onSearching: (searching: boolean) => void;
}

export function SearchBar({ onResults, onSearching }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSearch = async (type: 'text' | 'link') => {
    if (!query) return;
    onSearching(true);
    try {
      const { products } = await api.post('/promos', { 
        [type === 'text' ? 'keyword' : 'url']: query 
      });
      onResults(products || []);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      onSearching(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    onSearching(true);
    
    try {
      // TODO(FASE 2): Implementar image-generation via /promos/generate-image
      // Por ora, busca textual usando nome do arquivo
      const fallbackQuery = file.name.replace(/\.\w+$/, '').replace(/[-_]/g, ' ');
      const { data } = await api.post('/agent/interact', { message: fallbackQuery });
      onResults(data?.products || []);
    } catch (error) {
      console.error('Image upload fallback failed', error);
    } finally {
      setIsUploading(false);
      onSearching(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-1 shadow-sm">
      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-transparent">
          <TabsTrigger value="text" className="data-[state=active]:bg-secondary">Texto</TabsTrigger>
          <TabsTrigger value="link" className="data-[state=active]:bg-secondary">Link</TabsTrigger>
          <TabsTrigger value="photo" className="data-[state=active]:bg-secondary">Foto</TabsTrigger>
        </TabsList>
        
        <div className="p-3">
          <TabsContent value="text" className="mt-0 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="ex: tênis nike air max 40% off" 
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch('text')}
              />
            </div>
            <Button onClick={() => handleSearch('text')}>Buscar</Button>
          </TabsContent>

          <TabsContent value="link" className="mt-0 flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Cole a URL do produto (Shopee ou ML)" 
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch('link')}
              />
            </div>
            <Button onClick={() => handleSearch('link')}>Analisar</Button>
          </TabsContent>

          <TabsContent value="photo" className="mt-0">
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 transition-colors hover:bg-accent/30">
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Identificando produto...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Clique ou arraste uma foto</span>
                </div>
              )}
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
            </label>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
