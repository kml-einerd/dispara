# Rotação de Keys — Checklist

As keys originais foram expostas no git history (já limpo via git-filter-repo).
**Rotacionar TODAS as keys abaixo antes do deploy em produção.**

## 1. Supabase (CRÍTICO)
- [ ] Dashboard: https://supabase.com/dashboard/project/ytgiexxqvvntefsoxeeq/settings/api
- [ ] Regenerar `anon key` → atualizar `SUPABASE_ANON_KEY` no .env + frontend
- [ ] Regenerar `service_role key` → atualizar `SUPABASE_SERVICE_ROLE_KEY` no .env
- [ ] Alterar senha do DB → atualizar `DATABASE_URL` no .env

## 2. OpenRouter (CRÍTICO)
- [ ] Dashboard: https://openrouter.ai/settings/keys
- [ ] Revogar key antiga, gerar nova
- [ ] Atualizar `OPENROUTER_API_KEY` no .env

## 3. Gemini (CRÍTICO)
- [ ] Console: https://aistudio.google.com/apikey
- [ ] Revogar key antiga, gerar nova
- [ ] Atualizar `GEMINI_API_KEY` no apps/api/.env

## 4. Google OAuth
- [ ] Console: https://console.cloud.google.com/apis/credentials
- [ ] Gerar novo client secret (manter client ID)
- [ ] Atualizar `GOOGLE_OAUTH_CLIENT_SECRET` no .env

## 5. Cloudflare / R2
- [ ] Dashboard: https://dash.cloudflare.com → API Tokens
- [ ] Revogar token antigo, gerar novo
- [ ] Atualizar `CLOUDFLARE_TOKEN` e `R2_TOKEN` no .env

## 6. GitHub Token
- [ ] Settings: https://github.com/settings/tokens
- [ ] Revogar `ghp_rWxJqoHPf...` (token antigo)
- [ ] Gerar novo com scopes necessários (repo, workflow)
- [ ] Atualizar `GITHUB_TOKEN` no .env

## Após rotacionar
1. Atualizar .env no servidor Hetzner
2. Restart containers: `docker compose -f docker-compose.prod.yml up -d`
3. Verificar health: `curl https://api-url/health`
4. Testar login no frontend (Google OAuth)
5. Testar envio de mensagem (WhatsApp)
