# Revisão de segurança — Fase 6

Revisão registrada em 10/10/2026. A validação de banco e os testes com dados usam exclusivamente `payload_test`; nenhum dado ou metadado do schema `public` foi consultado ou alterado.

## Controles verificados e aplicados

| Área | Resultado |
|---|---|
| `overrideAccess` | As leituras do site e do editor usam `overrideAccess: false`. Os usos internos com `true` são limitados à verificação do primeiro usuário, à busca de slug duplicado, à leitura do próprio documento durante a decisão de exclusão e a fixtures dos testes. As rotas REST de criação, edição e mídia continuam sujeitas aos access controls das coleções. |
| Cookies | A sessão mantém `SameSite=Strict` e `HttpOnly` (padrão do Payload); `Secure` é ligado quando `NODE_ENV=production`. O teste HTTP verifica esses atributos em uma resposta de login de produção. |
| Tentativas de login | Configurado explicitamente `maxLoginAttempts: 5` e `lockTime: 600000` (10 minutos). É bloqueio por conta; não substitui limitação de taxa por IP na borda. |
| Upload de mídia | Allowlist somente para JPEG, PNG, WebP, GIF e AVIF; SVG e `image/*` genérico não são permitidos. O parser multipart limita cada arquivo a 5 MiB, um arquivo por requisição e 6 MiB no corpo total, retornando erro ao exceder o limite. |
| HTML bruto | Não há bloco de HTML arbitrário no registro Puck. Os tipos disponíveis derivam do registro com schemas Zod e os renderizadores usam componentes React tipados. |
| CORS/CSRF | `cors: []` e `csrf: []`: não há origem externa confiável configurada. O admin e o frontend usam a mesma origem; uma futura separação de origens deve adicionar apenas origens exatas. |
| Segredo Payload | Não existe segredo padrão no código. Fora de testes, a configuração recusa segredo ausente, de exemplo, com menos de 32 caracteres ou baixa diversidade. Os testes usam segredo aleatório temporário. |
| `.env` e Git | `.env*` é ignorado, com exceção do `.env.example`; `.env` não consta entre os caminhos versionados ou no histórico local. A varredura por padrões encontrou candidatos a URI de banco e senha fixa em versões antigas do código; os valores não são exibidos e foram removidos da cópia atual. Os blobs históricos permanecem. |

### `overrideAccess` — contexto

Os usos privilegiados encontrados não estão expostos como bypass em rota pública. `canDeletePage` primeiro verifica usuário e perfil e usa a leitura privilegiada apenas para decidir se o documento é rascunho. A consulta de slug ocorre em hook da coleção para garantir unicidade; a contagem de usuários ocorre somente no cadastro não autenticado e força o primeiro perfil a administrador. Os testes usam acesso privilegiado apenas para preparar e limpar dados em `payload_test`.

## Auditoria de dependências

Auditoria inicial: 21 vulnerabilidades no grafo completo (9 altas); 17 em produção (5 altas). `npm audit fix` não alterou o grafo. Foram aplicados overrides semver compatíveis para `undici@7.30.0` e `dompurify@3.4.16`, ambos em dependências transitivas e sem downgrade/major do Payload. A auditoria subsequente reporta 14 vulnerabilidades no grafo completo (9 altas) e 10 em produção (5 altas). Portanto, os overrides reduziram sete avisos, mas não eliminaram os alertas altos.

Após os overrides, `npm run lint`, `npm run build` e os 14 testes de integração passaram. O build e os testes foram executados com `PAYLOAD_SCHEMA_NAME=payload_test`; a suíte confirma `db.schemaName === 'payload_test'` e todas as consultas/limpezas de fixtures qualificam esse schema.

