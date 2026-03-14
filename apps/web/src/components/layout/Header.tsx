import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';

interface HeaderProps {
  title: string;
  showNewPromo?: boolean;
}

export function Header({ title, showNewPromo = true }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b bg-background/50 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      </div>

      {showNewPromo && (
        <Link to="/promos/new">
          <Button className="min-h-[44px] gap-2">
            <Plus className="h-4 w-4" />
            Nova Promo
          </Button>
        </Link>
      )}
    </header>
  );
}
