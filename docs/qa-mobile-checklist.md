# QA Mobile Checklist — Dispara v2

## Dispositivos de Teste
- [ ] iOS Safari (iPhone 13+ ou similar)
- [ ] Android Chrome (Pixel 5+ ou similar)
- [ ] Desktop Chrome (1920x1080)
- [ ] Desktop Firefox (1920x1080)

## Fluxo Crítico: Login → Copilot → Promo → Dispatch

### 1. Login
- [ ] Google OAuth abre corretamente no mobile
- [ ] Redirect pós-login vai para /copiloto
- [ ] Token persistido (refresh page mantém sessão)

### 2. Onboarding Wizard
- [ ] Steps 1-4 navegáveis com swipe
- [ ] QR code modal legível no mobile (zoom adequado)
- [ ] Botões de ação com min-height 44px (touch-friendly)

### 3. Copilot (Chat)
- [ ] Input de texto focável sem scroll inesperado
- [ ] Quick suggestions clicáveis (44px tap targets)
- [ ] Paste de link do marketplace detecta automaticamente
- [ ] Cards de produto scrolláveis horizontalmente
- [ ] PromoEditor: 5 tons selecionáveis com tap
- [ ] Preview WhatsApp legível no mobile
- [ ] Emoji picker abre sem quebrar layout
- [ ] Character counter visível

### 4. Dashboard
- [ ] Cards de stats em grid 1-col no mobile
- [ ] Chart de 7 dias legível (labels não cortados)
- [ ] Bottom nav com 5 items funcionando

### 5. WhatsApp Sessions
- [ ] Cards de sessão com health score visível
- [ ] QR modal centralizado e redimensionável
- [ ] Botão sync com feedback visual

### 6. Grupos
- [ ] Switch toggle funciona com tap
- [ ] Search input não é coberto pelo teclado
- [ ] Filter dropdown acessível

### 7. Promoções
- [ ] Cards em grid responsivo (1-col mobile)
- [ ] Dropdown menu (edit/delete) acessível
- [ ] Pull-to-refresh funciona no mobile

### 8. Dispatches
- [ ] Tabela vira cards no mobile
- [ ] Status badges legíveis
- [ ] Progress bars visíveis

### 9. Comissões
- [ ] Gráfico Recharts responsivo
- [ ] Period tabs clicáveis
- [ ] Marketplace tabs funcionando

### 10. Configurações
- [ ] Layout 1-col no mobile
- [ ] Forms de marketplace preenchem corretamente
- [ ] Logout funciona

## Responsividade
- [ ] Bottom nav aparece em telas < 768px
- [ ] Sidebar aparece em telas >= 768px
- [ ] Safe area padding em iPhones com notch
- [ ] Sem scroll horizontal em nenhuma página
- [ ] Textos não cortados em telas pequenas (320px)

## Performance
- [ ] First paint < 3s no 4G
- [ ] Interativo < 5s no 4G
- [ ] Sem jank ao scrollar listas longas
- [ ] SWR cache funciona offline (dados cached aparecem)