Os alertas altos restantes em produção vêm da cadeia `braces` → `chokidar@3.6.0` → `sass@1.77.4` → `@payloadcms/next`. O registro consultado não oferece `braces@3.0.4` (a versão disponível é `3.0.3`); resolver a cadeia exigiria atualizar/substituir o Sass ou o Chokidar fixado pelo Payload. Isso pode mudar o comportamento do compilador CSS/observador de arquivos. O responsável aceitou manter o risco na POC, sem aplicar esse override. `npm audit fix --force` propõe downgrades incompatíveis (incluindo Payload `3.85.1` e `eslint-config-next` `14.2.35`); nenhum foi aplicado.

**Risco aceito pelo responsável para a POC:** manter essa cadeia vulnerável. Sass/Chokidar são usados no build e no modo de desenvolvimento; não são código de conteúdo executado diretamente para visitantes. Reavaliar antes de qualquer deploy na Vercel ou quando o Payload for atualizado. Não foram feitos overrides de Sass/Chokidar.

Consulta de metadados do registro npm: a versão mais recente disponível na major 3 para `payload`, `@payloadcms/next`, `@payloadcms/db-postgres` e `@payloadcms/richtext-lexical` é `3.90.2`, igual à instalada. `@payloadcms/next@3.90.2` ainda declara `sass@1.77.4`; não encontrei release Payload 3.x mais recente com essa cadeia corrigida. Nenhuma versão foi instalada.

## Segredos e histórico do Git

