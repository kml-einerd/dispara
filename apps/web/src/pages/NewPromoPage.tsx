import { Header } from "../components/layout/Header";
import { SearchBar } from "../components/copilot/SearchBar";
import { ResultsGrid } from "../components/copilot/ResultsGrid";
import { PromoEditor } from "../components/copilot/PromoEditor";
import { QuickDispatch } from "../components/copilot/QuickDispatch";
import { useState, useEffect } from "react";
import { Product } from "../types";
import { Badge } from "../components/ui/badge";
import { useMarketplacesStore } from "../store/marketplaces";
import { Link } from "react-router-dom";

export function NewPromoPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { shopeeConnected, mlConnected, loadAccounts } = useMarketplacesStore();

  useEffect(() => {
    loadAccounts();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Header title="Criar Promoção" showNewPromo={false} />

      <div className="grid grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-2">
        {/* Coluna Esquerda - Busca */}
        <div className="flex flex-col gap-6">
          <SearchBar
            onResults={(products) => setSearchResults(products)}
            onSearching={(searching) => setIsSearching(searching)}
          />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Marketplaces:</span>
            <div className="flex gap-2">
              {shopeeConnected ? (
                <Badge variant="success" className="bg-violet-600">Shopee</Badge>
              ) : (
                <Link to="/settings">
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">Conectar Shopee</Badge>
                </Link>
              )}
              {mlConnected ? (
                <Badge variant="success" className="bg-yellow-600">Mercado Livre</Badge>
              ) : (
                <Link to="/settings">
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">Conectar ML</Badge>
                </Link>
              )}
            </div>
          </div>

          <ResultsGrid
            products={searchResults}
            isLoading={isSearching}
            onSelect={(product) => setSelectedProduct(product)}
            selectedId={selectedProduct?.id}
          />
        </div>

        {/* Coluna Direita - Editor */}
        <div className="flex flex-col gap-6">
          {selectedProduct ? (
            <>
              <PromoEditor product={selectedProduct} />
              <QuickDispatch product={selectedProduct} />
            </>
          ) : (
            <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/30 text-center text-muted-foreground">
              <p>Selecione um produto para começar a editar a promoção.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
