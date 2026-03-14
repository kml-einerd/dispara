# Frontend Web — Padroes e Convencoes

## Stack
- Vite 6 + React 19 + TypeScript
- Tailwind CSS 4 + Radix UI
- Tema: dark Apple-style

## Estrutura
- `src/pages/` — uma page por rota (flat, sem nesting)
- `src/components/` — organizados por dominio (`copilot/`, `dispatch/`, `whatsapp/`, `ui/`, `layout/`, `onboarding/`)
- `src/hooks/` — custom hooks
- `src/store/` — estado global
- `src/lib/` — utilitarios, API client
- `src/layouts/` — layouts de pagina

## Pages Existentes
- `DashboardPage`, `PromosPage`, `NewPromoPage`, `DispatchesPage`
- `GroupsPage`, `WhatsAppPage`, `CommissionsPage`, `SettingsPage`
- `CopilotPage` (chat IA), `LoginPage`, `LinkRedirectPage`

## Como Adicionar uma Nova Page
1. Criar `src/pages/<Nome>Page.tsx`
2. Registrar rota no router (em `App.tsx`)
3. Componentes especificos da page vao em `src/components/<dominio>/`

## Convencoes de Componentes
- Componentes UI reutilizaveis em `src/components/ui/` (Radix-based)
- Layout components em `src/components/layout/`
- Naming: `PascalCase` para componentes, `camelCase` para hooks
- Sempre tipar props com interface explicita

## API Client
- Configurado em `src/lib/`
- Todas as chamadas passam Bearer token do Supabase Auth
- Base URL configuravel via env

## Testes
- `src/__tests__/` — Vitest
- Rodar: `npx turbo run test --filter=@dispara/web`