A verificação interna de presença e entropia retornou **não aprovado** para o `PAYLOAD_SECRET` carregado pelo ambiente: não cumpre o mínimo de 32 caracteres e não tem pelo menos 16 caracteres distintos; não corresponde ao prefixo de placeholder bloqueado. O `.env` foi carregado somente em memória para essa verificação; seu conteúdo não foi exibido, registrado em arquivo ou alterado. O aplicativo agora falha explicitamente até que um segredo forte seja configurado. O responsável vai gerar o novo valor e colocá-lo no `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Não reutilize o valor aleatório temporário usado nos testes ou no build de validação.

Varredura local direcionada dos 11 commits que alteraram os arquivos relevantes encontrou dois candidatos agrupados, sem falsos positivos identificados. Os valores não foram lidos para a saída nem impressos:

| Tipo | Localizações no histórico | Classificação e ação |
|---|---|---|
| URI PostgreSQL com credencial embutida | `payload.config.ts`: `51e98fa10c02:166`, `241b373fcab5:167`, `55b7e9fa6b01:169`, `3fa355b445bd:259`, `d18ab874f85d:270`, `469be3ae041f:274`, `d0a587a20851:284`, `5c99c435eca2:298`, `1826340e0a03:332`, `8a5a1a1c3bd4:339` | Literal de configuração removido da árvore atual; validade no provedor é desconhecida. Tratar como potencialmente válida e rotacionar se já foi usada. |
| Senha literal de bootstrap/configuração | `app/admin/page.tsx:19` nos commits `d1a7dc5b2439`, `51e98fa10c02`, `241b373fcab5`; `_legacy/app/admin/page.tsx:19` nos commits `55b7e9fa6b01`, `3fa355b445bd`, `d18ab874f85d`, `469be3ae041f`, `d0a587a20851`, `5c99c435eca2`, `1826340e0a03`, `8a5a1a1c3bd4` | Literal de bootstrap removido da árvore atual; validade externa desconhecida. Tratar como potencialmente válida e rotacionar se já foi usada. |

Não é possível confirmar validade/invalidez consultando apenas o histórico local; nenhum endpoint de banco/provedor foi acessado. A árvore atual não contém esses fallbacks e o bootstrap legado exige uma variável de ambiente explícita. O responsável precisa rotacionar a senha do banco Supabase correspondente à URI histórica; se a senha de bootstrap chegou a ser usada, também deve rotacionar essa credencial/conta. Não há remoto Git, upstream ou refs remotas locais configurados; portanto, não há evidência local de push e também não é possível provar que esses commits nunca foram enviados externamente. `.env` está coberto por `.gitignore` (regra `.env*`, linha 34), não está no índice e `git log --all -- .env` não retorna commits.

O histórico Git não foi reescrito. A reescrita só será reavaliada se o repositório for enviado a um remoto; `filter-repo`, BFG e force push exigem autorização explícita e coordenação com todos os clones/consumidores. Nenhum deles foi executado.

## Testes da Fase 6

- Unitários: 5 testes passaram para slug, validação Zod, papel de administrador, sanitização de links/imagens e força do segredo.
- Integração em `payload_test`: 14 testes passaram para matriz de acesso, leitura pública, configurações de autenticação/upload e contagem de `_pages_v`.
- E2E em Chromium headless: 1 fluxo passou; cobre login, criação pela view do admin, publicação pelo editor, leitura no site, edição em rascunho pelo mesmo endpoint REST autenticado usado pelo editor sem alterar a página pública, publicação da nova versão e exclusão. Também verifica cookie seguro, rejeição de SVG e limite de upload.
- A invalidação do caminho público foi exercitada no E2E ao publicar, alterar conteúdo e excluir. O contexto `disablePageRevalidation` continua usado pelos testes locais que não executam Next.

## Histórico de versões e autosave

Medição em `payload_test`: os primeiros cinco saves acrescentaram cinco linhas; após 21 saves, a página reteve 20 linhas no total, crescimento líquido de 19 sobre a contagem inicial. `pages.versions.maxPerDoc` está configurado em 20. O Payload pode limpar versões antigas em lotes para não exceder o limite; versões antigas podem ser removidas, inclusive publicações.

O debounce do editor Puck foi elevado de 1 s para 3 s para reduzir versões/gravações causadas por pausas curtas. Isso aumenta a janela de alterações ainda não persistidas; o editor mantém indicador de salvamento, opção de salvar manualmente e aviso de saída quando há mudanças pendentes.

## Proposta — tabelas órfãs em `public` (não executada)

Os nomes e dependências das tabelas não foram consultados, conforme a restrição de não acessar `public`. Depois de uma listagem e aprovação explícitas, escolher uma das alternativas abaixo para **cada nome confirmado**, após backup e verificação de chaves estrangeiras, views, triggers e consumidores:

**Remoção aprovada de uma tabela isolada:**

```sql
BEGIN;
DROP TABLE public."<NOME_EXATO_APROVADO>";
COMMIT;
```

Não usar `CASCADE` por padrão. Se houver dependências, interromper e revisar cada objeto antes de decidir.

**Manutenção da tabela sem acesso pela API:**

```sql
BEGIN;
ALTER TABLE public."<NOME_EXATO_APROVADO>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."<NOME_EXATO_APROVADO>" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."<NOME_EXATO_APROVADO>" FROM anon, authenticated;
COMMIT;
```

Sem policies, o RLS nega acesso às roles `anon` e `authenticated`; proprietários e roles com `BYPASSRLS` ainda exigem controle operacional próprio. Estes exemplos são modelos, não SQL pronto para execução.

## Proposta — `_legacy/` (não removida)

Após aprovação, revisar o conteúdo e então remover somente a pasta do repositório:

```powershell
Remove-Item -LiteralPath .\_legacy -Recurse
```

Nenhuma tabela de `public` foi listada, modificada ou removida e `_legacy/` permanece intacta.

## Riscos e pendências conhecidas

- `puckData` guarda a URL relativa da mídia desnormalizada. Substituição ou exclusão do arquivo pode deixar referência antiga.
- Não há adaptador de e-mail: recuperação de senha é escrita no console e não chega à caixa postal.
- Os uploads ainda são locais em `public/uploads`; falta storage remoto durável e estratégia de backup.
- O lockout é por usuário; uma proteção por IP/rate limiting deve ser feita no proxy/CDN de produção.
- CORS/CSRF permanecem fechados para origens externas; revisar apenas se frontend e Payload forem separados.
- As dependências Sass/Chokidar/Braces permanecem como risco aceito para a POC; reavaliar antes do deploy na Vercel ou ao atualizar o Payload.
- A configuração `PAYLOAD_SECRET` presente no ambiente local precisa ser substituída por valor aleatório antes de iniciar a aplicação.
